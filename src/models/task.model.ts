import { ActivityType } from "./activity.model";

export const TASK_STATUSES = {
  "in-progress": "进行中",
  "complete": "已完成",
  "needs-attention": "需要关注",
  "cancelled": "已取消",
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

export type TaskGroupBy =
  | "none"
  | "createdDate"
  | "dueDate"
  | "updatedDate"
  | "activityType";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  percentComplete: number;
  dueDate?: Date | null;
  activityTypeId?: string | null;
  activityType?: ActivityType | null;
  activities?: { id: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithActivityType extends Task {
  activityType: ActivityType | null;
}
