import { z } from "zod";

export const AddEducationFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("教育经历").optional(),
  sectionType: z.string().optional(),
  institution: z
    .string({
      error: "请填写学校名称。",
    })
    .min(2),
  degree: z
    .string({
      error: "请填写学位。",
    })
    .min(2),
  fieldOfStudy: z
    .string({
      error: "请填写专业。",
    })
    .min(2),
  location: z
    .string({
      error: "请填写地点。",
    })
    .min(2, {
      message: "地点名称至少需要 2 个字符。",
    }),
  description: z.string().nullable().optional(),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  degreeCompleted: z.boolean().default(true).optional(),
});
