import { z } from "zod";
import { APP_CONSTANTS } from "@/lib/constants";

export const AddJobFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string({
      error: "请填写职位名称。",
    })
    .min(2, {
      message: "职位名称至少需要 2 个字符。",
    }),
  company: z
    .string({
      error: "请填写公司名称。",
    })
    .min(2, {
      message: "公司名称至少需要 2 个字符。",
    }),
  location: z
    .string({
      error: "请填写地点。",
    })
    .min(2, {
      message: "地点名称至少需要 2 个字符。",
    }),
  type: z.string().min(1),
  workplaceType: z.string().optional(),
  source: z
    .string({
      error: "请选择来源。",
    })
    .min(2, {
      message: "来源名称至少需要 2 个字符。",
    }),
  status: z
    .string({
      error: "请选择状态。",
    })
    .min(2, {
      message: "状态至少需要 2 个字符。",
    })
    .default("draft"),
  dueDate: z.date(),
  /**
   * Note: Timezone offsets can be allowed by setting the offset option to true.
   * z.string().datetime({ offset: true });
   */
  //
  dateApplied: z.date().optional(),
  salaryRange: z.string().optional(),
  jobDescription: z
    .string({
      error: "请填写职位描述。",
    })
    .refine((val) => val === "N/A" || val.length >= 10, {
      message: "职位描述至少需要 10 个字符。",
    }),
  jobUrl: z.string().optional(),
  resume: z.string().optional(),
  coverLetter: z.string().optional(),
  tags: z
    .array(z.string())
    .max(APP_CONSTANTS.MAX_JOB_TAGS)
    .optional()
    .default([]),
});
