import { randomUUID } from "node:crypto";
import type { CareerRun, Prisma } from "@prisma/client";
import db from "@/lib/db";
import { CareerError } from "./errors";
import { hash } from "./hash";
import { transaction } from "./transaction";
import { assertNoMaintenance } from "./maintenance";
import { currentInputs } from "./inputs";
import { event } from "./audit";

export const ACTIVE_STATUSES = [
  "queued",
  "running",
  "awaiting_review",
  "awaiting_human",
  "awaiting_receipt",
];
const LEASE_MS = 180000;
export async function enqueueRun(
  userId: string,
  jobId: string,
  kind: "parse" | "match" | "tailor" | "compile",
  options: Record<string, unknown>,
  idempotencyKey: string,
) {
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const inputs = await currentInputs(userId, jobId, tx);
    const requestHash = hash({
      kind,
      jobId,
      options,
      inputHash: inputs.inputHash,
    });
    const previous = await tx.careerRun.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new CareerError(
          "IDEMPOTENCY_CONFLICT",
          "请求内容已改变，请重新发起。",
        );
      return previous;
    }
    const active = await tx.careerRun.findFirst({
      where: {
        userId,
        jobId,
        kind: { in: ["parse", "match", "tailor", "compile"] },
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (active)
      throw new CareerError(
        "BUSY",
        "该岗位有待处理任务，请先完成或取消。",
        true,
      );
    return tx.careerRun.create({
      data: {
        userId,
        jobId,
        kind,
        step: kind,
        status: "queued",
        operationKey: randomUUID(),
        idempotencyKey,
        requestHash,
        inputJson: JSON.stringify({ schemaVersion: 1, ...inputs, options }),
      },
    });
  });
}

export async function claimRun(worker: string): Promise<CareerRun | null> {
  return transaction(async (tx) => {
    const now = new Date();
    // Only side-effect-free tasks can be replayed after a process disappears.
    await tx.careerRun.updateMany({
      where: {
        status: "running",
        leaseUntil: { lt: now },
        kind: "application",
      },
      data: {
        status: "needs_verification",
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
        errorCode: "SUBMISSION_UNCERTAIN",
      },
    });
    await tx.careerRun.updateMany({
      where: {
        status: "running",
        leaseUntil: { lt: now },
        kind: { in: ["parse", "match", "tailor", "compile"] },
        attempts: { lt: 3 },
      },
      data: {
        status: "queued",
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
      },
    });
    await tx.careerRun.updateMany({
      where: {
        status: "running",
        leaseUntil: { lt: now },
        kind: { in: ["parse", "match", "tailor", "compile"] },
        attempts: { gte: 3 },
      },
      data: {
        status: "failed",
        errorCode: "RETRY_EXHAUSTED",
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
      },
    });
    if (
      await tx.careerRun.count({
        where: {
          status: "running",
          kind: { in: ["parse", "match", "tailor", "compile"] },
          leaseUntil: { gt: now },
        },
      })
    )
      return null;
    const queued = await tx.careerRun.findMany({
      where: {
        status: "queued",
        kind: { in: ["parse", "match", "tailor", "compile"] },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const run of queued) {
      const maintenance = await tx.careerRun.findFirst({
        where: {
          userId: run.userId,
          kind: "maintenance",
          status: "running",
          leaseUntil: { gt: now },
        },
      });
      if (maintenance) continue;
      await assertNoMaintenance(tx, run.userId);
      const changed = await tx.careerRun.updateMany({
        where: { id: run.id, status: "queued", version: run.version },
        data: {
          status: "running",
          leaseOwner: worker,
          leaseUntil: new Date(Date.now() + LEASE_MS),
          attempts: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (changed.count)
        return tx.careerRun.findUnique({ where: { id: run.id } });
    }
    return null;
  });
}
export async function finishRun(
  run: CareerRun,
  result: Record<string, unknown>,
  status: "succeeded" | "awaiting_review",
  publish?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  return transaction(async (tx) => {
    const live = await tx.careerRun.findFirst({
      where: {
        id: run.id,
        userId: run.userId,
        status: "running",
        leaseOwner: run.leaseOwner,
        version: run.version,
        leaseUntil: { gt: new Date() },
      },
    });
    if (!live) throw new CareerError("STALE_LEASE", "任务租约已过期。");
    if (!run.jobId) throw new CareerError("NOT_FOUND", "任务岗位已不存在。");
    const input = JSON.parse(run.inputJson);
    if (
      (await currentInputs(run.userId, run.jobId, tx)).inputHash !==
      input.inputHash
    )
      throw new CareerError("STALE_INPUT", "岗位或事实已变化，请重新生成。");
    if (publish) await publish(tx);
    return tx.careerRun.update({
      where: { id: run.id },
      data: {
        status,
        resultJson: JSON.stringify(result),
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
        step: status === "awaiting_review" ? "review" : "done",
      },
    });
  });
}
export async function cancelRun(userId: string, runId: string) {
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const changed = await tx.careerRun.updateMany({
      where: {
        id: runId,
        userId,
        kind: { not: "maintenance" },
        status: {
          in: ["queued", "running", "awaiting_review", "awaiting_human"],
        },
      },
      data: {
        status: "cancelled",
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new CareerError("NOT_FOUND", "任务不存在或已结束。");
    await event(tx, userId, "run_cancelled", { runKey: runId });
  });
}
