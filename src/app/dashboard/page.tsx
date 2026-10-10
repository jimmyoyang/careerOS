import {
  getActivityCalendarData,
  getActivityDataForPeriod,
  getJobsActivityForPeriod,
  getJobsActivitySummary,
  getRecentActivities,
  getRecentJobs,
} from "@/actions/dashboard.actions";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import JobsActivityCard from "@/components/dashboard/JobsActivityCard";
import JobsApplied from "@/components/dashboard/JobsAppliedCard";
import RecentCardToggle from "@/components/dashboard/RecentCardToggle";
import WeeklyBarChartToggle from "@/components/dashboard/WeeklyBarChartToggle";
import { CareerWorkspaceHero } from "@/components/dashboard/CareerWorkspaceHero";
import { PlatformHighlights } from "@/components/dashboard/PlatformHighlights";
import { getResumeList, getDefaultResumeId } from "@/actions/profile.actions";
import Link from "next/link";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "招聘工作台 | CareerOS",
};

export default async function Dashboard() {
  const [
    summary7Days,
    summary30Days,
    recentJobs,
    recentActivities,
    weeklyData,
    activitiesData,
    activityCalendarData,
    resumeList,
    defaultResumeId,
  ] = await Promise.all([
    getJobsActivitySummary(7),
    getJobsActivitySummary(30),
    getRecentJobs(),
    getRecentActivities(),
    getJobsActivityForPeriod(),
    getActivityDataForPeriod(),
    getActivityCalendarData(),
    getResumeList(1, 1),
    getDefaultResumeId(),
  ]);
  const activityCalendarDataKeys = Object.keys(activityCalendarData);
  const platformCounts = new Map<string, { value: string; label: string; count: number }>();
  recentJobs.forEach((job: { JobSource?: { value?: string; label?: string } | null }) => {
    const { value, label } = job.JobSource ?? {};
    if (value && label) platformCounts.set(value, { value, label, count: (platformCounts.get(value)?.count ?? 0) + 1 });
  });
  const sourceHighlights = Array.from(platformCounts.values());
  return (
    <>
      <div className="col-span-3 mb-4 space-y-4">
        <CareerWorkspaceHero resumeCount={resumeList?.success ? resumeList.total : null} appliedCount={summary30Days.jobsApplied} />
        <div className="grid gap-4 @3xl/main:grid-cols-2">
          <PlatformHighlights sources={sourceHighlights} />
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">简历准备</h2>
            <p className="text-sm leading-6 text-muted-foreground">{defaultResumeId ? "已设置默认简历。可以继续完善内容，或选择职位进行匹配。" : "先创建或导入简历，完善至少两个内容模块，再将常用版本设为默认。"}</p>
            <ol className="space-y-2 text-sm text-muted-foreground"><li>1. 导入 PDF / DOCX 或在线填写</li><li>2. 核对联系方式、教育与工作经历</li><li>3. 匹配职位，导出用于申请的 PDF</li></ol>
            <div className="flex flex-wrap gap-4 text-sm font-medium text-primary">
              <Link href={defaultResumeId ? `/dashboard/profile/resume/${defaultResumeId}` : "/dashboard/profile"} className="hover:underline">{defaultResumeId ? "完善默认简历 →" : "进入简历中心 →"}</Link>
              <Link href="/dashboard/search" className="hover:underline">搜索已收录职位 →</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="@container grid grid-cols-1 auto-rows-max items-start gap-2 md:gap-2 @3xl/main:col-span-2">
        <div className="grid gap-2 @lg:grid-cols-4">
          <JobsApplied />
          <JobsActivityCard
            data={[
              { label: "7d", summary: summary7Days },
              { label: "30d", summary: summary30Days },
            ]}
          />
        </div>
        <WeeklyBarChartToggle
          charts={[
            {
              label: "Jobs",
              data: weeklyData,
              keys: ["value"],
              axisLeftLegend: "JOBS APPLIED",
            },
            {
              label: "Activities",
              data: activitiesData.data,
              keys: activitiesData.keys,
              groupMode: "stacked",
              axisLeftLegend: "投入时间（小时）",
            },
          ]}
        />
      </div>
      <div className="@3xl/main:relative @3xl/main:self-stretch">
        <RecentCardToggle jobs={recentJobs} activities={recentActivities} />
      </div>
      <div className="w-full col-span-3">
        <ActivityCalendar
          years={activityCalendarDataKeys}
          dataByYear={activityCalendarData}
        />
      </div>
    </>
  );
}
