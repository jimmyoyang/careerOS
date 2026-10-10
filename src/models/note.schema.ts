import { z } from "zod";

export const NoteFormSchema = z.object({
  id: z.string().optional(),
  jobId: z.string({ error: "Job ID is required." }),
  content: z
    .string({ error: "请填写内容。" })
    .min(1, { message: "内容不能为空。" }),
});
