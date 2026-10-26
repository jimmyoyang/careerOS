import { z } from "zod";
import { resolveMcpToken } from "@/lib/mcp/auth";
import { createJobFromNames } from "@/lib/jobs/createJobFromNames";

const CaptureSchema = z.object({
  title: z.string().trim().min(2, "职位名称至少需要 2 个字符").max(200),
  company: z.string().trim().min(2, "公司名称至少需要 2 个字符").max(200),
  location: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().min(10, "岗位描述至少需要 10 个字符").max(100_000),
  sourceUrl: z.string().url("来源网址无效").max(2_048).refine((value) => /^https?:\/\//i.test(value), "来源网址必须是 http 或 https"),
  source: z.string().trim().max(120).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const auth = await resolveMcpToken(request);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    if (!auth.scopes.includes("jobs:write")) return json({ ok: false, error: "需要 jobs:write 权限" }, 403);

    let raw: unknown;
    try { raw = await request.json(); } catch { return json({ ok: false, error: "请求体必须是 JSON" }, 400); }
    const parsed = CaptureSchema.safeParse(raw);
    if (!parsed.success) return json({ ok: false, error: parsed.error.issues.slice(0, 3).map((issue) => issue.message).join("；") }, 400);

    const source = parsed.data.source || new URL(parsed.data.sourceUrl).hostname.replace(/^www\./, "");
    const result = await createJobFromNames({
      company: parsed.data.company,
      jobTitle: parsed.data.title,
      jobDescription: parsed.data.description,
      location: parsed.data.location || undefined,
      source,
      jobUrl: parsed.data.sourceUrl,
      createdVia: auth.tokenName,
    }, auth.userId);
    if (!result.created && result.duplicateOf) return json({ ok: true, created: false, duplicate: true, jobId: result.duplicateOf.id }, 200);
    if (!result.jobId) return json({ ok: false, error: "岗位写入未返回编号" }, 500);
    return json({ ok: true, created: true, duplicate: false, jobId: result.jobId }, 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "岗位写入失败" }, 500);
  }
}
