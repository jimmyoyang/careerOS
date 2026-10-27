import ProfileContainer from "@/components/profile/ProfileContainer";
import React from "react";
import { PageHeader } from "@/components/PageHeader";

function Profile() {
  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="简历中心" description="维护通用资料和多个申请方向的简历版本。" />
      <ProfileContainer />
    </div>
  );
}

export default Profile;
