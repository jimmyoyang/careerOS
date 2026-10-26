import type { DomesticFetch, DomesticJob, DomesticProvider } from "./types";
import type { ImportInput } from "@/lib/career/contracts";

const DEFAULT_PAGE_SIZE = 10;

type TencentPost = {
  RecruitPostId?: number | string;
  RecruitPostName?: string;
  LocationName?: string;
  Responsibility?: string;
  LastUpdateTime?: string;
  PostURL?: string;
};

type AlibabaPost = {
  id?: number | string;
  name?: string;
  positionUrl?: string;
  workLocations?: string[];
  publishTime?: number;
  modifyTime?: number;
  description?: string;
  requirement?: string;
};

type MeituanPost = {
  jobUnionId?: string | number;
  name?: string;
  cityList?: Array<{ name?: string }>;
  jobDuty?: string;
  jobRequirement?: string;
  refreshTime?: number;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dateText = (value: unknown) => {
  if (!value) return undefined;
  const raw = typeof value === "number" ? new Date(value) : new Date(String(value).replace(/年|月/g, "-").replace(/日/g, ""));
  return Number.isNaN(raw.getTime()) ? undefined : raw.toISOString();
};

function mapTencent(post: TencentPost): DomesticJob | null {
  const postingId = String(post.RecruitPostId ?? "");
  const title = text(post.RecruitPostName);
  const url = text(post.PostURL);
  if (!postingId || !title || !url) return null;
  return { title, company: "腾讯", location: text(post.LocationName), description: text(post.Responsibility), url, sourceUrl: url, postedDate: dateText(post.LastUpdateTime), postingId, platform: "tencent" };
}

function mapAlibaba(post: AlibabaPost): DomesticJob | null {
  const postingId = String(post.id ?? "");
  const title = text(post.name);
  if (!postingId || !title) return null;
  const url = post.positionUrl?.startsWith("http") ? post.positionUrl : `https://talent-holding.alibaba.com${post.positionUrl ?? ""}`;
  if (!url.endsWith(post.positionUrl ?? "") || !post.positionUrl) return null;
  return { title, company: "阿里巴巴", location: (post.workLocations ?? []).map(text).filter(Boolean).join(" / "), description: [text(post.description), text(post.requirement)].filter(Boolean).join("\n\n"), url, sourceUrl: url, postedDate: dateText(post.modifyTime ?? post.publishTime), postingId, platform: "alibaba" };
}

function mapMeituan(post: MeituanPost): DomesticJob | null {
  const postingId = String(post.jobUnionId ?? "");
  const title = text(post.name);
  if (!postingId || !title) return null;
  const url = `https://zhaopin.meituan.com/web/position/detail?jobUnionId=${encodeURIComponent(postingId)}`;
  return { title, company: "美团", location: (post.cityList ?? []).map((city) => text(city.name)).filter(Boolean).join(" / "), description: [text(post.jobDuty), text(post.jobRequirement)].filter(Boolean).join("\n\n"), url, sourceUrl: url, postedDate: dateText(post.refreshTime), postingId, platform: "meituan" };
}

async function readJson(response: Response, label: string) {
  if (!response.ok) throw new Error(`${label}岗位接口返回 HTTP ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}

async function searchTencent(keyword: string, page: number, fetcher: DomesticFetch): Promise<{ total: number; jobs: DomesticJob[] }> {
  const params = new URLSearchParams({ timestamp: String(Date.now()), countryId: "", cityId: "", bgIds: "", productId: "", categoryId: "", parentCategoryId: "", attrId: "", keyword, pageIndex: String(page), pageSize: String(DEFAULT_PAGE_SIZE), language: "zh-cn", area: "us" });
  const response = await fetcher(`https://careers.tencent.com/tencentcareer/api/post/Query?${params}`, { headers: { Accept: "application/json", Referer: "https://careers.tencent.com/search.html" } });
  const data = await readJson(response, "腾讯");
  if (data.Code !== 200) throw new Error("腾讯岗位接口返回了无效数据");
  return { total: Number(data.Data?.Count ?? 0), jobs: (data.Data?.Posts ?? []).map(mapTencent).filter(Boolean) as DomesticJob[] };
}

function csrfFromHeaders(response: Response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? "";
}

async function searchAlibaba(keyword: string, page: number, fetcher: DomesticFetch): Promise<{ total: number; jobs: DomesticJob[] }> {
  const landing = await fetcher("https://talent-holding.alibaba.com/off-campus/position-list?lang=zh", { headers: { "User-Agent": "CareerOS/1.0" } });
  const csrf = csrfFromHeaders(landing);
  if (!csrf) throw new Error("阿里巴巴岗位接口未返回 CSRF 标识");
  const body = { channel: "group_official_site", language: "zh", batchId: "", categories: "", deptCodes: [], key: keyword, pageIndex: page, pageSize: DEFAULT_PAGE_SIZE, regions: "", subCategories: "", shareType: "", shareId: "", myReferralShareCode: "" };
  const response = await fetcher(`https://talent-holding.alibaba.com/position/search?_csrf=${encodeURIComponent(csrf)}`, { method: "POST", headers: { Accept: "application/json, text/plain, */*", "Content-Type": "application/json", Referer: "https://talent-holding.alibaba.com/off-campus/position-list?lang=zh", "X-XSRF-TOKEN": csrf, "bx-v": "2.5.11" }, body: JSON.stringify(body) });
  const data = await readJson(response, "阿里巴巴");
  if (!data.success) throw new Error(data.errorMsg || "阿里巴巴岗位接口返回了无效数据");
  return { total: Number(data.content?.totalCount ?? 0), jobs: (data.content?.datas ?? []).map(mapAlibaba).filter(Boolean) as DomesticJob[] };
}

async function searchMeituan(keyword: string, page: number, fetcher: DomesticFetch): Promise<{ total: number; jobs: DomesticJob[] }> {
  const body = { page: { pageNo: page, pageSize: DEFAULT_PAGE_SIZE }, jobShareType: "1", keywords: keyword, cityList: [], department: [], jfJgList: [], jobType: [], typeCode: [], specialCode: [], u_query_id: "", r_query_id: "" };
  const response = await fetcher("https://zhaopin.meituan.com/api/official/job/getJobList", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Referer: "https://zhaopin.meituan.com/web/position" }, body: JSON.stringify(body) });
  const data = await readJson(response, "美团");
  return { total: Number(data.data?.page?.totalCount ?? 0), jobs: (data.data?.list ?? []).map(mapMeituan).filter(Boolean) as DomesticJob[] };
}

export async function searchDomesticJobs(provider: DomesticProvider, keyword: string, page = 1, fetcher: DomesticFetch = fetch): Promise<{ total: number; jobs: DomesticJob[] }> {
  if (!keyword.trim()) throw new Error("请输入岗位关键词");
  if (!Number.isInteger(page) || page < 1) throw new Error("页码无效");
  if (provider === "tencent") return searchTencent(keyword.trim(), page, fetcher);
  if (provider === "alibaba") return searchAlibaba(keyword.trim(), page, fetcher);
  return searchMeituan(keyword.trim(), page, fetcher);
}

export function domesticPostingKey(job: Pick<DomesticJob, "platform" | "postingId">) {
  return `domestic-public:${job.platform}:${job.postingId}`;
}

export function domesticSource(job: Pick<DomesticJob, "platform">) {
  const labels: Record<DomesticProvider, string> = { tencent: "腾讯", alibaba: "阿里巴巴", meituan: "美团" };
  return { label: `${labels[job.platform]}公开岗位`, value: `${job.platform}-public` };
}

export function domesticJobToImport(job: DomesticJob): ImportInput {
  return {
    company: job.company,
    title: job.title,
    rawJd: job.description || `${job.company}公开岗位：${job.title}`,
    location: job.location || "",
    url: job.sourceUrl || job.url || "",
    platform: job.platform,
    recruitmentType: "unknown",
    cohort: "",
    postingId: job.postingId,
    dueDate: "",
    referral: "",
  };
}

export type { DomesticFetch, DomesticJob, DomesticProvider } from "./types";
