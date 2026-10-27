import { describe, expect, it, vi } from "vitest";
import {
  domesticJobToImport,
  domesticPostingKey,
  domesticSource,
  searchDomesticJobs,
  getDomesticJobDetails,
  type DomesticJob,
} from "@/lib/domestic";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("domestic public job adapters", () => {
  it("builds an import payload with a stable source key", () => {
    const job: DomesticJob = {
      title: "后端工程师",
      company: "腾讯",
      location: "深圳",
      description: "负责服务端开发",
      url: "https://careers.tencent.com/job/1001",
      sourceUrl: "https://careers.tencent.com/job/1001",
      postingId: "1001",
      platform: "tencent",
    };
    expect(domesticJobToImport(job)).toMatchObject({
      company: "腾讯",
      title: "后端工程师",
      rawJd: "负责服务端开发",
      platform: "tencent",
      recruitmentType: "unknown",
      cohort: "",
      postingId: "1001",
      url: "https://careers.tencent.com/job/1001",
    });
    expect(domesticPostingKey(job)).toBe(domesticPostingKey(job));
    expect(domesticSource(job)).toEqual({ label: "腾讯公开岗位", value: "tencent-public" });
  });

  it("maps Tencent search results to CareerOS jobs", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ Code: 200, Data: { Count: 1, Posts: [{ RecruitPostId: 1001, RecruitPostName: "后端工程师", LocationName: "深圳", Responsibility: "负责服务端开发", LastUpdateTime: "2026年10月26日", PostURL: "https://tencent.example/job/1001" }] } }));
    await expect(searchDomesticJobs("tencent", "后端", 1, fetcher)).resolves.toEqual({ total: 1, jobs: [expect.objectContaining<DomesticJob>({ company: "腾讯", title: "后端工程师", location: "深圳", description: "负责服务端开发", url: "https://tencent.example/job/1001", sourceUrl: "https://tencent.example/job/1001", postingId: "1001", platform: "tencent" })] });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("careers.tencent.com/tencentcareer/api/post/Query"), expect.anything());
  });

  it("maps Alibaba listing and keeps a stable posting id", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "set-cookie": "XSRF-TOKEN=csrf-1; Path=/" } }))
      .mockResolvedValueOnce(response({ success: true, content: { totalCount: 1, datas: [{ id: "ali-1", name: "算法工程师", workLocations: ["杭州"], modifyTime: 1790000000000, positionUrl: "/off-campus/position-detail?positionId=ali-1", description: "参与算法研发" }] } }));
    await expect(searchDomesticJobs("alibaba", "算法", 1, fetcher)).resolves.toEqual({ total: 1, jobs: [expect.objectContaining({ company: "阿里巴巴", title: "算法工程师", location: "杭州", description: "参与算法研发", postingId: "ali-1", platform: "alibaba" })] });
    expect(new Headers(fetcher.mock.calls[1][1].headers).get("Cookie")).toBe("XSRF-TOKEN=csrf-1");
  });

  it("does not mistake an upstream business error for no matching jobs", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 403, msg: "访问受限" }));
    await expect(searchDomesticJobs("meituan", "数据", 1, fetcher)).rejects.toThrow("美团");
  });

  it("bounds requests and avoids stale cached job listings", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ Code: 200, Data: { Count: 0, Posts: [] } }));
    await searchDomesticJobs("tencent", "数据", 1, fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it("does not fabricate a job description when the source omits it", () => {
    expect(domesticJobToImport({ title: "工程师", company: "腾讯", description: "", location: "", url: "", platform: "tencent", postingId: "1" }).rawJd).toBe("");
  });

  it("fetches Tencent requirements before importing a search result", async () => {
    const job: DomesticJob = { title: "工程师", company: "腾讯", description: "摘要", location: "", platform: "tencent", postingId: "1001", url: "https://careers.tencent.com/jobdesc.html?postId=123456" };
    const fetcher = vi.fn().mockResolvedValue(response({ Code: 200, Data: { RecruitPostId: 1001, RecruitPostName: "工程师", Responsibility: "完整职责", Requirement: "任职要求", PostURL: job.url } }));
    const details = await getDomesticJobDetails(job, fetcher);
    expect(domesticJobToImport(details).rawJd).toBe("完整职责\n\n任职要求");
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/ByPostId?postId=123456"), expect.anything());
    await expect(getDomesticJobDetails({ ...job, url: "http://127.0.0.1/" }, fetcher)).rejects.toThrow("来源");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("maps Meituan search results and reports upstream errors", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ data: { list: [{ jobUnionId: "mt-1", name: "数据工程师", cityList: [{ name: "上海市" }], jobDuty: "建设数据平台", jobRequirement: "熟悉 SQL" }], page: { totalCount: 1 } } }));
    await expect(searchDomesticJobs("meituan", "数据", 1, fetcher)).resolves.toEqual({ total: 1, jobs: [expect.objectContaining({ company: "美团", title: "数据工程师", location: "上海市", description: expect.stringContaining("熟悉 SQL"), postingId: "mt-1", platform: "meituan" })] });
    fetcher.mockResolvedValueOnce(response({ message: "blocked" }, 403));
    await expect(searchDomesticJobs("meituan", "数据", 1, fetcher)).rejects.toThrow("美团岗位接口返回 HTTP 403");
  });
});
