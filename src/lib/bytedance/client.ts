import "server-only";
import { z } from "zod";
import { decodeHtml } from "@/lib/scraper/html";
import type { BytedanceQuery, BytedancePage, BytedanceDetail, BytedanceRecruitmentType } from "./types";

// Public campus endpoints used by jobs.bytedance.com (verified 2026-10-12).
// Each list query uses its own anonymous CSRF session, never a user's login cookie.
const API = "https://jobs.bytedance.com/api/v1";
const HEADERS = { "Content-Type": "application/json", "website-path": "campus", "Portal-Channel": "campus", "Portal-Platform": "pc", "accept-language": "zh-CN", Origin: "https://jobs.bytedance.com", Referer: "https://jobs.bytedance.com/campus/position" };
export const BytedanceId = z.string().regex(/^[1-9]\d{0,19}$/);
const querySchema = z.object({ recruitmentType: z.enum(["all", "campus", "internship"]), keyword: z.string().trim().max(100), page: z.number().int().min(1).max(10000) });
const text = z.string().max(30000).nullish().transform(value => value ?? "");
const name = z.object({ name: text, i18n_name: text });
const rowSchema = z.object({
  id: BytedanceId, title: z.string().trim().min(1).max(200), code: text,
  city_info: name.nullish(), city_list: z.array(name).max(100).nullish(),
  job_category: name.extend({ parent: name.nullish() }).nullish(),
  recruit_type: z.object({ id: z.enum(["201", "202", "301"]) }),
  job_subject: z.object({ name: z.object({ zh_cn: text, i18n: text }) }).nullish(),
  publish_time: z.number().int().nonnegative().max(8640000000000000).nullish(),
});
const detailSchema = rowSchema.extend({ description: text, requirement: text, channel_online_status: z.literal(1) });
export class BytedanceError extends Error {}
const sourceError = () => new BytedanceError("字节官网数据暂时不可用，或职位已下线。请稍后重试或打开官网查看，现有收录不受影响。");
function plain(value: string): string {
  return decodeHtml(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
async function readJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw sourceError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw sourceError();
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return z.object({ code: z.literal(0), data: z.unknown() }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))).data;
}
function request(path: string, options: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...options, headers: { ...HEADERS, ...options.headers }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
}
async function anonymousSession(): Promise<Record<string, string>> {
  const response = await request("/csrf/token", { method: "POST" });
  const data = z.object({ token: z.string().min(1).max(2048).regex(/^[^\r\n]+$/) }).parse(await readJson(response));
  const cookies = response.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]).filter(cookie => /^atsx-csrf-token=[^\s;,]+$/.test(cookie));
  if (cookies.length !== 1 || cookies[0].length > 4096) throw sourceError();
  return { "x-csrf-token": data.token, Cookie: cookies[0] };
}
const scope = (id: string): BytedanceRecruitmentType => id === "201" ? "campus" : "internship";
const displayName = (value: z.infer<typeof name> | null | undefined) => plain(value?.i18n_name || value?.name || "");
function job(row: z.infer<typeof rowSchema>) {
  const cities = row.city_list?.map(displayName).filter(Boolean) ?? [];
  return { id: row.id, title: row.title, code: plain(row.code), location: [...new Set(cities)].join("/") || displayName(row.city_info), category: [displayName(row.job_category?.parent), displayName(row.job_category)].filter(Boolean).join(" / "), recruitmentType: scope(row.recruit_type.id), project: plain(row.job_subject?.name.zh_cn || row.job_subject?.name.i18n || ""), publishedAt: row.publish_time ? new Date(row.publish_time).toISOString() : "", url: `https://jobs.bytedance.com/campus/position/${row.id}/detail` };
}
export async function listBytedanceJobs(input: BytedanceQuery): Promise<BytedancePage> {
  const query = querySchema.parse(input);
  try {
    const headers = await anonymousSession();
    const offset = (query.page - 1) * 10;
    const data = z.object({ job_post_list: z.array(rowSchema).max(10), count: z.number().int().nonnegative().safe() }).parse(await readJson(await request("/search/job/posts", { method: "POST", headers, body: JSON.stringify({ keyword: query.keyword, limit: 10, offset, portal_type: 3, recruitment_id_list: query.recruitmentType === "all" ? [] : query.recruitmentType === "campus" ? ["201"] : ["202", "301"] }) })));
    if (data.job_post_list.length !== Math.max(0, Math.min(10, data.count - offset)) || new Set(data.job_post_list.map(row => row.id)).size !== data.job_post_list.length) throw sourceError();
    const jobs = data.job_post_list.map(job);
    if (query.recruitmentType !== "all" && jobs.some(job => job.recruitmentType !== query.recruitmentType)) throw sourceError();
    return { jobs, total: data.count, page: query.page, pageSize: 10, fetchedAt: new Date().toISOString() };
  } catch { throw sourceError(); }
}
export async function getBytedanceJob(input: string): Promise<BytedanceDetail> {
  const id = BytedanceId.parse(input);
  try {
    const data = z.object({ job_post_detail: detailSchema }).parse(await readJson(await request(`/job/posts/${id}?portal_type=3`)));
    const row = data.job_post_detail;
    if (row.id !== id) throw sourceError();
    return { ...job(row), responsibilities: plain(row.description), requirements: plain(row.requirement) };
  } catch { throw sourceError(); }
}
