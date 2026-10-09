import { randomUUID } from "node:crypto";
import db from "@/lib/db";
import { buildJobCreateData } from "@/lib/jobs/createJobRecord";
import {
  resolveCompany,
  resolveJobTitle,
  resolveJobStatus,
  resolveLocation,
} from "@/lib/jobs/resolve";
import { ImportSchema, type ImportInput } from "./contracts";
import { hash } from "./hash";
import { parseJd, postingKey } from "./parsing";
import { CareerError } from "./errors";
import { transaction } from "./transaction";
import { assertNoMaintenance } from "./maintenance";
import { event } from "./audit";
import { ownedJob } from "./access";

export async function importJob(
  userId: string,
  input: ImportInput,
  idempotencyKey: string,
): Promise<{ jobId: string; duplicate: boolean }> {
  const data = ImportSchema.parse(input);
  const requestHash = hash(data);
  const previous = await db.careerRun.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
  if (previous) {
    if (previous.requestHash !== requestHash || previous.kind !== "import")
      throw new CareerError(
        "IDEMPOTENCY_CONFLICT",
        "同一请求标识不能用于不同的导入内容。",
      );
    if (!previous.jobId)
      throw new CareerError("NOT_FOUND", "原导入岗位已删除。");
    return {
      jobId: previous.jobId,
      duplicate: Boolean(JSON.parse(previous.resultJson!).duplicate),
    };
  }
  const [company, title, statusId, location] = await Promise.all([
    resolveCompany(data.company, userId),
    resolveJobTitle(data.title, userId),
    resolveJobStatus("draft"),
    data.location ? resolveLocation(data.location, userId) : null,
  ]);
  const fields = await buildJobCreateData({
    companyId: company.id,
    jobTitleId: title.id,
    statusId,
    locationId: location?.id,
    dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null,
    description: data.rawJd
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>"),
    jobType: data.recruitmentType === "internship" ? "internship" : "full-time",
    userId,
    jobUrl: data.url || null,
    createdVia: "careeros",
  });
  const key = postingKey(data);
  const source = {
    url: data.url,
    referral: data.referral,
    recordedAt: new Date().toISOString(),
  };
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const replay = await tx.careerRun.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (replay) {
      if (replay.requestHash !== requestHash)
        throw new CareerError("IDEMPOTENCY_CONFLICT", "导入内容已改变。");
      if (!replay.jobId)
        throw new CareerError("NOT_FOUND", "原导入岗位已删除。");
      return {
        jobId: replay.jobId,
        duplicate: Boolean(JSON.parse(replay.resultJson!).duplicate),
      };
    }
    const duplicate = key
      ? await tx.careerJobContext.findUnique({
          where: { userId_postingKey: { userId, postingKey: key } },
        })
      : null;
    let jobId = duplicate?.jobId;
    if (duplicate) {
      const sources = JSON.parse(duplicate.sourcesJson);
      await tx.careerJobContext.update({
        where: { id: duplicate.id },
        data: {
          sourcesJson: JSON.stringify({
            schemaVersion: 1,
            items: [...sources.items, source],
          }),
          version: { increment: 1 },
        },
      });
    } else {
      const job = await tx.job.create({ data: fields });
      jobId = job.id;
      await tx.careerJobContext.create({
        data: {
          userId,
          jobId,
          platform: data.platform,
          recruitmentType: data.recruitmentType,
          cohort: data.cohort,
          postingKey: key,
          rawJd: data.rawJd,
          rawJdHash: hash(data.rawJd),
          sourcesJson: JSON.stringify({ schemaVersion: 1, items: [source] }),
          requirementsJson: JSON.stringify(parseJd(data.rawJd)),
          referralJson: JSON.stringify({
            schemaVersion: 1,
            value: data.referral,
            confirmedAt: source.recordedAt,
          }),
          preparationStatus: "parsed",
          version: 1,
        },
      });
    }
    const result = { schemaVersion: 1, jobId: jobId!, duplicate: !!duplicate };
    const operationKey = randomUUID();
    await tx.careerRun.create({
      data: {
        userId,
        jobId,
        operationKey,
        idempotencyKey,
        kind: "import",
        step: "saved",
        status: "succeeded",
        requestHash,
        inputJson: JSON.stringify({
          schemaVersion: 1,
          rawJdHash: hash(data.rawJd),
        }),
        resultJson: JSON.stringify(result),
      },
    });
    await event(
      tx,
      userId,
      "job_imported",
      { postingKey: key, rawJdHash: hash(data.rawJd), duplicate: !!duplicate },
      operationKey,
    );
    return result;
  });
}

export async function attachJobContext(userId: string, jobId: string) {
  const job = await ownedJob(userId, jobId);
  if (job.careerContext) return job.careerContext;
  const rawJd = job.description
    .replace(/<[^>]*>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, "> ")
    .trim();
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    return tx.careerJobContext.upsert({
      where: { jobId },
      update: {},
      create: {
        userId,
        jobId,
        platform: "unknown",
        recruitmentType: "unknown",
        cohort: "",
        rawJd,
        rawJdHash: hash(rawJd),
        sourcesJson: JSON.stringify({
          schemaVersion: 1,
          items: [
            { url: job.jobUrl ?? "", recordedAt: new Date().toISOString() },
          ],
        }),
        requirementsJson: JSON.stringify(parseJd(rawJd)),
        preparationStatus: "parsed",
        version: 1,
      },
    });
  });
}
