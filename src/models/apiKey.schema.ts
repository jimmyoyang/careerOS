import { z } from "zod";

export const apiKeySaveSchema = z.object({
  provider: z.enum(["openai", "deepseek", "openrouter", "ollama", "gemini"]),
  key: z.string().min(1, "请填写 API 密钥"),
  label: z.string().optional(),
  sensitive: z.boolean().default(true),
});

export type ApiKeySaveInput = z.infer<typeof apiKeySaveSchema>;
