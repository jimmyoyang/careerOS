import Papa from "papaparse";
import { ImportSchema, type Requirements } from "./contracts";
import { CareerError } from "./errors";
import { hash } from "./hash";

export function postingKey(input: {
  platform: string;
  recruitmentType: string;
  cohort: string;
  postingId: string;
}): string | null {
  if (
    !input.postingId ||
    !input.cohort ||
    [input.platform, input.recruitmentType].includes("unknown")
  )
    return null;
  return hash([
    input.platform,
    input.recruitmentType,
    input.cohort,
    input.postingId,
  ]);
}

// Conservative, explainable extraction. Unrecognized lines stay visible and unknown.
export function parseJd(rawJd: string): Requirements {
  if (!rawJd.trim() || rawJd.length > 30000)
    throw new CareerError(
      "INVALID_INPUT",
      "JD 应为 1–30000 字符，请分拆过长的岗位描述。",
    );
  const items: Requirements["items"] = [];
  const rawJdHash = hash(rawJd);
  for (const match of rawJd.matchAll(/[^\r\n]+/g)) {
    const text = match[0].trim();
    if (!text) continue;
    const start = match.index! + match[0].indexOf(text);
    let field: Requirements["items"][number]["field"] = "other";
    let value: string | number | null = null;
    const degree = text.match(/(博士|硕士|本科|大专)(?:及以上|以上|学历|学位)/);
    const year = text.match(/(20\d{2})\s*届/);
    const days = text.match(/(?:每周|一周)[^\d\n]{0,8}(\d)\s*天/);
    const months = text.match(
      /(?:至少|不少于|实习)[^\d\n]{0,8}(\d{1,2})\s*个?月/,
    );
    if (degree) {
      field = "degree";
      value = {
        大专: "associate",
        本科: "bachelor",
        硕士: "master",
        博士: "doctor",
      }[degree[1]]!;
    } else if (year) {
      field = "graduationYear";
      value = Number(year[1]);
    } else if (days) {
      field = "daysPerWeek";
      value = Number(days[1]);
    } else if (months) {
      field = "months";
      value = Number(months[1]);
    } else if (/熟悉|掌握|熟练|经验|proficien|experience|knowledge/i.test(text))
      field = "skill";
    // Multiple gates in one sentence need manual review rather than silently dropping one.
    if ([degree, year, days, months].filter(Boolean).length > 1) {
      field = "other";
      value = null;
    }
    const mandatory =
      !/优先|加分|preferred|nice.to.have/i.test(text) &&
      ((field !== "other" && field !== "skill") ||
        /必须|要求|至少|required|must/i.test(text));
    items.push({
      key: `r${items.length + 1}`,
      text,
      mandatory,
      field,
      value,
      source: { rawJdHash, start, end: start + text.length, quote: text },
    });
  }
  if (items.length > 120)
    throw new CareerError(
      "INVALID_INPUT",
      "JD 超过 120 个段落，请按岗位拆分；未进行截断分析。",
    );
  return { schemaVersion: 1, parser: "conservative-lines-v1", items };
}

export function parseImportTable(text: string) {
  if (text.length > 1_000_000)
    throw new CareerError("INVALID_INPUT", "导入表格不能超过 1 MB。");
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
    },
  );
  if (result.errors.length || result.data.length > 100)
    throw new CareerError(
      "INVALID_INPUT",
      "请检查 CSV / TSV 格式，每批最多 100 行。",
    );
  return result.data.map((row) =>
    ImportSchema.parse({
      company: row.company ?? row["公司"],
      title: row.title ?? row["岗位"],
      rawJd: row.jd ?? row.rawjd ?? row["JD"] ?? row["岗位描述"],
      location: row.location ?? row["城市"] ?? "",
      url: row.url ?? row["链接"] ?? "",
      dueDate: row.duedate ?? row["截止日期"] ?? "",
      cohort: row.cohort ?? row["批次"] ?? "",
      postingId: row.postingid ?? row["岗位id"] ?? "",
      platform: row.platform || "unknown",
      recruitmentType: row.recruitmenttype || "unknown",
      referral: row.referral ?? row["内推"] ?? "",
    }),
  );
}
