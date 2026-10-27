import { Metadata } from "next";

import InterviewsContainer from "@/components/interviews/InterviewsContainer";
import { getInterviewFilterOptions } from "@/actions/interview.actions";
import { getAllJobStageTypes } from "@/actions/jobStageType.actions";
import { getStatusList } from "@/actions/job.actions";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "面试 | CareerOS",
};

async function Interviews() {
  const [filters, stageTypes, statuses] = await Promise.all([
    getInterviewFilterOptions(),
    getAllJobStageTypes(),
    getStatusList(),
  ]);

  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="面试安排" description="集中查看即将到来的面试、面试轮次和准备记录。" />
      <InterviewsContainer
        rounds={filters?.rounds ?? []}
        companies={filters?.companies ?? []}
        stageTypes={stageTypes ?? []}
        jobStatuses={statuses ?? []}
      />
    </div>
  );
}

export default Interviews;
