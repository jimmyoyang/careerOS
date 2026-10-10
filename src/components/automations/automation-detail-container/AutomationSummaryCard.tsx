"use client";

import { zhLabel } from "@/lib/i18n/zh-CN";

import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Clock, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationWithResume } from "@/models/automation.model";
import { AutomationSearchConfig } from "./AutomationSearchConfig";

interface AutomationSummaryCardProps {
  automation: AutomationWithResume;
  retired: boolean;
  resumeMissing: boolean;
  isRunning: boolean;
  totalJobs: number;
  newJobsCount: number;
}

export function AutomationSummaryCard({
  automation,
  retired,
  resumeMissing,
  isRunning,
  totalJobs,
  newJobsCount,
}: AutomationSummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">状态</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  automation.status === "active" ? "default" : "secondary"
                }
              >
                {zhLabel(automation.status)}
              </Badge>
              {isRunning && (
                <Badge variant="default" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  运行中
                </Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">招聘平台</p>
            <p className="font-medium capitalize">{automation.jobBoard}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">匹配阈值</p>
            <p className="font-medium">{automation.matchThreshold}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">计划时间</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {automation.scheduleHour.toString().padStart(2, "0")}:00 每日运行
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">简历</p>
            {resumeMissing ? (
              <p className="text-amber-600 flex items-center gap-1 text-sm">
                <AlertTriangle className="h-4 w-4" />
                缺失
              </p>
            ) : (
              <Link
                href={`/dashboard/profile/resume/${automation.resume.id}`}
                className="font-medium flex items-center gap-1 hover:underline"
              >
                <FileText className="h-4 w-4" />
                {automation.resume.title}
              </Link>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">下次运行</p>
            <p className="font-medium">
              {automation.nextRunAt && automation.status === "active"
                ? format(new Date(automation.nextRunAt), "M月d日 HH:mm")
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">最近运行</p>
            <p className="font-medium">
              {automation.lastRunAt
                ? format(new Date(automation.lastRunAt), "M月d日 HH:mm")
                : "从未运行"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">发现的岗位</p>
            <p className="font-medium">
              共 {totalJobs} 个
              {newJobsCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {newJobsCount} 个新岗位
                </Badge>
              )}
            </p>
          </div>
        </div>

        <AutomationSearchConfig
          sourceConfig={automation.sourceConfig}
          jobBoard={automation.jobBoard}
          retired={retired}
        />
      </CardContent>
    </Card>
  );
}
