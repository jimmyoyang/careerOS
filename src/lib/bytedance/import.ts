import "server-only";
import { z } from "zod";
import { getBytedanceJob, BytedanceId, BytedanceError } from "./client";
import { importJob } from "@/lib/career/jobs";
import db from "@/lib/db";
import { CareerError } from "@/lib/career/errors";
import { hash } from "@/lib/career/hash";

export async function importBytedanceJob(userId: string, input: string, key: string) {
  const id = BytedanceId.parse(input);
  z.string().min(8).max(120).parse(key);
  // Replay a completed request before fetching mutable or unavailable upstream data.
  const requestIdentity = JSON.stringify(["bytedance", id]);
  const previous = await db.careerRun.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
  if (previous) {
    if (previous.kind !== "import" || previous.requestHash !== hash(requestIdentity)) throw new CareerError("IDEMPOTENCY_CONFLICT", "同一请求标识不能用于不同的字节岗位。");
    if (!previous.jobId) throw new CareerError("NOT_FOUND", "原导入岗位已删除。");
    return { jobId: previous.jobId, duplicate: Boolean(JSON.parse(previous.resultJson!).duplicate) };
  }
  const job = await getBytedanceJob(id);
  if (!job.responsibilities.trim() || !job.requirements.trim()) throw new BytedanceError("官网尚未提供完整职责和要求，请打开官网核对后再收录。");
  const rawJd = [job.title, job.project ? `招聘项目：${job.project}` : "", job.code ? `职位编号：${job.code}` : "", `工作地点：${job.location}`, "岗位职责", job.responsibilities, "岗位要求", job.requirements, job.publishedAt ? `官网发布日期：${job.publishedAt}` : ""].filter(Boolean).join("\n");
  const cohort = job.project.match(/(?:^|[^\d])(\d{4})届/)?.[1] ?? "";
  return importJob(userId, { company: "字节跳动", title: job.title, location: job.location, rawJd, url: job.url, platform: "bytedance", recruitmentType: job.recruitmentType, postingId: id, cohort }, key, { requestIdentity, postingKey: hash(["bytedance", id]), source: { label: "字节跳动校招", value: "bytedance-campus" } });
}
