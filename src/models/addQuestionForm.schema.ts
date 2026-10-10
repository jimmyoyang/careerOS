import { z } from "zod";
import { APP_CONSTANTS } from "@/lib/constants";

export const AddQuestionFormSchema = z.object({
  id: z.string().optional(),
  question: z
    .string({ error: "请填写题目。" })
    .min(APP_CONSTANTS.MIN_QUESTION_LENGTH, { message: `题目至少需要 ${APP_CONSTANTS.MIN_QUESTION_LENGTH} 个字符。` })
    .max(APP_CONSTANTS.MAX_QUESTION_LENGTH, { message: `题目不能超过 ${APP_CONSTANTS.MAX_QUESTION_LENGTH} 个字符。` }),
  answer: z
    .string({ error: "请填写答案。" })
    .max(APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH, { message: `答案不能超过 ${APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH} 个字符。` })
    .refine((val) => val === "TBD" || val === "待填写" || val.length >= APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH, { message: `答案至少需要 ${APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH} 个字符。` }),
  tagIds: z
    .array(z.string())
    .max(APP_CONSTANTS.MAX_JOB_TAGS, { message: `最多允许 ${APP_CONSTANTS.MAX_JOB_TAGS} 个技能标签。` })
    .optional(),
});
