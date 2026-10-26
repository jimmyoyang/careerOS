export type CaptureDocument = {
  title: string;
  url: string;
  meta: Record<string, string | undefined>;
  headings: string[];
  text: string;
};

export type JobDraft = {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  capturedAt: string;
  missing: Array<"title" | "company" | "location" | "description">;
};

const MAX_DESCRIPTION_LENGTH = 12_000;
const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function first(...values: Array<string | undefined>) {
  return values.map(clean).find(Boolean) ?? "";
}

function splitTitle(value: string): { title: string; company: string } {
  const separator = value.match(/\s+(?:[-–—|｜]|@)\s+/);
  if (!separator || separator.index === undefined) return { title: value, company: "" };
  return {
    title: value.slice(0, separator.index).trim(),
    company: value.slice(separator.index + separator[0].length).trim(),
  };
}

function findLine(text: string, label: RegExp) {
  const line = text.split(/[\n\r]+/).map(clean).find((item) => label.test(item));
  return line ? line.replace(label, "").replace(/^[:：\s]+/, "").trim() : "";
}

export function extractJobDraft(document: CaptureDocument, now = new Date()): JobDraft {
  const rawTitle = first(document.meta["og:title"], document.title, document.headings[0]);
  const titleParts = splitTitle(rawTitle);
  const title = titleParts.title;
  const company = first(
    document.meta["og:site_name"],
    document.meta["company"],
    titleParts.company,
    findLine(document.text, /^(?:公司|招聘公司|雇主)\s*[:：]/),
  );
  const location = first(
    document.meta["job:location"],
    document.meta["location"],
    findLine(document.text, /^(?:工作地点|工作城市|地点|城市)\s*[:：]/),
    document.text.split(/[\n\r]+/).map(clean).find((line) => /^(北京|上海|广州|深圳|杭州|成都|武汉|西安|南京|苏州|天津|重庆)(?:市)?(?:\s|$)/.test(line)),
  );
  const visibleDescription = document.text
    .split(/[\n\r]+/)
    .map(clean)
    .filter((line) => line && line !== rawTitle && line !== title && line !== company && line !== location && !/^(?:工作地点|工作城市|地点|城市|公司|招聘公司|雇主)\s*[:：]/.test(line))
    .join(" ");
  const description = first(document.meta.description, visibleDescription).slice(0, MAX_DESCRIPTION_LENGTH);
  const missing = (["title", "company", "location", "description"] as const).filter((key) => !({ title, company, location, description }[key]));
  return { title, company, location, description, sourceUrl: document.url, capturedAt: now.toISOString(), missing: [...missing] };
}
