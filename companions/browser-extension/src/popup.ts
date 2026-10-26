export {};
type JobDraft = { title: string; company: string; location: string; description: string; sourceUrl: string; capturedAt: string; missing: string[] };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $(id) as HTMLInputElement;
const textarea = (id: string) => $(id) as HTMLTextAreaElement;
const statusText = $("status");
const preview = $("preview");
const recent = $("recent");
let current: JobDraft | null = null;

function showStatus(message: string) { statusText.textContent = message; }
function renderRecent(items: JobDraft[]) {
  recent.replaceChildren(...(items.length ? items.map((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.title || "未命名职位"} · ${item.company || "公司待确认"}`;
    const small = document.createElement("small");
    small.textContent = ` ${new URL(item.sourceUrl).hostname}`;
    li.appendChild(small);
    return li;
  }) : [Object.assign(document.createElement("li"), { textContent: "暂无记录" })]));
}
async function loadRecent() {
  const data = await chrome.storage.local.get<{ captures?: JobDraft[] }>(["captures"]);
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
    current = await chrome.tabs.sendMessage(tabId, { type: "capture" }) as JobDraft;
    input("title").value = current.title;
    input("company").value = current.company;
    input("location").value = current.location;
    textarea("description").value = current.description;
    $("missing").textContent = current.missing.length ? `待补充：${current.missing.join("、")}` : "字段齐全，可以保存。";
    preview.hidden = false;
    showStatus("已生成本地预览，请核对后保存。");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "当前页面无法读取，请换到普通网页重试。");
  } finally { $("capture").removeAttribute("disabled"); }
}
async function save() {
  if (!current) return;
  current = { ...current, title: input("title").value.trim(), company: input("company").value.trim(), location: input("location").value.trim(), description: textarea("description").value.trim(), missing: [] };
  const data = await chrome.storage.local.get<{ captures?: JobDraft[] }>(["captures"]);
  const captures = [current, ...(data.captures ?? []).filter((item) => item.sourceUrl !== current?.sourceUrl)].slice(0, 20);
  await chrome.storage.local.set({ captures });
  renderRecent(captures);
  showStatus("已保存到当前浏览器本地。");
}
$("capture").addEventListener("click", () => void capture());
$("save").addEventListener("click", () => void save());
void loadRecent();
