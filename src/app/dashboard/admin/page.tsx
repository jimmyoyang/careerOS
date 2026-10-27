import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "资料库" };

import AdminTabsContainer from "@/components/admin/AdminTabsContainer";

async function AdminPage() {
  return (
    <div className="flex flex-col col-span-3">
      <PageHeader title="资料库" description="统一维护公司、地点、职位名称和联系人，填写时直接复用。" />
      <AdminTabsContainer />
    </div>
  );
}

export default AdminPage;
