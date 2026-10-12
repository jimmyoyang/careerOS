import "server-only";
import { z } from "zod";
import { getHuaweiJob, HuaweiId, HuaweiError } from "./client";
import { importJob } from "@/lib/career/jobs";
import db from "@/lib/db";
import { CareerError } from "@/lib/career/errors";
import { hash } from "@/lib/career/hash";
const inputSchema = z.object({ advertisementId: HuaweiId, intentionId: z.union([HuaweiId, z.literal("")]) });
export async function importHuaweiJob(userId: string, input: { advertisementId: string; intentionId: string }, key: string) {
  const selection = inputSchema.parse(input);
  z.string().min(8).max(120).parse(key);
  // Retry identity is the user's selection, not mutable upstream descriptions.
  const requestIdentity = JSON.stringify(["huawei", selection.advertisementId, selection.intentionId]);
  const previous = await db.careerRun.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
  if (previous) {
    if (previous.kind !== "import" || previous.requestHash !== hash(requestIdentity)) throw new CareerError("IDEMPOTENCY_CONFLICT", "同一请求标识不能用于不同的岗位意向。");
    if (!previous.jobId) throw new CareerError("NOT_FOUND", "原导入岗位已删除。");
    return { jobId: previous.jobId, duplicate: Boolean(JSON.parse(previous.resultJson!).duplicate) };
  }
  const job = await getHuaweiJob(selection.advertisementId);
  const intention = job.intentions.find(item => item.id === selection.intentionId);
  if ((job.intentions.length && !intention) || (selection.intentionId && !intention)) throw new HuaweiError("请先选择该职位的岗位意向，再收录。");
  const content = intention ?? job;
  if ([content.responsibilities, content.requirements].some(text => !text.trim() || /请.*详见|详见岗位意向/.test(text))) throw new HuaweiError("官网尚未提供完整职责和要求，请打开官网核对后再收录。");
  const title = intention ? `${job.title} · ${intention.title}` : job.title;
  const location = content.location || job.location;
  const url = job.url + (intention ? `&positionIntentionId=${intention.id}` : "");
  const rawJd = [title, `工作地点：${location}`, intention?.departments ? `部门：${intention.departments}` : "", "岗位职责", content.responsibilities, "岗位要求", content.requirements, job.updatedAt ? `官网更新日期：${job.updatedAt}` : ""].filter(Boolean).join("\n");
  return importJob(userId, { company: "华为", title, location, rawJd, url, platform: "huawei", recruitmentType: job.recruitmentType, postingId: `${job.advertisementId}:${intention?.id ?? ""}`, cohort: "" }, key, { requestIdentity, postingKey: hash(["huawei", job.advertisementId, intention?.id ?? ""]), source: { label: "华为校招", value: "huawei-campus" } });
}
