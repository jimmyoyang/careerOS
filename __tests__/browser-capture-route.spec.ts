import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp/auth", () => ({ resolveMcpToken: vi.fn() }));
vi.mock("@/lib/jobs/createJobFromNames", () => ({ createJobFromNames: vi.fn() }));

import { GET, POST } from "@/app/api/career/browser-captures/route";
import { resolveMcpToken } from "@/lib/mcp/auth";
import { createJobFromNames } from "@/lib/jobs/createJobFromNames";

const body = {
  title: "后端工程师",
  company: "示例科技",
  location: "上海",
  description: "负责服务端开发与技术协作，参与核心系统建设。",
  sourceUrl: "https://jobs.example.test/detail/123",
};
const request = (value: unknown, token = "jsync_token") => new Request("http://localhost/api/career/browser-captures", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(value) });
const healthRequest = (token = "jsync_token") => new Request("http://localhost/api/career/browser-captures", { headers: { Authorization: `Bearer ${token}` } });

describe("POST /api/career/browser-captures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveMcpToken).mockResolvedValue({ ok: true, userId: "user-1", tokenName: "browser", scopes: ["jobs:write"] });
    vi.mocked(createJobFromNames).mockResolvedValue({ created: true, jobId: "job-1", resolutions: [], message: "created" });
  });

  it("rejects an invalid or incomplete capture before writing", async () => {
    const response = await POST(request({ ...body, title: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(createJobFromNames).not.toHaveBeenCalled();
  });

  it("requires the jobs:write scope", async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({ ok: true, userId: "user-1", tokenName: "browser", scopes: [] });
    const response = await POST(request(body));
    expect(response.status).toBe(403);
    expect(createJobFromNames).not.toHaveBeenCalled();
  });

  it("writes a capture through the existing job service", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, created: true, duplicate: false, jobId: "job-1" });
    expect(createJobFromNames).toHaveBeenCalledWith(expect.objectContaining({ company: body.company, jobTitle: body.title, jobDescription: body.description, jobUrl: body.sourceUrl, createdVia: "browser" }), "user-1");
  });

  it("returns an existing id when the same posting is captured again", async () => {
    vi.mocked(createJobFromNames).mockResolvedValue({ created: false, duplicateOf: { id: "job-existing", title: body.title, company: body.company }, resolutions: [], message: "duplicate" });
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, created: false, duplicate: true, jobId: "job-existing" });
  });
});

describe("GET /api/career/browser-captures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveMcpToken).mockResolvedValue({ ok: true, userId: "user-1", tokenName: "browser", scopes: ["jobs:write"] });
  });

  it("rejects a missing or invalid token", async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({ ok: false, status: 401, error: "Invalid token" });
    const response = await GET(healthRequest("bad-token"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "Invalid token" });
  });

  it("requires the jobs:write scope", async () => {
    vi.mocked(resolveMcpToken).mockResolvedValue({ ok: true, userId: "user-1", tokenName: "browser", scopes: [] });
    const response = await GET(healthRequest());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "需要 jobs:write 权限" });
  });

  it("returns a healthy backend response for an authorized token", async () => {
    const response = await GET(healthRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "careerOS", capabilities: ["jobs:write"] });
  });
});
