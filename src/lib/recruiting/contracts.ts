import { z } from "zod";

const text = (max = 300) => z.string().trim().max(max).default("");
const id = z.string().trim().min(1).max(100);
const date = text(10).refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "请填写有效日期");
const record = { id };
const period = { startDate: date, endDate: date };
export const BasicSchema = z.object({
  fullName: text(), englishName: text(), gender: text(), birthDate: date,
  nationality: text(), nativePlace: text(), currentCity: text(), address: text(1000),
  postalCode: text(30), politicalStatus: text(), maritalStatus: text(),
  homepage: text(1000), selfIntroduction: text(10000),
});
export const EducationSchema = z.object({ ...record, school: text(), college: text(), major: text(), degree: text(), studyType: text(), ...period, gpa: text(), ranking: text(), courses: text(3000), description: text(10000) });
export const ExperienceSchema = z.object({ ...record, company: text(), department: text(), position: text(), employmentType: text(), ...period, city: text(), description: text(10000), reasonForLeaving: text(1000) });
export const ProjectSchema = z.object({ ...record, name: text(), role: text(), organization: text(), ...period, url: text(1000), description: text(10000) });
export const SkillSchema = z.object({ ...record, name: text(), level: text(), description: text(3000) });
export const CertificateSchema = z.object({ ...record, name: text(), issuer: text(), obtainedDate: date, expiresDate: date, score: text(), description: text(3000) });
export const AwardSchema = z.object({ ...record, name: text(), issuer: text(), date, description: text(3000) });
export const PreferencesSchema = z.object({ targetRoles: text(1000), targetCities: text(1000), recruitmentType: text(), graduationYear: text(4), availableDate: date, daysPerWeek: text(20), internshipMonths: text(20), expectedSalary: text(), willingToRelocate: text() });
export const EmailSchema = z.object({ ...record, label: text(), address: z.string().trim().email("邮箱格式不正确").max(254) });
export const PhoneSchema = z.object({ ...record, label: text(), countryCode: z.string().regex(/^\+[1-9]\d{0,2}$/, "区号如 +86").default("+86"), number: z.string().trim().min(1).max(40), deviceId: text(100), subscriptionId: z.number().int().min(0).max(2147483647).nullable().default(null) });
export const AccountSchema = z.object({ ...record, platform: z.string().trim().min(1, "请填写平台").max(100), label: text(), username: text(), emailId: text(100), phoneId: text(100), loginMethod: z.enum(["sms", "email", "username"]).default("sms"), confirmed: z.boolean().default(false), note: text(3000) });
export const ExtraSchema = z.object({ ...record, platform: text(), field: z.string().trim().min(1, "请填写字段名称").max(300), value: text(10000) });
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(100).default([]);
export const RecruitingDataSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  basic: BasicSchema.default(() => BasicSchema.parse({})),
  preferences: PreferencesSchema.default(() => PreferencesSchema.parse({})),
  education: rows(EducationSchema), experience: rows(ExperienceSchema), projects: rows(ProjectSchema),
  skills: rows(SkillSchema), certificates: rows(CertificateSchema), awards: rows(AwardSchema),
  emails: rows(EmailSchema), phones: rows(PhoneSchema), accounts: rows(AccountSchema), extras: rows(ExtraSchema),
}).superRefine((data, ctx) => {
  for (const key of ["education", "experience", "projects", "skills", "certificates", "awards", "emails", "phones", "accounts", "extras"] as const) {
    const ids = new Set<string>();
    data[key].forEach((row, index) => {
      if (ids.has(row.id)) ctx.addIssue({ code: "custom", path: [key, index, "id"], message: "记录标识重复" });
      ids.add(row.id);
    });
  }
  for (const key of ["education", "experience", "projects"] as const) data[key].forEach((row, index) => {
    if (row.startDate && row.endDate && row.startDate > row.endDate) ctx.addIssue({ code: "custom", path: [key, index, "endDate"], message: "结束日期不能早于开始日期" });
  });
  const addresses = new Set<string>();
  data.emails.forEach((email, index) => {
    if (addresses.has(email.address.toLowerCase())) ctx.addIssue({ code: "custom", path: ["emails", index, "address"], message: "邮箱重复" });
    addresses.add(email.address.toLowerCase());
  });
  const numbers = new Set<string>();
  data.phones.forEach((phone, index) => {
    try {
      const number = normalizePhone(phone.countryCode, phone.number);
      if (numbers.has(number)) throw new Error("手机号重复");
      numbers.add(number);
      if (phone.subscriptionId !== null && !phone.deviceId) throw new Error("设置 SIM 卡前请先选择接码设备");
    } catch (error) { ctx.addIssue({ code: "custom", path: ["phones", index, "number"], message: error instanceof Error ? error.message : "手机号格式不正确" }); }
  });
  data.accounts.forEach((account, index) => {
    if (account.emailId && !data.emails.some((email) => email.id === account.emailId)) ctx.addIssue({ code: "custom", path: ["accounts", index, "emailId"], message: "账号引用的邮箱不存在" });
    if (account.phoneId && !data.phones.some((phone) => phone.id === account.phoneId)) ctx.addIssue({ code: "custom", path: ["accounts", index, "phoneId"], message: "账号引用的手机号不存在" });
  });
});
export type RecruitingData = z.infer<typeof RecruitingDataSchema>;
export type RecruitingDocument = { revision: number; data: RecruitingData };
export type BridgeDevice = { deviceId: string; deviceName: string; active: boolean };
export type LoginBinding = { accountId: string; platform: string; label: string; loginMethod: "sms" | "email" | "username"; loginIdentifier: string; email: string; phone: string; deviceId: string; subscriptionId: number | null };
export function normalizePhone(countryCode: string, number: string): string {
  if (!/^\+[1-9]\d{0,2}$/.test(countryCode)) throw new Error("请填写有效国家区号");
  let digits = number.replace(/[\s()-]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith(countryCode)) throw new Error("手机号与国家区号不一致");
    digits = digits.slice(countryCode.length);
  }
  if (!/^\d{5,14}$/.test(digits) || (countryCode === "+86" && !/^1[3-9]\d{9}$/.test(digits))) throw new Error("手机号格式不正确");
  const full = countryCode + digits;
  if (!/^\+[1-9]\d{5,14}$/.test(full)) throw new Error("手机号格式不正确");
  return full;
}
export function resolveLogin(data: RecruitingData, accountId: string): LoginBinding {
  const account = data.accounts.find((item) => item.id === accountId);
  if (!account) throw new Error("请选择已保存的招聘账号");
  if (!account.confirmed) throw new Error("请先核对账号的邮箱和手机号对应关系");
  const email = data.emails.find((item) => item.id === account.emailId)?.address ?? "";
  const contact = data.phones.find((item) => item.id === account.phoneId);
  const phone = contact ? normalizePhone(contact.countryCode, contact.number) : "";
  if (account.loginMethod === "sms" && !phone) throw new Error("该账号尚未绑定登录手机号");
  if (account.loginMethod === "email" && !email) throw new Error("该账号尚未绑定登录邮箱");
  if (account.loginMethod === "username" && !account.username) throw new Error("请填写该平台的登录账号标识");
  return { accountId: account.id, platform: account.platform, label: account.label, loginMethod: account.loginMethod,
    loginIdentifier: account.loginMethod === "sms" ? phone : account.loginMethod === "email" ? email : account.username,
    email, phone, deviceId: contact?.deviceId ?? "", subscriptionId: contact?.subscriptionId ?? null };
}
