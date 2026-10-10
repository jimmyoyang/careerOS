"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { APP_CONSTANTS } from "@/lib/constants";
import type { AtsConfigValue } from "./types";

interface RunOptionsFieldsProps {
  value: AtsConfigValue;
  onChange: (next: AtsConfigValue) => void;
}

export function RunOptionsFields({ value, onChange }: RunOptionsFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>
          每次运行分析的岗位数： {value.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN}
        </Label>
        <Slider
          min={1}
          max={APP_CONSTANTS.ATS_LISTING_CAP}
          step={1}
          value={[value.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN]}
          onValueChange={(next) => onChange({ ...value, topK: next[0] })}
        />
        <p className="text-sm text-muted-foreground">
          每次运行接受完整 AI 匹配分析的岗位数。数量越多，覆盖范围越广，耗时和费用也越高。
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>保存其他相关岗位</Label>
          <p className="text-sm text-muted-foreground">
            开启后，也会保存相关但未进入前 K 名的岗位。这些岗位仅经过关键词排序，尚未进行 AI 评分，可随后在发现的岗位列表中按需分析。
          </p>
        </div>
        <Switch
          checked={value.saveUnanalyzed !== false}
          onCheckedChange={(checked) =>
            onChange({ ...value, saveUnanalyzed: checked })
          }
        />
      </div>
    </>
  );
}
