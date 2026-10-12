"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Briefcase } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CircularScore } from "@/components/CircularScore";
import { StatusBadge } from "@/components/StatusBadge";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import type { CompanyJobRow } from "@/models/companyDetails.model";

type CompanyJobsTabProps = {
  jobs: CompanyJobRow[];
};

// Read-only on purpose: every job action already lives on the job's own page
export function CompanyJobsTab({ jobs }: CompanyJobsTabProps) {
  if (jobs.length === 0) {
    return (
      <JobTabEmptyState
        icon={Briefcase}
        title="该公司暂无职位"
        description="你添加的或从自动化任务中收录的该公司职位会显示在这里。"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>标题</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="hidden md:table-cell">地点</TableHead>
          <TableHead className="hidden md:table-cell">已投递</TableHead>
          <TableHead>匹配</TableHead>
          <TableHead className="hidden md:table-cell">来源</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">
              <Link
                href={`/dashboard/myjobs/${job.id}`}
                className="hover:underline underline-offset-4"
              >
                {job.JobTitle.label}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge
                label={job.Status.label}
                color={getJobStatusBadgeColor(job.Status.value)}
              />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.Location?.label ?? "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.appliedDate
                ? format(new Date(job.appliedDate), "yyyy年M月d日")
                : job.applied
                  ? "已投递"
                  : "未投递"}
            </TableCell>
            <TableCell>
              {job.matchScore != null ? (
                <CircularScore score={job.matchScore} size="sm" />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.JobSource?.label ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
