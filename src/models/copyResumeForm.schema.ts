import { z } from "zod";

export const CopyResumeFormSchema = z.object({
  title: z
    .string()
    .min(1, "请填写简历标题。")
    .max(100, "标题必须少于 100 个字符。"),
});
