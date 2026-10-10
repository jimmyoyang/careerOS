import { z } from "zod";

export const AddContactInfoFormSchema = z.object({
  id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  resumeId: z.string().optional(),
  firstName: z
    .string({
      error: "请填写名。",
    })
    .trim()
    .min(1, {
      message: "请填写名。",
    }),
  lastName: z
    .string({
      error: "请填写姓。",
    })
    .trim()
    .min(1, {
      message: "请填写姓。",
    }),
  headline: z
    .string({
      error: "请填写职业简介。",
    })
    .min(2, {
      message: "职业简介至少需要 2 个字符。",
    }),
  email: z
    .string({
      error: "请填写邮箱。",
    })
    .email("请输入有效的邮箱地址。"),
  phone: z.string({
    error: "请填写电话。",
  }),
  address: z.string().optional(),
  url1: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "链接必须以 http:// 或 https:// 开头。"),
  url1Label: z.string().optional(),
  url2: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "链接必须以 http:// 或 https:// 开头。"),
  url2Label: z.string().optional(),
});
