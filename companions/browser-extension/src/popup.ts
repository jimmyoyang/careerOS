import { syncCapture, type BackendCapture } from "./backend.js";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $(id) as HTMLInputElement;
const textarea = (id: string) => $(id) as HTMLTextAreaElement;
const statusText = $("status");
const preview = $("preview");
const recent = $("recent");
let current: BackendCapture | null = null;

function showStatus(message: string) { statusText.textContent = message; }
function renderRecent(items: BackendCapture[]) {
  recent.replaceChildren(...(items.length ? items.map((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.title || "未命名职位"} · ${item.company || "公司待确认"}`;
    const small = document.createElement("small");
    small.textContent = ` ${new URL(item.sourceUrl).hostname}`;
    li.appendChild(small);
    return li;
  }) : [Object.assign(document.createElement("li"), { textContent: "暂无记录" })]));
}
async function loadState() {
  const data = await chrome.storage.local.get<{ captures?: BackendCapture[]; backendUrl?: string; apiToken?: string }>(["captures", "backendUrl", "apiToken"]);
  if (data.backendUrl) input("backendUrl").value = data.backendUrl;
  if (data.apiToken) input("apiToken").value = data.apiToken;
  renderRecent(data.captures ?? []);
}
async function capture() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) { showStatus("找不到当前标签页。"); return; }
  $("capture").setAttribute("disabled", "true");
  showStatus("正在读取当前网页…");
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    current = await chrome.tabs.sendMessage(tabId, { type: "capture" }) as BackendCapture;
    input("title").value = current.title;
    input("company").value = current.company;
    input("location").value = current.location;
    textarea("description").value = current.description;
    $("missing").textContent = current.missing.length ? `待补充：${current.missing.join("、")}` : "字段齐全，可以保存并同步。";
    preview.hidden = false;
    showStatus("已生成本地预览，请核对后保存。");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "当前页面无法读取，请换到普通网页重试。");
  } finally { $("capture").removeAttribute("disabled"); }
}
async function requestBackendPermission(baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const pattern = `${origin}/*`;
  if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  return chrome.permissions.request({ origins: [pattern] });
}
async function save() {
  if (!current) return;
  current = { ...current, title: input("title").value.trim(), company: input("company").value.trim(), location: input("location").value.trim(), description: textarea("description").value.trim(), missing: [] };
  const backendUrl = input("backendUrl").value.trim();
  const apiToken = input("apiToken").value.trim();
  const data = await chrome.storage.local.get<{ captures?: BackendCapture[] }>(["captures"]);
  const captures = [current, ...(data.captures ?? []).filter((item) => item.sourceUrl !== current?.sourceUrl)].slice(0, 20);
  await chrome.storage.local.set({ captures, backendUrl, apiToken });
  renderRecent(captures);
  if (!backendUrl || !apiToken) { showStatus("已保存到浏览器本地；填写后端地址和 API Token 可同步到 CareerOS。"); return; }
  try {
    if (!(await requestBackendPermission(backendUrl))) throw new Error("未授予后端地址访问权限");
    const result = await syncCapture(backendUrl, apiToken, current);
    showStatus(result.duplicate ? `CareerOS 已存在此岗位（${result.jobId}），本地记录已更新。` : `已同步到 CareerOS（${result.jobId}）。`);
  } catch (error) {
    showStatus(`本地已保存，但同步失败：${error instanceof Error ? error.message : "请求失败"}`);
  }
}
$("capture").addEventListener("click", () => void capture());
$("save").addEventListener("click", () => void save());
void loadState();
