"use server";
import { z } from "zod";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { getCurrentUser } from "@/utils/user.utils";
import {
  FactsSchema,
  MatchSchema,
  DraftSchema,
  ModelSchema,
  type ImportInput,
  type Preferences,
  type Bullet,
} from "@/lib/career/contracts";
import { CareerError, publicError } from "@/lib/career/errors";
import { importJob, attachJobContext } from "@/lib/career/jobs";
import { parseImportTable } from "@/lib/career/parsing";
import {
  latestEvidence,
  reviseEvidence,
  resumeCandidates,
  getPreferences,
  savePreferences,
} from "@/lib/career/evidence";
import { enqueueRun, cancelRun } from "@/lib/career/runs";
import { currentInputs } from "@/lib/career/inputs";
import {
  queueCompilation,
  uploadMaterial,
  approveMaterial,
} from "@/lib/career/materials";
import { createPlan, recordApplication } from "@/lib/career/applications";
import { transaction } from "@/lib/career/transaction";
import { event } from "@/lib/career/audit";

async function action<T>(operation: (userId: string) => Promise<T>) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new CareerError("UNAUTHORIZED", "请先登录。");
    if (process.env.CAREER_ENABLED === "false")
      throw new CareerError("UNAVAILABLE", "求职工作台未启用。");
    return { ok: true as const, data: await operation(user.id) };
  } catch (error) {
    return { ok: false as const, error: publicError(error) };
  }
}
const keySchema = z.string().min(8).max(120);
const idSchema = z.string().min(1).max(120);
export async function getWorkspaceAction() {
  return action(async (userId) => {
    const [jobs, evidence, resumes, preferences, runs, materialCount] =
      await Promise.all([
        db.job.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: { Company: true, JobTitle: true, careerContext: true },
        }),
        latestEvidence(userId),
        db.resume.findMany({
          where: { profile: { userId } },
          select: { id: true, title: true },
        }),
        getPreferences(userId),
        db.careerRun.findMany({
          where: { userId, kind: { not: "maintenance" } },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
        db.careerMaterial.count({ where: { userId } }),
      ]);
    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.JobTitle.label,
        company: j.Company.label,
        preparationStatus: j.careerContext?.preparationStatus ?? "not_started",
      })),
      evidence: evidence.map((e) => ({
        id: e.id,
        evidenceKey: e.evidenceKey,
        revision: e.revision,
        kind: e.kind,
        title: e.title,
        facts: FactsSchema.parse(JSON.parse(e.factsJson)),
        status: e.status,
        source: String(JSON.parse(e.sourceJson).text ?? ""),
      })),
      resumes,
      preferences,
      runs: runs.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        kind: r.kind,
        status: r.status,
        step: r.step,
        errorCode: r.errorCode,
        createdAt: r.createdAt.toISOString(),
      })),
      materialCount,
    };
  });
}
export async function getPreparationAction(jobId: string) {
  return action(async (userId) => {
    idSchema.parse(jobId);
    const inputs = await currentInputs(userId, jobId);
    const [context, drafts, materials, reviewed] = await Promise.all([
      db.careerJobContext.findUniqueOrThrow({ where: { jobId, userId } }),
      db.careerRun.findMany({
        where: {
          userId,
          jobId,
          kind: "tailor",
          status: { in: ["awaiting_review", "succeeded"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.careerMaterial.findMany({
        where: { userId, jobId },
        orderBy: { createdAt: "desc" },
      }),
      db.careerEvent.findMany({
        where: { userId, type: "material_reviewed" },
        select: { eventKey: true },
      }),
    ]);
    const reviewedKeys = new Set(reviewed.map((event) => event.eventKey));
    const analysis = context.analysisJson
      ? MatchSchema.parse(JSON.parse(context.analysisJson))
      : null;
    return {
      id: jobId,
      title: inputs.snapshot.title,
      company: inputs.snapshot.company,
      rawJd: inputs.snapshot.rawJd,
      inputHash: inputs.inputHash,
      analysis,
      analysisStale: !!analysis && analysis.inputHash !== inputs.inputHash,
      drafts: drafts.map((r) => ({
        id: r.id,
        status: r.status,
        draft: DraftSchema.parse(JSON.parse(r.resultJson!)),
      })),
      materials: materials.map((m) => ({
        id: m.id,
        materialKey: m.materialKey,
        createdAt: m.createdAt.toISOString(),
        approved: reviewedKeys.has(`material-reviewed:${m.materialKey}`),
      })),
    };
  });
}
export async function importJobAction(input: ImportInput, key: string) {
  return action((userId) => importJob(userId, input, keySchema.parse(key)));
}
export async function parseTableAction(text: string) {
  return action(async () =>
    parseImportTable(z.string().max(1_000_000).parse(text)),
  );
}
export async function reviseEvidenceAction(
  input: Parameters<typeof reviseEvidence>[1],
) {
  return action((userId) => reviseEvidence(userId, input));
}
export async function resumeCandidatesAction(resumeId: string) {
  return action((userId) => resumeCandidates(userId, idSchema.parse(resumeId)));
}
export async function savePreferencesAction(input: Preferences) {
  return action((userId) => savePreferences(userId, input));
}
export async function attachJobAction(jobId: string) {
  return action((userId) => attachJobContext(userId, idSchema.parse(jobId)));
}
export async function enqueueAction(
  jobId: string,
  kind: "match" | "tailor",
  options: Record<string, unknown>,
  key: string,
) {
  return action(async (userId) => {
    z.enum(["match", "tailor"]).parse(kind);
    const safe = z
      .object({
        evidenceKeys: z.array(z.string().max(120)).max(40).optional(),
        ai: ModelSchema.optional(),
      })
      .strict()
      .parse(options);
    const run = await enqueueRun(
      userId,
      idSchema.parse(jobId),
      kind,
      safe,
      keySchema.parse(key),
    );
    if (safe.ai)
      await transaction((tx) =>
        event(
          tx,
          userId,
          "external_model_approved",
          {
            provider: safe.ai!.provider,
            model: safe.ai!.model,
            requestHash: run.requestHash,
          },
          run.operationKey,
        ).then(() => {}),
      );
    return { id: run.id, status: run.status };
  });
}
export async function acceptDraftAction(
  runId: string,
  bullets: Bullet[],
  contact: { name: string; email?: string; phone?: string },
  key: string,
) {
  return action((userId) =>
    queueCompilation(
      userId,
      idSchema.parse(runId),
      bullets,
      contact,
      keySchema.parse(key),
    ),
  );
}
export async function uploadMaterialAction(form: FormData) {
  return action(async (userId) => {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > APP_CONSTANTS.MAX_RESUME_FILE_SIZE_BYTES
    )
      throw new CareerError("INVALID_INPUT", "请选择不超过 5 MiB 的 PDF。");
    return uploadMaterial(
      userId,
      idSchema.parse(form.get("runId")),
      JSON.parse(String(form.get("bullets"))),
      JSON.parse(String(form.get("contact"))),
      Buffer.from(await file.arrayBuffer()),
      keySchema.parse(form.get("key")),
    );
  });
}
export async function approveMaterialAction(materialId: string) {
  return action((userId) =>
    approveMaterial(userId, idSchema.parse(materialId)),
  );
}
export async function createPlanAction(jobId: string, materialId: string) {
  return action((userId) =>
    createPlan(userId, idSchema.parse(jobId), idSchema.parse(materialId)),
  );
}
export async function recordApplicationAction(
  runId: string,
  reviewHash: string,
  occurredAt: string,
  confirmed: boolean,
) {
  return action((userId) =>
    recordApplication(
      userId,
      idSchema.parse(runId),
      z.string().length(64).parse(reviewHash),
      occurredAt,
      confirmed,
    ),
  );
}
export async function cancelRunAction(runId: string) {
  return action((userId) => cancelRun(userId, idSchema.parse(runId)));
}
