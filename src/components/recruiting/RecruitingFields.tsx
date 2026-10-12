import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { RecruitingData } from "@/lib/recruiting/contracts";

export const basicLabels: Record<keyof RecruitingData["basic"], string> = {
  fullName: "姓名", englishName: "英文名", gender: "性别", birthDate: "出生日期", nationality: "国籍", nativePlace: "籍贯", currentCity: "现居城市", address: "通讯地址", postalCode: "邮政编码", politicalStatus: "政治面貌", maritalStatus: "婚姻状况", homepage: "个人主页", selfIntroduction: "自我介绍",
};
export const preferenceLabels: Record<keyof RecruitingData["preferences"], string> = {
  targetRoles: "意向岗位", targetCities: "意向城市", recruitmentType: "招聘类型", graduationYear: "毕业年份", availableDate: "可到岗日期", daysPerWeek: "每周可实习天数", internshipMonths: "可实习月数", expectedSalary: "期望薪资", willingToRelocate: "是否接受异地工作",
};
export const sectionLabels = {
  education: { title: "教育经历", fields: { school: "学校", college: "学院", major: "专业", degree: "学历学位", studyType: "培养方式", startDate: "开始日期", endDate: "结束日期", gpa: "绩点", ranking: "专业排名", courses: "主要课程", description: "教育经历说明" } },
  experience: { title: "工作与实习经历", fields: { company: "公司", department: "部门", position: "职位", employmentType: "工作类型", startDate: "开始日期", endDate: "结束日期", city: "工作城市", description: "工作内容与成果", reasonForLeaving: "离职原因" } },
  projects: { title: "项目经历", fields: { name: "项目名称", role: "项目角色", organization: "所属组织", startDate: "开始日期", endDate: "结束日期", url: "项目链接", description: "项目内容与成果" } },
  skills: { title: "技能", fields: { name: "技能名称", level: "熟练程度", description: "技能说明" } },
  certificates: { title: "证书", fields: { name: "证书名称", issuer: "颁发机构", obtainedDate: "取得日期", expiresDate: "到期日期", score: "成绩", description: "证书说明" } },
  awards: { title: "获奖经历", fields: { name: "奖项名称", issuer: "颁发机构", date: "获奖日期", description: "获奖说明" } },
  extras: { title: "补充字段", fields: { platform: "适用平台", field: "字段名称", value: "字段内容" } },
} as const;
export type SectionKey = keyof typeof sectionLabels;
const longFields = new Set(["selfIntroduction", "description", "courses", "reasonForLeaving", "value", "note"]);
export function TextField({ label, value, onChange, multiline = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  return <label className={`grid gap-2 text-sm font-medium ${multiline ? "sm:col-span-2" : ""}`}><span>{label}</span>{multiline ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} /> : <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}
export function SelectField({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></label>;
}
export function Fields({ labels, values, onChange }: { labels: Record<string, string>; values: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => <TextField key={key} label={label} value={values[key] ?? ""} onChange={(value) => onChange(key, value)} multiline={longFields.has(key)} type={key.toLowerCase().endsWith("date") ? "date" : "text"} />)}</div>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-lg border bg-card p-5"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;
}
export function RepeatedSection({ section, rows, onChange }: { section: SectionKey; rows: Array<{ id: string } & Record<string, string>>; onChange: (rows: Array<{ id: string } & Record<string, string>>) => void }) {
  const { title, fields } = sectionLabels[section];
  return <Section title={title}>
    {rows.length === 0 && <p className="text-sm text-muted-foreground">暂无{title}，可按需添加。</p>}
    {rows.map((row, index) => <fieldset key={row.id} className="space-y-4 rounded-md border p-4"><legend className="px-2 text-sm">{title} {index + 1}</legend><Fields labels={fields} values={row} onChange={(key, value) => onChange(rows.map((item) => item.id === row.id ? { ...item, [key]: value } : item))} /><Button type="button" variant="outline" size="sm" aria-label={`删除${title} ${index + 1}`} onClick={() => onChange(rows.filter((item) => item.id !== row.id))}>删除此条</Button></fieldset>)}
    <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => onChange([...rows, { id: crypto.randomUUID(), ...Object.fromEntries(Object.keys(fields).map((key) => [key, ""])) }])}>添加{title}</Button>
  </Section>;
}
export function ReadOnlyFields({ labels, values }: { labels: Record<string, string>; values: Record<string, string> }) {
  const filled = Object.entries(labels).filter(([key]) => values[key]);
  return filled.length ? <dl className="grid gap-3 sm:grid-cols-2">{filled.map(([key, label]) => <div key={key}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{values[key]}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">无内容</p>;
}
