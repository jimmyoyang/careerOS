import { z } from "zod";

export const SignupFormSchema = z.object({
  name: z.string().min(2, {
    message: "姓名至少需要 2 个字符。",
  }),
  email: z
    .string({
      error: "请填写邮箱。",
    })
    .min(3, {
      message: "邮箱至少需要 3 个字符。",
    })
    .email("请输入有效的邮箱地址。"),
  password: z
    .string({
      error: "请输入密码。",
    })
    .min(6, {
      message: "密码至少需要 6 个字符。",
    }),
});
