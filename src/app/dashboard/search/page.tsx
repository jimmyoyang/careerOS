import { Metadata } from "next";

import { getJobSourceList, getStatusList } from "@/actions/job.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { JobSearchWorkspace } from "@/components/search/JobSearchWorkspace";

export const metadata: Metadata = { title: "职位搜索 | CareerOS" };

export default async function SearchPage() {
  const [sources, locations, statuses, titles] = await Promise.all([
    getJobSourceList(),
    getAllJobLocations(),
    getStatusList(),
    getAllJobTitles(),
  ]);
  if (![sources, locations, statuses, titles].every(Array.isArray)) {
    throw new Error("职位筛选数据加载失败，请刷新重试");
  }
  return <JobSearchWorkspace sources={sources} locations={locations} statuses={statuses} titles={titles} />;
}
