
import { zhLabel } from "@/lib/i18n/zh-CN";
import { format } from "date-fns";
import { TERMINAL_STAGE_STATUSES } from "@/lib/constants";
import type { JobStage, JobStageTypeRef } from "@/models/jobStage.model";

// An undated stage renders an em dash, never a fabricated date or a blank.
export function formatStageDate(occurredAt: Date | null): string {
  return occurredAt ? format(occurredAt, "M月d日") : "—";
}

// "Scheduled for" only while the stage is still ahead (the artboard's wording,
// kept where it is true): a past stage that reads "Scheduled for" a date
// already gone is wrong, and the prefix doubles as the upcoming/done signal.
export function formatStageDateTime(
  occurredAt: Date | null,
  durationMins: number | null,
): string {
  if (!occurredAt) return "未设置日期";
  const base = format(occurredAt, "yyyy年M月d日 · HH:mm");
  const withDuration = durationMins ? `${base} · ${durationMins} 分钟` : base;
  return occurredAt.getTime() > Date.now()
    ? `已安排在 ${withDuration}`
    : withDuration;
}

// The subtitle both stage dialogs put under their title.
export function stageHeading(stage: JobStage): string {
  const label = zhLabel(stage.StageType?.label ?? "阶段");
  return stage.occurredAt
    ? `${label} · ${format(stage.occurredAt, "yyyy年M月d日")}`
    : label;
}

export function stageInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// The gate is stage KIND, never stage timing: an interview a week away is
// still an interview stage.
export function isInterviewStage(stage: JobStage): boolean {
  return stage.StageType?.Status?.value === "interview";
}

// One greyed step per unreached terminal STATUS, not per type (D6): a user
// whose Library holds a custom "Verbal Offer" under the offer status would
// otherwise get two greyed Offer steps side by side.
export function terminalStagesFor(
  stages: JobStage[],
  stageTypes: JobStageTypeRef[],
): JobStageTypeRef[] {
  const reachedStatuses = new Set(
    stages.map((s) => s.StageType?.Status?.value).filter(Boolean),
  );
  const terminal = new Set<string>(TERMINAL_STAGE_STATUSES);

  const byStatus = new Map<string, JobStageTypeRef>();
  for (const type of [...stageTypes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const status = type.Status?.value ?? "";
    if (!terminal.has(status)) continue;
    if (reachedStatuses.has(status)) continue;
    if (!byStatus.has(status)) byStatus.set(status, type);
  }
  return [...byStatus.values()];
}

export function askedTally(stage: JobStage): { asked: number; total: number } {
  const rows = stage.prepQuestions ?? [];
  return { asked: rows.filter((r) => r.asked).length, total: rows.length };
}
