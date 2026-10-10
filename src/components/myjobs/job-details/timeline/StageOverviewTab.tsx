"use client";
import { zhLabel } from "@/lib/i18n/zh-CN";
import { Clock, MapPin, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STAGE_OUTCOMES } from "@/lib/constants";
import type { JobStage } from "@/models/jobStage.model";
import { isInterviewStage } from "./stageDisplay";
import { StageNotes } from "./StageNotes";

type StageOverviewTabProps = {
  stage: JobStage;
  onChanged: () => void;
};

function StageFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon: LucideIcon;
}) {
  return (
    <div>
      <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="mt-1.5 flex items-center gap-2 text-sm">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {value ?? <span className="text-muted-foreground">未设置</span>}
      </p>
    </div>
  );
}

export function StageOverviewTab({ stage, onChanged }: StageOverviewTabProps) {
  const outcomeLabel = STAGE_OUTCOMES.find(
    (o) => o.value === stage.outcome,
  )?.label;

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
          结果
        </span>
        <p className="mt-1.5 text-sm">
          {outcomeLabel ? (
            <Badge variant="secondary">{zhLabel(outcomeLabel)}</Badge>
          ) : (
            <span className="text-muted-foreground">未记录</span>
          )}
        </p>
      </div>

      {isInterviewStage(stage) && (
        <div className="grid gap-4 @lg/timeline:grid-cols-3">
          <StageFact label="地点" value={stage.location} icon={MapPin} />
          <StageFact label="形式" value={stage.format} icon={Monitor} />
          <StageFact
            label="时长"
            value={stage.durationMins ? `${stage.durationMins} 分钟` : null}
            icon={Clock}
          />
        </div>
      )}

      <StageNotes stage={stage} onChanged={onChanged} />
    </div>
  );
}
