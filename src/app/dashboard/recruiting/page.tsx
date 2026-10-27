import RecruitingWorkspace from "@/components/recruiting/RecruitingWorkspace";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "求职资料与账号" };

export default function RecruitingPage() {
  return <div className="col-span-3 min-w-0"><PageHeader title="求职资料与账号" description="把通用网申资料和不同招聘平台的登录绑定关系整理清楚。" /><RecruitingWorkspace /></div>;
}
