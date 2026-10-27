import { zhLabel } from "@/lib/i18n/zh-CN";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { PlatformBadge } from "@/components/career/PlatformBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchJobButton } from "@/components/myjobs/MatchJobButton";
import { JobResponse, getWorkplaceTypeLabel } from "@/models/job.model";

export function SearchJobResults({ jobs, view }: { jobs: JobResponse[]; view: string }) {
  if (view === "table") return (
    <div className="app-surface overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">职位搜索结果</caption>
        <thead className="border-b bg-muted/50"><tr>{["职位", "公司", "地点", "来源", "状态", "简历匹配"].map((heading) => <th scope="col" key={heading} className="whitespace-nowrap p-4">{heading}</th>)}</tr></thead>
        <tbody>{jobs.map((job) => <tr key={job.id} className="border-b last:border-0">
          <td className="min-w-40 p-4"><Link className="font-medium text-primary hover:underline" href={`/dashboard/myjobs/${job.id}`}>{job.JobTitle?.label ?? "未命名职位"}</Link></td>
          <td className="p-4">{job.Company?.label ?? "公司待确认"}</td>
          <td className="p-4">{job.Location?.label ?? "地点待确认"}</td>
          <td className="p-4"><PlatformBadge source={job.JobSource?.value} label={job.JobSource?.label} /></td>
          <td className="p-4">{zhLabel(job.Status?.label ?? "未设置状态")}</td>
          <td className="p-4"><MatchJobButton jobId={job.id} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
  return <div className="grid gap-4 @3xl/main:grid-cols-2">
    {jobs.map((job) => <Card key={job.id} className="min-w-0 transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-40">
            <Link href={`/dashboard/myjobs/${job.id}`} className="break-words text-lg font-semibold hover:text-[#cf0a2c]">{job.JobTitle?.label ?? "未命名职位"}</Link>
            <p className="mt-1 break-words text-sm text-muted-foreground">{job.Company?.label ?? "公司待确认"}</p>
          </div>
          <PlatformBadge source={job.JobSource?.value} label={job.JobSource?.label} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 shrink-0" />{job.Location?.label ?? "地点待确认"}</span>
          <span>{getWorkplaceTypeLabel(job.workplaceType, "工作方式待确认")}</span>
          {job.salaryRange && <span>{job.salaryRange}</span>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">{zhLabel(job.Status?.label ?? "未设置状态")}</span>
          <div className="flex items-center gap-2"><MatchJobButton jobId={job.id} />
            <Button asChild size="sm" variant="ghost" className="text-[#cf0a2c]"><Link href={`/dashboard/myjobs/${job.id}`}>查看职位<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </CardContent>
    </Card>)}
  </div>;
}
