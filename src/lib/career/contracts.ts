import { z } from "zod";

export const SourceSchema = z.object({
  rawJdHash: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  quote: z.string(),
});
export const EvidenceRefSchema = z.object({
  evidenceKey: z.string(),
  revision: z.number().int().positive(),
  contentHash: z.string(),
});
export const FactsSchema = z.object({
  schemaVersion: z.literal(1),
  text: z.string().trim().min(1).max(8000),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  protectedValues: z.array(z.string().min(1).max(200)).max(40).default([]),
});
export const PreferencesSchema = z.object({
  degree: z.enum(["associate", "bachelor", "master", "doctor"]).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  months: z.number().min(1).max(60).optional(),
  cities: z.array(z.string().max(80)).max(20).default([]),
  direction: z.string().max(200).default(""),
});
export const RequirementSchema = z.object({
  key: z.string(),
  text: z.string(),
  mandatory: z.boolean(),
  source: SourceSchema,
  field: z.enum([
    "degree",
    "graduationYear",
    "daysPerWeek",
    "months",
    "skill",
    "other",
  ]),
  value: z.union([z.string(), z.number()]).nullable(),
});
export const RequirementsSchema = z.object({
  schemaVersion: z.literal(1),
  parser: z.string(),
  items: z.array(RequirementSchema).max(120),
});
export const BulletSchema = z.object({
  bulletKey: z.string(),
  original: z.string().max(8000),
  proposed: z.string().min(1).max(8000),
  reason: z.string().max(1000),
  requirementKeys: z.array(z.string()),
  evidence: z.array(EvidenceRefSchema).min(1),
  verification: z.enum(["needs_review", "accepted", "rejected"]),
});
export const DraftSchema = z.object({
  schemaVersion: z.literal(1),
  inputHash: z.string(),
  model: z.string(),
  bullets: z.array(BulletSchema).min(1).max(40),
});
export const MatchSchema = z.object({
  schemaVersion: z.literal(1),
  inputHash: z.string(),
  direction: z.enum(["high", "medium", "low", "unknown"]),
  recommendation: z.enum(["recommended", "review", "not_recommended"]),
  requirements: z.array(
    z.object({
      requirementKey: z.string(),
      mandatory: z.boolean(),
      eligibility: z.enum(["pass", "fail", "unknown"]),
      reason: z.string(),
      source: SourceSchema,
      evidence: z.array(EvidenceRefSchema),
    }),
  ),
  informationQuality: z.enum(["complete", "partial", "insufficient"]),
  unresolvedFields: z.array(z.string()),
});
export const ImportSchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  rawJd: z.string().trim().min(1).max(30000),
  location: z.string().trim().max(200).default(""),
  url: z
    .union([
      z.literal(""),
      z
        .string()
        .url()
        .refine((v) => /^https?:\/\//.test(v)),
    ])
    .default(""),
  platform: z
    .enum(["unknown", "huawei", "bytedance", "tencent", "alibaba", "meituan", "other"])
    .default("unknown"),
  recruitmentType: z
    .enum(["unknown", "campus", "internship", "experienced"])
    .default("unknown"),
  cohort: z.string().trim().max(100).default(""),
  postingId: z.string().trim().max(200).default(""),
  dueDate: z.union([z.literal(""), z.string().date()]).default(""),
  referral: z.string().trim().max(1000).default(""),
});
export const ContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().max(120).default(""),
  phone: z.string().max(60).default(""),
});
export const ModelSchema = z.object({
  provider: z.enum(["openai", "ollama", "deepseek", "openrouter", "gemini"]),
  model: z.string().trim().min(1).max(120),
  consent: z.literal(true),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type Facts = z.infer<typeof FactsSchema>;
export type EvidenceSnapshot = EvidenceRef & {
  kind: string;
  title: string;
  facts: Facts;
};
export type Preferences = z.input<typeof PreferencesSchema>;
export type Requirements = z.infer<typeof RequirementsSchema>;
export type Bullet = z.infer<typeof BulletSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type ImportInput = z.input<typeof ImportSchema>;
