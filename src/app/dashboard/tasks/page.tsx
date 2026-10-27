import TasksPageClient from "./TasksPageClient";
import { getAllActivityTypes } from "@/actions/activity.actions";
import { getActivityTypesWithTaskCounts } from "@/actions/task.actions";
import React from "react";
import { PageHeader } from "@/components/PageHeader";

async function Tasks() {
  const [activityTypes, activityTypesWithCounts] = await Promise.all([
    getAllActivityTypes(),
    getActivityTypesWithTaskCounts(),
  ]);

  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="待办事项" description="把岗位准备、材料审核和跟进动作拆成下一步可完成的任务。" />
      <TasksPageClient
        activityTypes={activityTypes || []}
        activityTypesWithCounts={activityTypesWithCounts?.data || []}
        totalTasks={activityTypesWithCounts?.totalTasks || 0}
      />
    </div>
  );
}

export default Tasks;
