import { describe, expect, it, vi } from "vitest";
import { syncCapture } from "@/../companions/browser-extension/src/backend";

const draft = {
  title: "后端工程师",
  company: "示例科技",
  location: "上海",
  description: "负责服务端开发与技术协作，参与核心系统建设。",
  sourceUrl: "https://jobs.example.test/detail/123",
  capturedAt: "2026-10-26T09:00:00.000Z",
  missing: [],
};

describe("browser capture backend client", () => {
  it("posts a capture to CareerOS with the bearer token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, created: true, jobId: "job-1" }), { status: 201 }));
    await expect(syncCapture("http://localhost:3737/", "jsync_token", draft, fetcher)).resolves.toEqual({ created: true, duplicate: false, jobId: "job-1" });
    expect(fetcher).toHaveBeenCalledWith("http://localhost:3737/api/career/browser-captures", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer jsync_token", "Content-Type": "application/json" },
      body: expect.stringContaining('"title":"后端工程师"'),
    }));
  });

  it("returns an idempotent duplicate as a successful sync", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, created: false, duplicate: true, jobId: "job-existing" }), { status: 200 }));
    await expect(syncCapture("http://localhost:3737", "jsync_token", draft, fetcher)).resolves.toEqual({ created: false, duplicate: true, jobId: "job-existing" });
  });

  it("surfaces backend validation errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "岗位描述至少需要 10 个字符" }), { status: 400 }));
    await expect(syncCapture("http://localhost:3737", "jsync_token", draft, fetcher)).rejects.toThrow("岗位描述至少需要 10 个字符");
  });
});
