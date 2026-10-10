import { z } from "zod";

export const CoverLetterFormSchema = z.object({
  id: z.string().optional(),
  title: z
    .string({
      error: "请填写求职信标题。",
    })
    .min(1, {
      message: "请填写求职信标题。",
    })
    .max(100, {
      message: "标题必须少于 100 个字符。",
    }),
  content: z
    .string({
      error: "请填写求职信内容。",
    })
    .min(10, {
      message: "求职信内容至少需要 10 个字符。",
    }),
});
