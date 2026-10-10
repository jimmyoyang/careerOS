import { zhLabel } from "@/lib/i18n/zh-CN";
import { cn } from "@/lib/utils";
import { getPlatformMeta } from "@/lib/career/platforms";

export function PlatformBadge({
  source,
  label,
  compact = false,
  className,
}: {
  source?: string | null;
  label?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const meta = getPlatformMeta(source || label);
  const displayLabel = zhLabel(label?.trim() || meta.label);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        compact && "px-1.5 text-[11px]",
        className,
      )}
      aria-label={displayLabel}
      style={{
        color: meta.accent,
        borderColor: `${meta.accent}35`,
        backgroundColor: meta.surface,
      }}
      title={displayLabel}
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: meta.accent }}
      >
        {meta.shortLabel}
      </span>
      <span className="break-words">{displayLabel}</span>
    </span>
  );
}
