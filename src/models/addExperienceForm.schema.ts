import { z } from "zod";

export const AddExperienceFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("工作经历").optional(),
  sectionType: z.string().optional(),
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
  jobDescription: z.string().min(10, {
    message: "职位描述至少需要 10 个字符。",
  }),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  currentJob: z.boolean().default(false).optional(),
});
