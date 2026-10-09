// @vitest-environment node
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { APP_CONSTANTS } from "@/lib/constants";
import { buildBackupZip } from "@/lib/backup/export";
import { importBackup } from "@/lib/backup/import";
import { seedAccount } from "./helpers/backupTestDb";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("./helpers/backupTestDb");
  const { execFileSync } = await import("child_process");
  const { url, dir } = helpers.makeTestDbUrl();
  const fs = await import("fs");
  fs.writeFileSync(url.slice(5), "");
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  return { url, dir };
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));
const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
const json = JSON.stringify({ schemaVersion: 1 });
const originalUploads = APP_CONSTANTS.UPLOADS_DIR;
let userId: string;
let otherUser: string;
let jobId: string;
let materialId: string;

beforeAll(async () => {
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = path.join(ctx.dir, "uploads");
  userId = await seedAccount(prisma, "career-owner@example.com");
  otherUser = await seedAccount(prisma, "other@example.com");
  const company = await prisma.company.create({ data: { createdBy: userId, label: "Acme", value: "acme" } });
  const title = await prisma.jobTitle.create({ data: { createdBy: userId, label: "Engineer", value: "engineer" } });
  const status = await prisma.jobStatus.findFirstOrThrow();
  const job = await prisma.job.create({ data: { userId, companyId: company.id, jobTitleId: title.id, statusId: status.id, description: "JD", jobType: "full-time", createdAt: new Date() } });
  jobId = job.id;
  await prisma.careerJobContext.create({ data: { userId, jobId, platform: "manual", recruitmentType: "campus", cohort: "2027", rawJd: "JD", rawJdHash: "jd", sourcesJson: json, requirementsJson: json } });
  await prisma.careerEvidence.create({ data: { userId, evidenceKey: "project-a", kind: "project", title: "Project", factsJson: json, protectedPathsJson: json, sourceJson: json, status: "confirmed", contentHash: "facts" } });
  const file = await prisma.file.create({ data: { fileName: "frozen.pdf", filePath: path.join(APP_CONSTANTS.UPLOADS_DIR, "files/resumes/missing.pdf"), fileType: "application/pdf" } });
  const material = await prisma.careerMaterial.create({ data: { userId, materialKey: "frozen-v1", jobId, fileId: file.id, payloadJson: json, texSource: "source", payloadHash: "payload", pdfHash: "pdf" } });
  materialId = material.id;
}, 120_000);

afterAll(async () => {
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = originalUploads;
  await prisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

async function createRun(kind: string, status = "queued", extra: Record<string, unknown> = {}) {
  return prisma.careerRun.create({ data: { userId, operationKey: randomUUID(), idempotencyKey: randomUUID(), jobId, materialId, kind, step: "start", status, requestHash: "hash", inputJson: json, ...extra } });
}

describe("Career backup restoration", () => {
  it("enforces migrated active job, account and maintenance uniqueness", async () => {
    const parse = await createRun("parse");
    await expect(createRun("match")).rejects.toMatchObject({ code: "P2002" });
    await prisma.careerRun.delete({ where: { id: parse.id } });
    const application = await createRun("application", "awaiting_receipt", { accountLockKey: "site:account" });
    await expect(createRun("application", "queued", { accountLockKey: "site:account" })).rejects.toMatchObject({ code: "P2002" });
    await prisma.careerRun.delete({ where: { id: application.id } });
    const maintenance = await createRun("maintenance", "running");
    await expect(createRun("maintenance", "running")).rejects.toMatchObject({ code: "P2002" });
    await prisma.careerRun.delete({ where: { id: maintenance.id } });
  });

  it("preserves frozen files and logical keys, resets runs, and rewrites owners on restore", async () => {
    await createRun("parse", "queued", { leaseOwner: "old-worker", leaseUntil: new Date(Date.now() + 60_000) });
    await createRun("application", "awaiting_receipt", { accountLockKey: "site:account" });
    const maintenance = await createRun("maintenance", "succeeded");
    const { buffer } = await buildBackupZip(userId, "career-owner@example.com");
    const zip = await JSZip.loadAsync(buffer);
    const data = JSON.parse(await zip.file("data.json")!.async("string"));
    expect(data.CareerRun).toHaveLength(2);
    expect(data.File).toHaveLength(1);
    expect(data.File[0].fileMissing).toBe(true);
    const imported = await importBackup(buffer, otherUser, "other@example.com", false);
    expect(imported.counts.CareerMaterial).toBe(1);
    const restored = await prisma.careerMaterial.findFirstOrThrow({ where: { userId: otherUser }, include: { file: true, job: true } });
    expect(restored.materialKey).toBe("frozen-v1");
    expect(restored.payloadJson).toBe(json);
    expect(restored.job.userId).toBe(otherUser);
    expect(restored.file.id).not.toBe(data.File[0].id);
    expect(fs.existsSync(restored.file.filePath)).toBe(false);
    const runs = await prisma.careerRun.findMany({ where: { userId: otherUser, kind: { not: "maintenance" } } });
    expect(runs.find((run) => run.kind === "parse")?.status).toBe("interrupted");
    expect(runs.find((run) => run.kind === "application")?.status).toBe("needs_verification");
    expect(runs.every((run) => run.leaseOwner === null && run.leaseUntil === null)).toBe(true);
    await prisma.careerRun.delete({ where: { id: maintenance.id } });
    // A second restore removes the first frozen File row, even after its owner
    // relation has been deleted by the dependency-ordered wipe.
    const oldFileId = restored.fileId;
    await importBackup(buffer, otherUser, "other@example.com", true);
    expect(await prisma.file.findUnique({ where: { id: oldFileId } })).toBeNull();
  }, 120_000);

  it("rejects a running worker without changing target data", async () => {
    const { buffer } = await buildBackupZip(userId, "career-owner@example.com");
    const running = await createRun("import", "running");
    await expect(importBackup(buffer, userId, "career-owner@example.com", true)).rejects.toThrow(/progress|running/i);
    expect(await prisma.careerMaterial.findUnique({ where: { id: materialId } })).not.toBeNull();
    await prisma.careerRun.delete({ where: { id: running.id } });
  });

  it("holds an owner maintenance lease across the callback and releases it on failure", async () => {
    const { withMaintenanceLease, assertNoMaintenance } = await import("@/lib/career/maintenance");
    await expect(withMaintenanceLease(otherUser, async () => {
      await expect(prisma.$transaction((tx) => assertNoMaintenance(tx, otherUser))).rejects.toThrow(/maintenance|restor/i);
      await expect(withMaintenanceLease(otherUser, async () => undefined)).rejects.toThrow(/maintenance|restor/i);
      throw new Error("restore failed");
    })).rejects.toThrow("restore failed");
    expect(await prisma.careerRun.count({ where: { userId: otherUser, kind: "maintenance", status: "running" } })).toBe(0);
    await expect(prisma.$transaction((tx) => assertNoMaintenance(tx, otherUser))).resolves.toBeUndefined();
    expect(await prisma.careerEvent.count({ where: { userId: otherUser, type: "backup.restore_failed" } })).toBe(1);
  });


  it("rejects a foreign key pointing to the wrong backup group before wiping", async () => {
    const { buffer } = await buildBackupZip(userId, "career-owner@example.com");
    const zip = await JSZip.loadAsync(buffer);
    const data = JSON.parse(await zip.file("data.json")!.async("string"));
    data.CareerMaterial[0].fileId = data.CareerEvidence[0].id;
    zip.file("data.json", JSON.stringify(data));
    await expect(importBackup(await zip.generateAsync({ type: "nodebuffer" }), otherUser, "other@example.com", true)).rejects.toThrow(/CareerMaterial.fileId/);
    expect(await prisma.careerMaterial.count({ where: { userId: otherUser } })).toBe(1);
  });


  it("fences a restore after its maintenance lease expires", async () => {
    const { withMaintenanceLease } = await import("@/lib/career/maintenance");
    await expect(withMaintenanceLease(otherUser, async (assertLease) => {
      await prisma.careerRun.updateMany({ where: { userId: otherUser, kind: "maintenance", status: "running" }, data: { leaseUntil: new Date(0) } });
      await prisma.$transaction((tx) => assertLease(tx));
    })).rejects.toThrow(/lease.*expired/i);
  });

});
