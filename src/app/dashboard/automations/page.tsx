import { getResumeList } from "@/actions/profile.actions";
import { AutomationContainer } from "@/components/automations/AutomationContainer";
import { APP_CONSTANTS } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";

export default async function AutomationsPage() {
  const resumeResult = await getResumeList(
    1,
    100,
    APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION,
  );
  const resumes =
    resumeResult?.data?.map((r: { id: string; title: string }) => ({
      id: r.id,
      title: r.title,
    })) || [];

  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="自动任务" description="配置岗位发现、筛选和候选审核，让重复工作按计划运行。" />
      <AutomationContainer resumes={resumes} />
    </div>
  );
}
