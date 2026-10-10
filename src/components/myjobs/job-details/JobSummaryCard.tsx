"use client";

import { format } from "date-fns";
import Link from "next/link";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformBadge } from "@/components/career/PlatformBadge";
import { CircularScore } from "@/components/CircularScore";
import { StatusBadge } from "@/components/StatusBadge";
import { DownloadFileButton } from "@/components/profile/DownloadFileButton";
import { BADGE_COLORS, getJobStatusBadgeColor } from "@/lib/badge-colors";
import { cn, formatUrl } from "@/lib/utils";
import type { JobMatchData } from "@/models/ai.schemas";
import {
  JobResponse,
  JobStatus,
  getJobTypeLabel,
  getWorkplaceTypeLabel,
} from "@/models/job.model";

type JobSummaryCardProps = {
  job: JobResponse;
  currentStatus: JobStatus;
  matchData: JobMatchData | null;
};

export function JobSummaryCard({
  job,
  currentStatus,
  matchData,
}: JobSummaryCardProps) {
  const expired =
    job.dueDate &&
    new Date() > new Date(job.dueDate) &&
    currentStatus?.value === "draft";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">状态</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {expired ? (
                <StatusBadge label="已过期" color="amber" />
              ) : (
                <StatusBadge
                  label={currentStatus?.label ?? ""}
                  color={getJobStatusBadgeColor(currentStatus?.value ?? "")}
                />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">职位类型</p>
            <p className="mt-1 font-medium">
              {getJobTypeLabel(job.jobType)}
              {job.workplaceType &&
                ` · ${getWorkplaceTypeLabel(job.workplaceType)}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">薪资范围</p>
            <p className="mt-1 font-medium">{job.salaryRange || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">来源</p>
            <div className="mt-1"><PlatformBadge source={job.JobSource?.value} label={job.JobSource?.label} /></div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">已投递</p>
            <p className="mt-1 font-medium">
              {job.appliedDate
                ? format(new Date(job.appliedDate), "yyyy年M月d日")
                : job.applied
                  ? "已投递，日期未记录"
                  : "未投递"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">AI 匹配</p>
            {job.matchScore != null && matchData?.analyzed !== false ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <CircularScore score={job.matchScore} size="sm" />
                {matchData?.recommendation && (
                  <Badge variant="outline" className="capitalize">
                    {matchData.recommendation}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-1 font-medium">尚未匹配</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">简历</p>
            <div className="mt-1 font-medium">
              {job.Resume?.File?.filePath ? (
                DownloadFileButton(
                  job.Resume.id!,
                  job.Resume.File.filePath,
                  job.Resume.title,
                  job.Resume.File.fileName,
                )
              ) : job.Resume?.id ? (
                <Link
                  href={`/dashboard/profile/resume/${job.Resume.id}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {job.Resume.title}
                </Link>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">添加时间</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {job.createdAt ? format(new Date(job.createdAt), "yyyy年M月d日") : "-"}
              </span>
              {job.createdVia && (
                <Badge
                  variant="outline"
                  className={cn("gap-1", BADGE_COLORS.violet)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  来自 {job.createdVia}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(job.jobUrl || (job.tags && job.tags.length > 0)) && (
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-4">
            {job.jobUrl && (
              <a
                href={formatUrl(job.jobUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {job.jobUrl}
              </a>
            )}
            {job.tags && job.tags.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1">
                {job.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
