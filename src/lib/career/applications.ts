import { randomUUID } from "node:crypto";
import { z } from "zod";
import db from "@/lib/db";
import {
  resolveJobStatus,
  resolveStageTypeForStatusId,
} from "@/lib/jobs/resolve";
import { appendStatusStage } from "@/actions/job/shared";
import { jobFieldsForStage } from "@/actions/jobStage/shared";
import { materialBytes } from "./materials";
import { currentInputs } from "./inputs";
import { CareerError } from "./errors";
import { hash } from "./hash";
import { transaction } from "./transaction";
import { assertNoMaintenance } from "./maintenance";
import { event } from "./audit";

export async function createPlan(
  userId: string,
  jobId: string,
  materialId: string,
) {
  const { material } = await materialBytes(userId, materialId);
  if (material.jobId !== jobId)
    throw new CareerError("NOT_FOUND", "材料不属于该岗位。");
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const reviewed = await tx.careerEvent.findUnique({
      where: {
        userId_eventKey: {
          userId,
          eventKey: `material-reviewed:${material.materialKey}`,
        },
      },
    });
    if (!reviewed)
      throw new CareerError("HUMAN_REQUIRED", "请先预览并确认 PDF 材料。");
    const inputs = await currentInputs(userId, jobId, tx);
    const payload = JSON.parse(material.payloadJson);
    if (payload.inputHash !== inputs.inputHash)
      throw new CareerError(
        "STALE_INPUT",
        "岗位、资料或事实已变化，请重新生成材料。",
      );
    const summary = {
      company: inputs.snapshot.company,
      title: inputs.snapshot.title,
      location: inputs.snapshot.location,
      cohort: inputs.snapshot.cohort,
      platform: inputs.snapshot.platform,
      referral: String(inputs.snapshot.referral.value ?? ""),
      postingKey: inputs.snapshot.postingKey,
      materialKey: material.materialKey,
      pdfHash: material.pdfHash,
      policy: "unknown" as const,
    };
    const reviewHash = hash({ summary, inputHash: inputs.inputHash });
    const existing = await tx.careerRun.findFirst({
      where: {
        userId,
        jobId,
        materialId,
        kind: "application",
        requestHash: reviewHash,
        status: "awaiting_human",
      },
    });
    if (existing) return { runId: existing.id, reviewHash, summary };
    const key = randomUUID();
    const run = await tx.careerRun.create({
      data: {
        userId,
        jobId,
        materialId,
        kind: "application",
        step: "manual_submission",
        status: "awaiting_human",
        operationKey: key,
        idempotencyKey: key,
        requestHash: reviewHash,
        inputJson: JSON.stringify({
          schemaVersion: 1,
          inputHash: inputs.inputHash,
          reviewHash,
          summary,
        }),
      },
    });
    await event(
      tx,
      userId,
      "application_plan_created",
      { reviewHash, materialKey: material.materialKey },
      key,
    );
    return { runId: run.id, reviewHash, summary };
  });
}
export async function recordApplication(
  userId: string,
  runId: string,
  reviewHash: string,
  occurredAt: string,
  confirmed: boolean,
) {
  if (confirmed !== true)
    throw new CareerError(
      "HUMAN_REQUIRED",
      "请确认你已在招聘网站完成最终投递。",
    );
  const date = z.coerce.date().parse(occurredAt);
  if (
    date.getTime() > Date.now() + 60000 ||
    date.getTime() < new Date("2000-01-01").getTime()
  )
    throw new CareerError("INVALID_INPUT", "请填写有效的实际投递时间。");
  const run = await db.careerRun.findFirst({
    where: { id: runId, userId, kind: "application" },
  });
  if (!run?.jobId || !run.materialId)
    throw new CareerError("NOT_FOUND", "找不到该投递计划。");
  const { material } = await materialBytes(userId, run.materialId);
  const statusId = await resolveJobStatus("applied");
  const stageTypeId = await resolveStageTypeForStatusId(statusId, userId);
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const live = await tx.careerRun.findFirst({ where: { id: runId, userId } });
    if (!live || live.requestHash !== reviewHash)
      throw new CareerError("STALE_INPUT", "投递摘要已失效。");
    if (live.status === "succeeded") return { recorded: true };
    if (!["awaiting_human", "needs_verification"].includes(live.status))
      throw new CareerError("STALE_INPUT", "投递计划状态已改变。");
    const plan = JSON.parse(live.inputJson);
    const inputs = await currentInputs(userId, run.jobId!, tx);
    if (
      plan.inputHash !== inputs.inputHash ||
      plan.summary.pdfHash !== material.pdfHash ||
      hash({ summary: plan.summary, inputHash: inputs.inputHash }) !==
        reviewHash
    )
      throw new CareerError(
        "STALE_INPUT",
        "岗位或事实已变化，请重新核对投递计划。",
      );
    await event(
      tx,
      userId,
      "application_recorded",
      {
        reviewHash,
        materialKey: material.materialKey,
        confirmation: "user_reported",
        occurredAt: date.toISOString(),
      },
      run.operationKey,
      `application-recorded:${run.operationKey}`,
    );
    await appendStatusStage(tx, run.jobId!, statusId, stageTypeId, userId);
    await tx.jobStage.updateMany({
      where: {
        jobId: run.jobId!,
        isCurrent: true,
        stageTypeId,
        Job: { userId },
      },
      data: { occurredAt: date },
    });
    const job = await tx.job.findFirstOrThrow({
      where: { id: run.jobId!, userId },
    });
    await tx.job.update({
      where: { id: job.id, userId },
      data: jobFieldsForStage("applied", statusId, date, job.appliedDate),
    });
    await tx.careerRun.update({
      where: { id: runId, userId },
      data: {
        status: "succeeded",
        step: "recorded",
        resultJson: JSON.stringify({
          schemaVersion: 1,
          confirmation: "user_reported",
          materialKey: material.materialKey,
          occurredAt: date.toISOString(),
        }),
        version: { increment: 1 },
      },
    });
    return { recorded: true };
  });
}
