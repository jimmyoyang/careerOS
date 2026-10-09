import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { resumesDir, isResumeFilePath } from "@/lib/resumeFiles";
import { ContactSchema, DraftSchema, type Bullet } from "./contracts";
import { hash } from "./hash";
import { CareerError } from "./errors";
import { currentInputs, type CareerInputs } from "./inputs";
import { validateTailoring } from "./matching";
import { transaction } from "./transaction";
import { assertNoMaintenance } from "./maintenance";
import { event } from "./audit";
import { finishRun } from "./runs";
import type { CareerRun, Prisma } from "@prisma/client";

type Contact = { name: string; email?: string; phone?: string };
export async function acceptedDraft(
  userId: string,
  runId: string,
  bullets: Bullet[],
  contactInput: Contact,
) {
  const run = await db.careerRun.findFirst({
    where: {
      id: runId,
      userId,
      kind: "tailor",
      status: { in: ["awaiting_review", "succeeded"] },
    },
  });
  if (!run?.jobId) throw new CareerError("NOT_FOUND", "找不到待审核改写。");
  const original = DraftSchema.parse(JSON.parse(run.resultJson!));
  const inputs = await currentInputs(userId, run.jobId);
  if (inputs.inputHash !== original.inputHash)
    throw new CareerError("STALE_INPUT", "事实或岗位已更新，请重新生成改写。");
  const draft = DraftSchema.parse({ ...original, bullets });
  if (
    draft.bullets.length !== original.bullets.length ||
    new Set(draft.bullets.map((b) => b.bulletKey)).size !==
      original.bullets.length
  )
    throw new CareerError("INVALID_INPUT", "请审核全部改写。");
  for (const bullet of draft.bullets) {
    const old = original.bullets.find((b) => b.bulletKey === bullet.bulletKey);
    if (
      !old ||
      hash(old.evidence) !== hash(bullet.evidence) ||
      old.original !== bullet.original ||
      hash(old.requirementKeys) !== hash(bullet.requirementKeys) ||
      bullet.verification === "needs_review"
    )
      throw new CareerError(
        "INVALID_INPUT",
        "事实引用不能更改，且每条改写必须接受或拒绝。",
      );
  }
  const accepted = draft.bullets.filter((b) => b.verification === "accepted");
  if (!accepted.length)
    throw new CareerError("INVALID_INPUT", "至少接受一条经历。");
  validateTailoring(accepted, inputs.snapshot.evidence);
  return {
    run,
    reviewedDraft: draft,
    draft: { ...draft, bullets: accepted },
    contact: ContactSchema.parse(contactInput),
    inputs,
  };
}

export async function queueCompilation(
  userId: string,
  runId: string,
  bullets: Bullet[],
  contact: Contact,
  idempotencyKey: string,
) {
  const accepted = await acceptedDraft(userId, runId, bullets, contact);
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const requestHash = hash({
      runId,
      draft: accepted.draft,
      contact: accepted.contact,
    });
    const old = await tx.careerRun.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (old) {
      if (old.requestHash !== requestHash)
        throw new CareerError(
          "IDEMPOTENCY_CONFLICT",
          "请求标识已用于另一材料。",
        );
      return old;
    }
    if (
      (await currentInputs(userId, accepted.run.jobId!, tx)).inputHash !==
      accepted.inputs.inputHash
    )
      throw new CareerError("STALE_INPUT", "事实已更新。");
    const approved = await tx.careerRun.updateMany({
      where: {
        id: runId,
        userId,
        status: { in: ["awaiting_review", "succeeded"] },
      },
      data: {
        status: "succeeded",
        step: "accepted",
        resultJson: JSON.stringify(accepted.reviewedDraft),
        version: { increment: 1 },
      },
    });
    if (!approved.count)
      throw new CareerError("STALE_INPUT", "改写状态已变化。");
    const run = await tx.careerRun.create({
      data: {
        userId,
        jobId: accepted.run.jobId,
        kind: "compile",
        step: "compile",
        status: "queued",
        operationKey: randomUUID(),
        idempotencyKey,
        requestHash,
        inputJson: JSON.stringify({
          schemaVersion: 1,
          ...accepted.inputs,
          options: { draft: accepted.draft, contact: accepted.contact },
        }),
      },
    });
    await event(
      tx,
      userId,
      "tailoring_accepted",
      { inputHash: accepted.inputs.inputHash, draftHash: hash(accepted.draft) },
      run.operationKey,
    );
    return run;
  });
}

export async function validatePdf(
  bytes: Buffer,
  expected?: { name: string; texts: string[] },
) {
  if (
    bytes.length > APP_CONSTANTS.MAX_RESUME_FILE_SIZE_BYTES ||
    !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
  )
    throw new CareerError(
      "COMPILE_FAILED",
      "文件必须是有效的 PDF，最大 5 MiB。",
    );
  const pdfjsRoot = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  const pdf = await getDocumentProxy(new Uint8Array(bytes), {
    cMapUrl: path.join(pdfjsRoot, "cmaps") + path.sep,
    cMapPacked: true,
    isEvalSupported: false,
  });
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    if (totalPages !== 1)
      throw new CareerError(
        "COMPILE_FAILED",
        "当前模板要求一页，请精简内容后重试，或上传一页 PDF。",
      );
    if (!text.trim())
      throw new CareerError(
        "COMPILE_FAILED",
        "PDF 没有可提取文本，请使用文字版 PDF。",
      );
    const normalize = (value: string) => value.replace(/\s+/g, "");
    const extracted = normalize(text);
    if (
      expected &&
      [expected.name, ...expected.texts].some(
        (value) => !extracted.includes(normalize(value)),
      )
    )
      throw new CareerError("COMPILE_FAILED", "PDF 文本与已确认材料不一致。");
  } finally {
    await pdf.destroy();
  }
}

async function stagePdf(bytes: Buffer) {
  const directory = resumesDir();
  await fs.mkdir(directory, { recursive: true });
  const materialKey = randomUUID();
  const filePath = path.join(directory, `career-${materialKey}.pdf`);
  const temporary = `${filePath}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
  return { filePath, materialKey };
}

async function persistMaterial(
  tx: Prisma.TransactionClient,
  userId: string,
  jobId: string,
  staged: Awaited<ReturnType<typeof stagePdf>>,
  payload: Record<string, unknown>,
  texSource: string,
  pdfHash: string,
  sourceResumeId: string | null,
) {
  const file = await tx.file.create({
    data: {
      fileName: `CareerOS-${staged.materialKey}.pdf`,
      filePath: staged.filePath,
      fileType: "application/pdf",
    },
  });
  const material = await tx.careerMaterial.create({
    data: {
      userId,
      jobId,
      sourceResumeId,
      fileId: file.id,
      materialKey: staged.materialKey,
      payloadJson: JSON.stringify(payload),
      payloadHash: hash(payload),
      texSource,
      pdfHash,
    },
  });
  await tx.careerJobContext.update({
    where: { jobId, userId },
    data: { preparationStatus: "material_ready" },
  });
  await event(tx, userId, "material_frozen", {
    materialKey: material.materialKey,
    payloadHash: material.payloadHash,
    pdfHash,
  });
  return material;
}

export async function compileMaterial(run: CareerRun) {
  const input = JSON.parse(run.inputJson) as CareerInputs & {
    options: { draft: unknown; contact: unknown };
  };
  const draft = DraftSchema.parse(input.options.draft);
  const contact = ContactSchema.parse(input.options.contact);
  validateTailoring(draft.bullets, input.snapshot.evidence);
  const blocks = draft.bullets.map((b) => ({
    title:
      input.snapshot.evidence.find(
        (e) => e.evidenceKey === b.evidence[0].evidenceKey,
      )?.title ?? "经历",
    text: b.proposed,
  }));
  const endpoint = process.env.CAREER_LATEX_URL || "http://127.0.0.1:3738";
  const response = await fetch(`${endpoint}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateVersion: "zh-single-page-v1",
      contact,
      blocks,
    }),
    signal: AbortSignal.timeout(65000),
  });
  if (!response.ok)
    throw new CareerError(
      "COMPILE_FAILED",
      "PDF 编译或排版未通过，请精简内容重试，或上传已有 PDF。",
      true,
    );
  const result = (await response.json()) as { tex: string; pdf: string };
  if (
    typeof result.pdf !== "string" ||
    result.pdf.length > 14_000_000 ||
    typeof result.tex !== "string"
  )
    throw new CareerError("COMPILE_FAILED", "编译服务返回无效文件。");
  const bytes = Buffer.from(result.pdf, "base64");
  await validatePdf(bytes, {
    name: contact.name,
    texts: blocks.map((b) => b.text),
  });
  const staged = await stagePdf(bytes);
  const payload = {
    schemaVersion: 1,
    ...input,
    contact,
    draft,
    templateVersion: "zh-single-page-v1",
    origin: "compiled",
    verification: "text_verified",
    model: draft.model,
  };
  try {
    await finishRun(
      run,
      { schemaVersion: 1, materialKey: staged.materialKey },
      "succeeded",
      async (tx) => {
        const material = await persistMaterial(
          tx,
          run.userId,
          run.jobId!,
          staged,
          payload,
          result.tex,
          hash(bytes),
          (
            await tx.job.findFirstOrThrow({
              where: { id: run.jobId!, userId: run.userId },
              select: { resumeId: true },
            })
          ).resumeId,
        );
        await tx.careerRun.update({
          where: { id: run.id },
          data: { materialId: material.id },
        });
      },
    );
  } catch (error) {
    await fs.unlink(staged.filePath).catch(() => {});
    throw error;
  }
}

export async function uploadMaterial(
  userId: string,
  runId: string,
  bullets: Bullet[],
  contact: Contact,
  bytes: Buffer,
  idempotencyKey: string,
) {
  const accepted = await acceptedDraft(userId, runId, bullets, contact);
  await validatePdf(bytes);
  const pdfHash = hash(bytes);
  const requestHash = hash({
    runId,
    draft: accepted.draft,
    contact: accepted.contact,
    pdfHash,
  });
  const staged = await stagePdf(bytes);
  let retained = false;
  try {
    return await transaction(async (tx) => {
      await assertNoMaintenance(tx, userId);
      const old = await tx.careerRun.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (old) {
        if (old.requestHash !== requestHash)
          throw new CareerError("IDEMPOTENCY_CONFLICT", "请求内容已变化。");
        return { schemaVersion: 1, materialId: old.materialId };
      }
      if (
        (await currentInputs(userId, accepted.run.jobId!, tx)).inputHash !==
        accepted.inputs.inputHash
      )
        throw new CareerError("STALE_INPUT", "事实已变化。");
      const material = await persistMaterial(
        tx,
        userId,
        accepted.run.jobId!,
        staged,
        {
          schemaVersion: 1,
          ...accepted.inputs,
          draft: accepted.draft,
          contact: accepted.contact,
          origin: "user_upload",
          verification: "not_text_verified",
          templateVersion: "user-provided",
        },
        "",
        pdfHash,
        (
          await tx.job.findFirstOrThrow({
            where: { id: accepted.run.jobId!, userId },
            select: { resumeId: true },
          })
        ).resumeId,
      );
      await tx.careerRun.update({
        where: { id: runId, userId },
        data: {
          status: "succeeded",
          step: "accepted",
          resultJson: JSON.stringify(accepted.reviewedDraft),
        },
      });
      const result = { schemaVersion: 1, materialId: material.id };
      await tx.careerRun.create({
        data: {
          userId,
          jobId: material.jobId,
          materialId: material.id,
          operationKey: randomUUID(),
          idempotencyKey,
          kind: "compile",
          step: "uploaded",
          status: "succeeded",
          requestHash,
          inputJson: JSON.stringify({ schemaVersion: 1 }),
          resultJson: JSON.stringify(result),
        },
      });
      retained = true;
      return result;
    });
  } catch (error) {
    retained = false;
    throw error;
  } finally {
    if (!retained) await fs.unlink(staged.filePath).catch(() => {});
  }
}

export async function materialBytes(userId: string, materialId: string) {
  const material = await db.careerMaterial.findFirst({
    where: { id: materialId, userId },
    include: { file: true },
  });
  if (!material || !isResumeFilePath(material.file.filePath))
    throw new CareerError("NOT_FOUND", "找不到该材料。");
  const bytes = await fs.readFile(material.file.filePath).catch(() => {
    throw new CareerError(
      "PDF_MISSING",
      "材料文件缺失，请从备份恢复或生成新材料。",
    );
  });
  if (hash(bytes) !== material.pdfHash)
    throw new CareerError("PDF_MISSING", "材料文件校验失败，请从备份恢复。");
  return { material, bytes };
}

export async function approveMaterial(userId: string, materialId: string) {
  const { material } = await materialBytes(userId, materialId);
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const key = `material-reviewed:${material.materialKey}`;
    const exists = await tx.careerEvent.findUnique({
      where: { userId_eventKey: { userId, eventKey: key } },
    });
    if (exists) return;
    await event(
      tx,
      userId,
      "material_reviewed",
      { materialKey: material.materialKey, pdfHash: material.pdfHash },
      undefined,
      key,
    );
  });
}
