export type BackendCapture = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  capturedAt: string;
  missing: string[];
};

export type SyncResult = { created: boolean; duplicate: boolean; jobId: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function syncCapture(baseUrl: string, token: string, capture: BackendCapture, fetcher: FetchLike = fetch): Promise<SyncResult> {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalizedBase)) throw new Error("后端地址必须以 http:// 或 https:// 开头");
  if (!token.trim()) throw new Error("请填写 CareerOS API Token");
  const response = await fetcher(`${normalizedBase}/api/career/browser-captures`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(capture),
  });
  const data = await response.json().catch(() => ({})) as Partial<SyncResult> & { error?: string; jobId?: string };
  if (!response.ok) throw new Error(data.error || `CareerOS 返回 HTTP ${response.status}`);
  if (!data.jobId) throw new Error("CareerOS 返回了无效的岗位编号");
  return { created: Boolean(data.created), duplicate: Boolean(data.duplicate), jobId: data.jobId };
}
