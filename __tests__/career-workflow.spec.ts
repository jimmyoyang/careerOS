// @vitest-environment node
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { seedAccount } from "./helpers/backupTestDb";
const ctx = await vi.hoisted(async () => {
  const { makeTestDbUrl, pushSchema } = await import("./helpers/backupTestDb");
  const context = makeTestDbUrl();
  const fs = await import("node:fs");
  fs.writeFileSync(context.url.slice(5), "");
  pushSchema(context.url);
  return context;
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    default: new PrismaClient({ datasources: { db: { url: ctx.url } } }),
  };
});
import db from "@/lib/db";
import { collectBackupData, buildBackupZip } from "@/lib/backup/export";
import { importBackup } from "@/lib/backup/import";
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));
import { DraftSchema } from "@/lib/career/contracts";
import { currentInputs } from "@/lib/career/inputs";
import { processNextRun } from "@/lib/career/worker";
import {
  queueCompilation,
  uploadMaterial,
  approveMaterial,
  materialBytes,
  validatePdf,
} from "@/lib/career/materials";
import { createPlan, recordApplication } from "@/lib/career/applications";
import { APP_CONSTANTS } from "@/lib/constants";
import path from "node:path";
import { importJob } from "@/lib/career/jobs";
import { reviseEvidence, confirmedEvidence } from "@/lib/career/evidence";
import { enqueueRun, claimRun, finishRun } from "@/lib/career/runs";
let owner: string;
let stranger: string;
const originalUploads = APP_CONSTANTS.UPLOADS_DIR;
beforeAll(async () => {
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = path.join(
    ctx.dir,
    "uploads",
  );
  owner = await seedAccount(db, "career-owner@example.com");
  stranger = await seedAccount(db, "career-stranger@example.com");
}, 30000);
afterAll(async () => {
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = originalUploads;
  await db.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});
const input = {
  company: "示例公司",
  title: "工程师",
  rawJd: "本科及以上学历\n熟悉 Python",
};
describe("Career persisted workflow", () => {
  it("imports atomically, keeps a missing deadline null, and replays idempotently", async () => {
    const key = randomUUID();
    const first = await importJob(owner, input, key);
    const replay = await importJob(owner, input, key);
    expect(replay.jobId).toBe(first.jobId);
    const job = await db.job.findUniqueOrThrow({
      where: { id: first.jobId },
      include: { stages: true },
    });
    expect(job.dueDate).toBeNull();
    expect(job.stages).toHaveLength(1);
    expect((await collectBackupData(owner)).CareerRun.length).toBeGreaterThan(
      0,
    );
    await expect(
      importJob(owner, { ...input, title: "其他岗位" }, key),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("appends immutable revisions and excludes withdrawn latest revisions", async () => {
    const first = await reviseEvidence(owner, {
      kind: "project",
      title: "项目",
      facts: {
        schemaVersion: 1,
        text: "实现 Python 检索。",
        tags: ["Python"],
        protectedValues: [],
      },
      status: "confirmed",
    });
    const second = await reviseEvidence(owner, {
      evidenceKey: first.evidenceKey,
      expectedRevision: 1,
      kind: "project",
      title: "项目",
      facts: {
        schemaVersion: 1,
        text: "实现 Python 检索与测试。",
        tags: ["Python"],
        protectedValues: [],
      },
      status: "withdrawn",
    });
    expect(second.revision).toBe(2);
    expect(await confirmedEvidence(owner)).toHaveLength(0);
    expect(
      (await db.careerEvidence.findUniqueOrThrow({ where: { id: first.id } }))
        .factsJson,
    ).toContain("实现 Python 检索。");
    await expect(
      reviseEvidence(stranger, {
        evidenceKey: first.evidenceKey,
        expectedRevision: 1,
        kind: "project",
        title: "越权",
        facts: { schemaVersion: 1, text: "x" },
        status: "confirmed",
      }),
    ).rejects.toThrow();
  });
  it("rejects cross-user jobs and rejects an expired worker publishing", async () => {
    const { jobId } = await importJob(owner, input, randomUUID());
    await expect(
      enqueueRun(stranger, jobId, "match", {}, randomUUID()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const run = await enqueueRun(owner, jobId, "match", {}, randomUUID());
    const claimed = await claimRun("test-worker");
    expect(claimed?.id).toBe(run.id);
    await db.careerRun.update({
      where: { id: run.id },
      data: { leaseUntil: new Date(0) },
    });
    await expect(
      finishRun(claimed!, { schemaVersion: 1 }, "succeeded"),
    ).rejects.toMatchObject({ code: "STALE_LEASE" });
    await db.careerRun.update({
      where: { id: run.id },
      data: { status: "cancelled" },
    });
  });
});

it("invalidates input when a resume child changes, without relying on Resume.updatedAt", async () => {
  const { jobId } = await importJob(owner, input, randomUUID());
  const profile = await db.profile.create({ data: { userId: owner } });
  const resume = await db.resume.create({
    data: { profileId: profile.id, title: "源简历" },
  });
  const summary = await db.summary.create({ data: { content: "初始内容" } });
  await db.resumeSection.create({
    data: {
      resumeId: resume.id,
      sectionTitle: "摘要",
      sectionType: "summary",
      summaryId: summary.id,
    },
  });
  await db.job.update({ where: { id: jobId }, data: { resumeId: resume.id } });
  const before = await currentInputs(owner, jobId);
  await db.summary.update({
    where: { id: summary.id },
    data: { content: "子项发生实质修改" },
  });
  expect((await currentInputs(owner, jobId)).inputHash).not.toBe(
    before.inputHash,
  );
});

it("freezes a Chinese PDF, requires preview approval, registers once, and backs up the real workflow", async () => {
  const { jobId } = await importJob(owner, input, randomUUID());
  await reviseEvidence(owner, {
    kind: "project",
    title: "搜索项目",
    facts: {
      schemaVersion: 1,
      text: "使用 Python 完成检索，延迟降低 20%。",
      tags: ["Python"],
      protectedValues: ["20%"],
    },
    status: "confirmed",
  });
  const queued = await enqueueRun(owner, jobId, "tailor", {}, randomUUID());
  await processNextRun("test-worker");
  const tailored = await db.careerRun.findUniqueOrThrow({
    where: { id: queued.id },
  });
  expect(tailored.status).toBe("awaiting_review");
  const draft = JSON.parse(tailored.resultJson!);
  const compilation = await queueCompilation(
    owner,
    queued.id,
    draft.bullets.map((b: object) => ({ ...b, verification: "accepted" })),
    { name: "张三", email: "test@example.com", phone: "" },
    randomUUID(),
  );
  const pdf = fs.readFileSync(
    path.join(process.cwd(), "__tests__/fixtures/career-zh.pdf"),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ tex: "fixed template", pdf: pdf.toString("base64") }),
        { status: 200 },
      ),
    );
  try {
    await processNextRun("test-worker");
  } finally {
    globalThis.fetch = originalFetch;
  }
  const compiled = await db.careerRun.findUniqueOrThrow({
    where: { id: compilation.id },
  });
  expect(compiled.status, compiled.resultJson ?? "").toBe("succeeded");
  const materialId = compiled.materialId!;
  await expect(materialBytes(stranger, materialId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(createPlan(owner, jobId, materialId)).rejects.toMatchObject({
    code: "HUMAN_REQUIRED",
  });
  await approveMaterial(owner, materialId);
  const plan = await createPlan(owner, jobId, materialId);
  const date = new Date().toISOString();
  await recordApplication(owner, plan.runId, plan.reviewHash, date, true);
  await recordApplication(owner, plan.runId, plan.reviewHash, date, true);
  expect(
    await db.careerEvent.count({
      where: { userId: owner, type: "application_recorded" },
    }),
  ).toBe(1);
  expect(
    (await db.job.findUniqueOrThrow({ where: { id: jobId } })).applied,
  ).toBe(true);
  expect((await collectBackupData(owner)).CareerMaterial).toHaveLength(1);
  const loaded = await materialBytes(owner, materialId);
  fs.writeFileSync(loaded.material.file.filePath, "%PDF-tampered");
  await expect(materialBytes(owner, materialId)).rejects.toMatchObject({
    code: "PDF_MISSING",
  });
}, 30000);

it("preserves input hashes and replay IDs after restoring an attached source PDF", async () => {
  const idempotencyKey = randomUUID();
  const { jobId } = await importJob(owner, input, idempotencyKey);
  const profile = await db.profile.create({ data: { userId: owner } });
  const filePath = path.join(
    APP_CONSTANTS.UPLOADS_DIR,
    "files",
    "resumes",
    "source.pdf",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "__tests__/fixtures/career-zh.pdf"),
    filePath,
  );
  const file = await db.file.create({
    data: { fileName: "source.pdf", filePath, fileType: "resume" },
  });
  const resume = await db.resume.create({
    data: { title: "Source", profileId: profile.id, FileId: file.id },
  });
  await db.job.update({ where: { id: jobId }, data: { resumeId: resume.id } });
  const before = await currentInputs(owner, jobId);
  const backup = await buildBackupZip(owner, "career-owner@example.com");
  const restoredOwner = await seedAccount(db, "career-restored@example.com");
  await importBackup(
    backup.buffer,
    restoredOwner,
    "career-restored@example.com",
    false,
  );
  const replay = await importJob(restoredOwner, input, idempotencyKey);
  expect(replay.jobId).not.toBe(jobId);
  expect((await currentInputs(restoredOwner, replay.jobId)).inputHash).toBe(
    before.inputHash,
  );
}, 30000);

it("rejects PDFs larger than the shared backup restore limit", async () => {
  const bytes = Buffer.alloc(APP_CONSTANTS.MAX_RESUME_FILE_SIZE_BYTES + 1);
  bytes.write("%PDF-");
  await expect(validatePdf(bytes)).rejects.toMatchObject({
    code: "COMPILE_FAILED",
  });
});


it("preserves rejected bullets for compilation retries and PDF upload fallback", async () => {
  const userId = await seedAccount(db, "partial-review@example.com");
  const { jobId } = await importJob(userId, input, randomUUID());
  for (const text of ["使用 Python 完成检索，延迟降低 20%。", "完成接口测试。"])
    await reviseEvidence(userId, {
      kind: "project", title: "项目", facts: { schemaVersion: 1, text }, status: "confirmed",
    });
  const run = await enqueueRun(userId, jobId, "tailor", {}, randomUUID());
  await processNextRun("partial-review-worker");
  const tailored = await db.careerRun.findUniqueOrThrow({ where: { id: run.id } });
  const draft = DraftSchema.parse(JSON.parse(tailored.resultJson!));
  expect(draft.bullets).toHaveLength(2);
  const bullets = draft.bullets.map((bullet, index) => ({
    ...bullet, verification: index === 0 ? "accepted" as const : "rejected" as const,
  }));
  const contact = { name: "张三" };
  const key = randomUUID();
  const compilation = await queueCompilation(userId, run.id, bullets, contact, key);
  expect((await queueCompilation(userId, run.id, bullets, contact, key)).id).toBe(compilation.id);
  await db.careerRun.update({ where: { id: compilation.id }, data: { status: "failed" } });
  const retry = await queueCompilation(userId, run.id, bullets, contact, randomUUID());
  expect(retry.id).not.toBe(compilation.id);
  await db.careerRun.update({ where: { id: retry.id }, data: { status: "failed" } });

  const pdf = fs.readFileSync(path.join(process.cwd(), "__tests__/fixtures/career-zh.pdf"));
  const uploadKey = randomUUID();
  const uploaded = await uploadMaterial(userId, run.id, bullets, contact, pdf, uploadKey);
  expect(await uploadMaterial(userId, run.id, bullets, contact, pdf, uploadKey)).toEqual(uploaded);
  const reviewed = await db.careerRun.findUniqueOrThrow({ where: { id: run.id } });
  expect(DraftSchema.parse(JSON.parse(reviewed.resultJson!)).bullets.map(b => b.verification))
    .toEqual(["accepted", "rejected"]);
  const material = await db.careerMaterial.findUniqueOrThrow({ where: { id: uploaded.materialId! } });
  expect(JSON.parse(material.payloadJson).draft.bullets).toHaveLength(1);
}, 30000);
