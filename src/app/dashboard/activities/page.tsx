import ActivitiesContainer from "@/components/activities/ActivitiesContainer";
import React from "react";
import { PageHeader } from "@/components/PageHeader";

function Activities() {
  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="活动记录" description="记录准备、投递和复盘投入的时间，保持求职节奏可见。" />
      <ActivitiesContainer />
    </div>
  );
}

export default Activities;
