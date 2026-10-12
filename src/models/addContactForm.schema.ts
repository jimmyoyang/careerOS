import { z } from "zod";

const isValidHttpUrl = (url: string) => {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

const optionalText = (max: number) => z.string().max(max).default("").optional();

export const AddContactFormSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string({ error: "请填写联系人姓名。" })
      .min(1, { message: "联系人姓名不能为空。" })
      .max(120, { message: "联系人姓名不能超过 120 个字符。" }),
    title: optionalText(120),
    email: z
      .string()
      .default("")
      .optional()
      .refine(
        (v) => !v || z.email().safeParse(v).success,
        "请输入有效的邮箱地址。",
      ),
    phone: optionalText(40),
    linkedinUrl: z
      .string()
      .default("")
      .optional()
      .refine(
        (url) => !url || isValidHttpUrl(url),
        "Please enter a full LinkedIn URL starting with https://",
      ),
    company: z.string().optional(),
    location: z.string().optional(),
    relationship: optionalText(120),
    workedAtCompany: z.string().optional(),
    workedFrom: z.date().nullable().optional(),
    workedTo: z.date().nullable().optional(),
    // Named for ComboBox's `case "contactRole"` create path, not for the column
    contactRole: z.string().optional(),
    notes: optionalText(2000),
    lastContactedAt: z
      .date()
      .nullable()
      .optional()
      .refine(
        (date) => {
          if (!date) return true;
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          return date <= endOfToday;
        },
        { message: "上次联系日期不能晚于今天。" },
      ),
  })
  .refine(
    (v) => !v.workedFrom || !v.workedTo || v.workedTo >= v.workedFrom,
    { message: "结束日期不能早于开始日期。", path: ["workedTo"] },
  );

export type ContactFormValues = z.infer<typeof AddContactFormSchema>;
