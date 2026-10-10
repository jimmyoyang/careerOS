import { zhLabel } from "@/lib/i18n/zh-CN";
import { zhCN } from "date-fns/locale";
import { format } from "date-fns";
import { STAGE_OUTCOMES } from "@/lib/constants";
import { BadgeColor } from "@/lib/badge-colors";

// A round created through Add Stage has no outcome — the field only appears
// when editing — so a null one is derived from the date rather than left as a
// dash. Nothing here is ever written back.
export function outcomeLabel(
  occurredAt: Date | null,
  outcome: string | null,
  now: Date = new Date(),
): string {
  const stored = STAGE_OUTCOMES.find((o) => o.value === outcome);
  if (stored) return zhLabel(stored.label);
  if (!occurredAt) return zhLabel("Not scheduled");
  return zhLabel(occurredAt.getTime() >= now.getTime() ? "Scheduled" : "Awaiting outcome");
}

// Keyed on the label rather than the value, because three of the labels are
// derived (outcomeLabel) and have no stored value to key on.
const OUTCOME_BADGE_COLORS: Record<string, BadgeColor> = {
  Scheduled: "blue",
  Completed: "teal",
  Passed: "emerald",
  Failed: "red",
  "No-show": "red",
  Cancelled: "slate",
  "Awaiting outcome": "amber",
  "Not scheduled": "slate",
};

export function outcomeColor(label: string): BadgeColor {
  return Object.entries(OUTCOME_BADGE_COLORS).find(([key]) => zhLabel(key) === zhLabel(label))?.[1] ?? "slate";
}

export type FormatIcon = "video" | "phone" | "location";

// JobStage.format is free text, so the icon is a guess that degrades to a
// neutral pin rather than to a wrong icon.
export function formatIconKind(value: string | null): FormatIcon {
  if (!value) return "location";
  if (/video|zoom|meet|teams|hangout|webex/i.test(value)) return "video";
  if (/phone|call|voice/i.test(value)) return "phone";
  return "location";
}

export function formatText(
  value: string | null,
  location: string | null,
): string {
  return location?.trim() || value?.trim() || "未设置";
}

export function durationLabel(mins: number | null): string | null {
  if (!mins) return null;
  return mins >= 60 && mins % 60 === 0 ? `${mins / 60} 小时` : `${mins} 分钟`;
}

export function whenParts(occurredAt: Date | null): {
  day: string;
  time: string | null;
} {
  if (!occurredAt) return { day: "无日期", time: null };
  return {
    day: format(occurredAt, "M月d日 EEEE", { locale: zhCN }),
    time: format(occurredAt, "HH:mm"),
  };
}

function abbreviate(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return `${parts[0]![0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
}

export function interviewerSummary(
  interviewers: { Contact: { name: string } }[],
): string {
  if (interviewers.length === 0) return "未关联";
  if (interviewers.length > 2) return `${interviewers.length} 位面试官`;
  return interviewers.map((i) => abbreviate(i.Contact.name)).join(", ");
}

export function prepSummary(prep: { asked: boolean }[]): string {
  const asked = prep.filter((p) => p.asked).length;
  return asked > 0 ? `${asked} / ${prep.length}` : String(prep.length);
}
