type CaptureDocument = {
  title: string;
  url: string;
  meta: Record<string, string | undefined>;
  headings: string[];
  text: string;
};

type ContentJobDraft = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  capturedAt: string;
  missing: string[];
};

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const first = (...values: Array<string | undefined>) => values.map(clean).find(Boolean) ?? "";
const splitTitle = (value: string) => {
  const separator = value.match(/\s+(?:[-–—|｜]|@)\s+/);
  if (!separator || separator.index === undefined) return { title: value, company: "" };
  return { title: value.slice(0, separator.index).trim(), company: value.slice(separator.index + separator[0].length).trim() };
};
const findLine = (text: string, label: RegExp) => {
  const line = text.split(/[\n\r]+/).map(clean).find((item) => label.test(item));
  return line ? line.replace(label, "").replace(/^[:：\s]+/, "").trim() : "";
};
function extract(document: CaptureDocument): ContentJobDraft {
  const rawTitle = first(document.meta["og:title"], document.title, document.headings[0]);
  const titleParts = splitTitle(rawTitle);
  const title = titleParts.title;
  const company = first(document.meta["og:site_name"], document.meta.company, titleParts.company, findLine(document.text, /^(?:公司|招聘公司|雇主)\s*[:：]/));
  const location = first(document.meta["job:location"], document.meta.location, findLine(document.text, /^(?:工作地点|工作城市|地点|城市)\s*[:：]/), document.text.split(/[\n\r]+/).map(clean).find((line) => /^(北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|苏州|天津|重庆)(?:市)?(?:\s|$)/.test(line)));
  const visibleDescription = document.text.split(/[\n\r]+/).map(clean).filter((line) => line && line !== rawTitle && line !== title && line !== company && line !== location && !/^(?:工作地点|工作城市|地点|城市|公司|招聘公司|雇主)\s*[:：]/.test(line)).join(" ");
  const description = first(document.meta.description, visibleDescription).slice(0, 12000);
  const missing = ["title", "company", "location", "description"].filter((key) => !({ title, company, location, description } as Record<string, string>)[key]);
  return { title, company, location, description, sourceUrl: document.url, capturedAt: new Date().toISOString(), missing };
}
function page(): CaptureDocument {
  const meta: Record<string, string | undefined> = {};
  document.querySelectorAll("meta").forEach((element) => {
    const key = element.getAttribute("property") || element.getAttribute("name");
    if (key) meta[key] = element.getAttribute("content") ?? undefined;
  });
  return {
    title: document.title,
    url: location.href,
    meta,
    headings: Array.from(document.querySelectorAll("h1, h2")).slice(0, 8).map((element) => element.textContent ?? ""),
    text: document.body?.innerText ?? "",
  };
}
chrome.runtime.onMessageAddListener((message, _sender, sendResponse) => {
  if (message && typeof message === "object" && (message as { type?: string }).type === "capture") sendResponse(extract(page()));
});
