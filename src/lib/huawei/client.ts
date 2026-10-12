import "server-only";
import { z } from "zod";
import { decodeHtml } from "@/lib/scraper/html";
import type { HuaweiQuery, HuaweiPage, HuaweiDetail, HuaweiRecruitmentType } from "./types";

// Public endpoints and application identifier used by career.huawei.com (2026-10-12).
// No personal credentials, cookies, resume data or phone numbers are sent here.
const API = "https://apigw-dgg-b0.huawei.com/api/apig/channelhw/recruitmentPosition/pub/";
const APP_ID = "app_000000035886";
const MAX_BODY = 2_000_000;
export const HuaweiId = z.string().regex(/^[1-9]\d{0,19}$/);
const remoteId = z.union([z.number().int().positive().safe(), HuaweiId]).transform(String);
const text = z.string().max(30000).nullish().transform(value => value ?? "");
const title = z.string().trim().min(1).max(200);
const querySchema = z.object({ recruitmentType: z.enum(["campus", "internship"]), keyword: z.string().trim().max(100), page: z.number().int().min(1).max(1000) });
const rowSchema = z.object({ advertisementId: remoteId, jobName: title, workPlace: text, categoryName: text, scenarioName: title, lastUpdateDate: text });
const detailSchema = z.object({ advertisementId: remoteId, jobId: remoteId.nullish(), jobname: title, jobCity: text, categoryName: text, scenarioName: title, lastUpdateDate: text, mainBusiness: text, jobRequire: text });
const intentionSchema = z.object({ positionIntentionId: remoteId, positionIntention: title, jobResponsibilities: text, jobDemand: text, jobPlaceName: text, deptName: text });
export class HuaweiError extends Error {}
const sourceError = () => new HuaweiError("华为官网数据暂时不可用，请稍后重试或打开官网查看。现有收录不受影响。");
function plain(value: string): string {
  return decodeHtml(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function scope(value: string): HuaweiRecruitmentType {
  if (value === "应届生") return "campus";
  if (value === "实习生" || value === "实习") return "internship";
  throw sourceError();
}
function jobUrl(id: string) { return `https://career.huawei.com/cn/job-details?advertisementId=${id}`; }
async function post(endpoint: "getJobPage" | "getRecruitmentPositionDetail" | "getPositionIntentionList", body: object): Promise<unknown> {
  try {
    const response = await fetch(`${API}${endpoint}?X-HW-ID=${APP_ID}`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "X-HW-ID": APP_ID, "x-jalor-tenantAlias": "hcm", "x-language": "zh_CN", "x-Referer": "https://career.huawei.com/cn", Origin: "https://career.huawei.com", Referer: "https://career.huawei.com/" },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) throw sourceError();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) throw sourceError();
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const result = z.object({ status: z.literal("SUCCESS"), data: z.unknown() }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return result.data;
  } catch { throw sourceError(); }
}
export async function listHuaweiJobs(input: HuaweiQuery): Promise<HuaweiPage> {
  const query = querySchema.parse(input);
  try {
    const result = z.object({ result: z.array(rowSchema).max(20), pageVO: z.object({ totalRows: z.number().int().nonnegative(), curPage: z.number().int().positive(), pageSize: z.literal(20) }) }).parse(await post("getJobPage", { curPage: query.page, pageSize: 20, jobType: "CR", recruitmentType: [query.recruitmentType === "campus" ? "FRESH_GRADUATE" : "INTERN"], keyWord: query.keyword }));
    const { totalRows, curPage } = result.pageVO;
    const expected = Math.max(0, Math.min(20, totalRows - (query.page - 1) * 20));
    if (curPage !== query.page || result.result.length !== expected || new Set(result.result.map(row => row.advertisementId)).size !== result.result.length) throw sourceError();
    const jobs = result.result.map(row => ({ advertisementId: row.advertisementId, title: row.jobName, location: plain(row.workPlace), category: plain(row.categoryName), recruitmentType: scope(row.scenarioName), updatedAt: row.lastUpdateDate, url: jobUrl(row.advertisementId) }));
    if (jobs.some(job => job.recruitmentType !== query.recruitmentType)) throw sourceError();
    return { jobs, total: totalRows, page: curPage, pageSize: 20, fetchedAt: new Date().toISOString() };
  } catch { throw sourceError(); }
}
export async function getHuaweiJob(input: string): Promise<HuaweiDetail> {
  const id = HuaweiId.parse(input);
  try {
    const row = detailSchema.parse(await post("getRecruitmentPositionDetail", { advertisementId: id }));
    if (row.advertisementId !== id) throw sourceError();
    const recruitmentType = scope(row.scenarioName);
    const raw = row.jobId ? z.array(intentionSchema).max(200).parse(await post("getPositionIntentionList", { jobId: row.jobId })) : [];
    if (new Set(raw.map(item => item.positionIntentionId)).size !== raw.length) throw sourceError();
    return { advertisementId: id, title: row.jobname, location: plain(row.jobCity), category: plain(row.categoryName), recruitmentType, updatedAt: row.lastUpdateDate, url: jobUrl(id), responsibilities: plain(row.mainBusiness), requirements: plain(row.jobRequire), intentions: raw.map(item => ({ id: item.positionIntentionId, title: item.positionIntention, responsibilities: plain(item.jobResponsibilities), requirements: plain(item.jobDemand), location: plain(item.jobPlaceName), departments: plain(item.deptName) })) };
  } catch { throw sourceError(); }
}
