// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHuaweiJob, listHuaweiJobs } from "@/lib/huawei/client";
const request = vi.fn();
const row = { advertisementId: 36384, jobName: "AI工程师", workPlace: "上海/深圳", categoryName: "研发类", scenarioName: "应届生", lastUpdateDate: "2026-08-17" };
const detail = { advertisementId: 36384, jobId: 103891, jobname: "AI工程师", jobCity: "上海/深圳", categoryName: "研发类", scenarioName: "应届生", lastUpdateDate: "2026-08-17", mainBusiness: "请您详见岗位意向中的岗位职责", jobRequire: "请您详见岗位意向中的岗位要求" };
const intention = { positionIntentionId: 11583, positionIntention: "算子技术", jobResponsibilities: "开发组件<br>完成测试<script>bad()</script>", jobDemand: "掌握 C++ &amp; Python", jobPlaceName: "上海", deptName: "研发部" };
const response = (data: unknown) => new Response(JSON.stringify({ status: "SUCCESS", data }), { status: 200 });
beforeEach(() => { vi.stubGlobal("fetch", request); request.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
describe("Huawei public jobs adapter", () => {
  it("queries a fixed official endpoint with public headers, server pagination and no credentials", async () => {
    request.mockResolvedValue(response({ result: Array.from({length:20}, (_,i) => ({...row,advertisementId:36384+i})), pageVO: { totalRows: 71, curPage: 2, pageSize: 20 } }));
    const result = await listHuaweiJobs({ recruitmentType: "campus", keyword: "AI", page: 2 });
    expect(result).toMatchObject({ total: 71, page: 2, pageSize: 20 });
    expect(result.jobs).toHaveLength(20);
    expect(result.jobs[0]).toMatchObject({ advertisementId: "36384", title: "AI工程师", recruitmentType: "campus" });
    const [url, options] = request.mock.calls[0];
    expect(new URL(url).hostname).toBe("apigw-dgg-b0.huawei.com");
    expect(JSON.parse(options.body)).toMatchObject({ curPage: 2, pageSize: 20, jobType: "CR", recruitmentType: ["FRESH_GRADUATE"], keyWord: "AI" });
    expect(options.redirect).toBe("error");
    expect(options.headers).not.toHaveProperty("Cookie");
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(result.jobs[0].url).toBe("https://career.huawei.com/cn/job-details?advertisementId=36384");
  });
  it("uses the internship scope and preserves a legitimate zero total", async () => {
    request.mockResolvedValue(response({ result: [], pageVO: { totalRows: 0, curPage: 1, pageSize: 20 } }));
    const result = await listHuaweiJobs({ recruitmentType: "internship", keyword: "", page: 1 });
    expect(result.total).toBe(0);
    expect(JSON.parse(request.mock.calls[0][1].body).recruitmentType).toEqual(["INTERN"]);
  });
  it.each([0, -1, 1.5, 1001])("rejects invalid page %s before network access", async page => {
    await expect(listHuaweiJobs({ recruitmentType: "campus", keyword: "", page })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("loads concrete intention descriptions and removes active HTML", async () => {
    request.mockResolvedValueOnce(response(detail)).mockResolvedValueOnce(response([intention]));
    const result = await getHuaweiJob("36384");
    expect(result.intentions[0]).toEqual({ id: "11583", title: "算子技术", responsibilities: "开发组件\n完成测试", requirements: "掌握 C++ & Python", location: "上海", departments: "研发部" });
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ jobId: "103891" });
  });
  it("rejects a detail belonging to a different advertisement", async () => {
    request.mockResolvedValue(response({ ...detail, advertisementId: 99 }));
    await expect(getHuaweiJob("36384")).rejects.toThrow();
  });
  it.each(["https://evil.test", "1&x=y", "", "../1"])("rejects unsafe ID %s", async id => {
    await expect(getHuaweiJob(id)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    new Response("rate limited", { status: 429 }),
    new Response(JSON.stringify({ status: "FAILED", data: null })),
    response({ result: [], pageVO: { totalRows: "broken" } }),
    response({ result: [], pageVO: { totalRows: 71, curPage: 1, pageSize: 20 } }),
  ])("does not represent source failure or incomplete payloads as no jobs", async value => {
    request.mockResolvedValue(value);
    await expect(listHuaweiJobs({ recruitmentType: "campus", keyword: "", page: 1 })).rejects.toThrow();
  });
  it("bounds upstream body size", async () => {
    request.mockResolvedValue(new Response("x".repeat(2_100_000)));
    await expect(getHuaweiJob("36384")).rejects.toThrow();
  });
  it("rejects unsupported recruiting scopes in details", async () => {
    request.mockResolvedValue(response({ ...detail, scenarioName: "社招" }));
    await expect(getHuaweiJob("36384")).rejects.toThrow();
  });
});
