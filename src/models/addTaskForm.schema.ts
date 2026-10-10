import { z } from "zod";

export const AddTaskFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string({ error: "请填写标题。" })
    .min(2, { message: "标题至少需要 2 个字符。" }),
  description: z
    .string()
    .max(2000, { message: "描述不能超过 2000 个字符。" })
    .optional()
    .nullable(),
  status: z.enum(["in-progress", "complete", "needs-attention", "cancelled"]),
  priority: z.number().min(0).max(10),
  percentComplete: z.number().min(0).max(100),
  dueDate: z
    .date()
    .optional()
    .nullable()
    .refine(
      (date) => {
        if (!date) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      { message: "截止日期不能早于今天。" }
    ),
  activityTypeId: z.string().optional().nullable(),
});
