import { randomUUID } from "node:crypto";
import { z } from "zod";
import db from "@/lib/db";
import { transaction } from "@/lib/career/transaction";
import { assertNoMaintenance } from "@/lib/career/maintenance";
import { resumeDetailInclude } from "@/lib/jobs/resumeDetailInclude";
import { RecruitingDataSchema, normalizePhone, type RecruitingDocument } from "./contracts";

export class RecruitingError extends Error {}
export async function getRecruitingProfile(userId: string): Promise<RecruitingDocument> {
  const row = await db.recruitingProfile.findUnique({ where: { userId } });
  return { revision: row?.revision ?? 0, data: RecruitingDataSchema.parse(row ? JSON.parse(row.dataJson) : {}) };
}
export async function saveRecruitingProfile(userId: string, input: unknown, expectedRevision: number): Promise<RecruitingDocument> {
  z.number().int().nonnegative().parse(expectedRevision);
  const data = RecruitingDataSchema.parse(input);
  const dataJson = JSON.stringify(data);
  if (Buffer.byteLength(dataJson) > 2 * 1024 * 1024) throw new RecruitingError("资料超过 2 MB，请减少重复内容");
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const existing = await tx.recruitingProfile.findUnique({ where: { userId } });
    if ((existing?.revision ?? 0) !== expectedRevision) throw new RecruitingError("资料已在其他页面更新，请刷新后重新编辑");
    if (!existing) {
      await tx.recruitingProfile.create({ data: { userId, dataJson, revision: 1 } });
    } else {
      const result = await tx.recruitingProfile.updateMany({ where: { userId, revision: expectedRevision }, data: { dataJson, revision: { increment: 1 } } });
      if (result.count !== 1) throw new RecruitingError("资料已更新，请刷新后重新编辑");
    }
    return { revision: expectedRevision + 1, data };
  });
}
const plain = (value: string | null | undefined) => (value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
const day = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
export async function importRecruitingResume(userId: string, resumeId: string) {
  z.string().min(1).max(120).parse(resumeId);
  const resume = await db.resume.findFirst({ where: { id: resumeId, profile: { userId } }, include: resumeDetailInclude });
  if (!resume) throw new RecruitingError("找不到可导入的简历");
  const { data } = await getRecruitingProfile(userId);
  const contact = resume.ContactInfo;
  const sections = resume.ResumeSections;
  if (contact) {
    data.basic.fullName = `${contact.lastName} ${contact.firstName}`.trim();
    data.basic.address = contact.address ?? "";
    data.basic.homepage = contact.url1 ?? "";
    const email = z.string().trim().email().safeParse(contact.email);
    if (email.success && !data.emails.some((item) => item.address.toLowerCase() === email.data.toLowerCase())) data.emails.push({ id: randomUUID(), label: "简历联系方式", address: email.data });
    try {
      const full = normalizePhone("+86", contact.phone);
      if (!data.phones.some((item) => normalizePhone(item.countryCode, item.number) === full)) data.phones.push({ id: randomUUID(), label: "简历联系方式（请核对）", countryCode: "+86", number: full.slice(3), deviceId: "", subscriptionId: null });
    } catch { /* No reliable country code: leave the saved phone list unchanged. */ }
  }
  data.basic.selfIntroduction = sections.map((s) => plain(s.summary?.content)).filter(Boolean).join("\n");
  data.education = sections.flatMap((s) => s.educations.map((row) => ({ id: randomUUID(), school: row.institution, major: row.fieldOfStudy, degree: row.degree, startDate: day(row.startDate), endDate: day(row.endDate), description: plain(row.description), college: "", studyType: "", gpa: "", ranking: "", courses: "" })));
  data.experience = sections.flatMap((s) => s.workExperiences.map((row) => ({ id: randomUUID(), company: row.Company.label, position: row.jobTitle.label, city: row.location.label, startDate: day(row.startDate), endDate: day(row.endDate), description: plain(row.description), department: "", employmentType: "", reasonForLeaving: "" })));
  data.skills = sections.flatMap((s) => s.skills.map((row) => ({ id: randomUUID(), name: row.Tag.label, level: "", description: row.category ?? "" })));
  data.certificates = sections.flatMap((s) => s.licenseOrCertifications.map((row) => ({ id: randomUUID(), name: row.title, issuer: row.organization, obtainedDate: day(row.issueDate), expiresDate: day(row.expirationDate), score: "", description: row.credentialUrl ?? "" })));
  return RecruitingDataSchema.parse(data);
}
