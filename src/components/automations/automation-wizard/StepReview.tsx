"use client";

import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { AtsConfigValue } from "../AtsSearchStep";
import type { WizardResume } from "./wizardConfig";

export function StepReview({
  formValues,
  atsConfig,
  selectedResume,
}: {
  formValues: CreateAutomationInput;
  atsConfig: AtsConfigValue;
  selectedResume?: WizardResume;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex justify-between">
        <span className="text-muted-foreground">名称</span>
        <span className="font-medium">{formValues.name || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">招聘平台</span>
        <span className="font-medium capitalize">
          {formValues.jobBoard || "-"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">公司</span>
        <span className="font-medium text-right">
          {atsConfig.companies?.length
            ? atsConfig.companies.map((c) => c.name).join(", ")
            : "-"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">目标职位</span>
        <span className="font-medium text-right">
          {atsConfig.targetTitles?.length
            ? atsConfig.targetTitles.join(", ")
            : "不限"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">地点</span>
        <span className="font-medium text-right">
          {atsConfig.locations?.length
            ? `${atsConfig.locations.join(", ")}${
                atsConfig.strictLocation ? "（严格匹配）" : ""
              }`
            : "不限地点"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">每次运行分析的岗位数</span>
        <span className="font-medium text-right">
          {atsConfig.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">保存其他岗位</span>
        <span className="font-medium text-right">
          {atsConfig.saveUnanalyzed !== false ? "是" : "否"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">简历</span>
        <span className="font-medium">
          {selectedResume?.title || "未选择"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">匹配阈值</span>
        <span className="font-medium">{formValues.matchThreshold ?? 80}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">计划时间</span>
        <span className="font-medium">
          每天{" "}
          {(formValues.scheduleHour ?? 8).toString().padStart(2, "0")}:00
        </span>
      </div>
    </div>
  );
}
