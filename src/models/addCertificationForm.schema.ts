import { z } from "zod";

export const AddCertificationFormSchema = z.object({
  id: z.string().optional(),
  resumeId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionTitle: z.string().default("证书").optional(),
  title: z
    .string({
      error: "请填写证书名称。",
    })
    .min(2),
  organization: z
    .string({
      error: "请填写颁发机构。",
    })
    .min(2),
  issueDate: z.date().nullable().optional(),
  expirationDate: z.date().nullable().optional(),
  credentialUrl: z.string().nullable().optional(),
  noExpiration: z.boolean().default(false).optional(),
});
