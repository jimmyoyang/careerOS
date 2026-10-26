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
export type ConnectionResult = { service: string; capabilities: string[] };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function normalizeBaseUrl(baseUrl: string) {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalizedBase)) throw new Error("后端地址必须以 http:// 或 https:// 开头");
  try { new URL(normalizedBase); } catch { throw new Error("后端地址格式无效"); }
  return normalizedBase;
}

function requireToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error("请填写 CareerOS API Token");
  return normalizedToken;
}

export async function checkConnection(baseUrl: string, token: string, fetcher: FetchLike = fetch): Promise<ConnectionResult> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedToken = requireToken(token);
  const response = await fetcher(`${normalizedBase}/api/career/browser-captures`, {
    method: "GET",
    headers: { Authorization: `Bearer ${normalizedToken}` },
  });
  const data = await response.json().catch(() => ({})) as Partial<ConnectionResult> & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(data.error || `CareerOS 返回 HTTP ${response.status}`);
  if (!data.ok || typeof data.service !== "string" || !Array.isArray(data.capabilities)) throw new Error("CareerOS 返回了无效的连接状态");
  return { service: data.service, capabilities: data.capabilities.filter((value): value is string => typeof value === "string") };
}

export async function syncCapture(baseUrl: string, token: string, capture: BackendCapture, fetcher: FetchLike = fetch): Promise<SyncResult> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedToken = requireToken(token);
  const response = await fetcher(`${normalizedBase}/api/career/browser-captures`, {
    method: "POST",
    headers: { Authorization: `Bearer ${normalizedToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(capture),
  });
  const data = await response.json().catch(() => ({})) as Partial<SyncResult> & { error?: string; jobId?: string };
  if (!response.ok) throw new Error(data.error || `CareerOS 返回 HTTP ${response.status}`);
  if (!data.jobId) throw new Error("CareerOS 返回了无效的岗位编号");
  return { created: Boolean(data.created), duplicate: Boolean(data.duplicate), jobId: data.jobId };
}
