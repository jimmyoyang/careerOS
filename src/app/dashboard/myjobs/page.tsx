import { Metadata } from "next";

import { getJobSourceList, getStatusList } from "@/actions/job.actions";
import JobsContainer from "@/components/myjobs/JobsContainer";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllTags } from "@/actions/tag.actions";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "职位跟踪",
};

async function MyJobs() {
  const [statuses, companies, titles, locations, sources, tags] =
    await Promise.all([
      getStatusList(),
      getAllCompanies(),
      getAllJobTitles(),
      getAllJobLocations(),
      getJobSourceList(),
      getAllTags(),
    ]);
  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="职位跟踪" description="统一管理岗位来源、申请状态、联系人和下一步行动。" />
      <JobsContainer
        companies={companies}
        titles={titles}
        locations={locations}
        sources={sources}
        statuses={statuses}
        tags={tags ?? []}
      />
    </div>
  );
}

export default MyJobs;
