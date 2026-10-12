import type { RecruitingData } from "@/lib/recruiting/contracts";
import { Button } from "@/components/ui/button";
import { basicLabels, ReadOnlyFields, sectionLabels } from "./RecruitingFields";

export default function RecruitingImportPreview({ candidate, onConfirm, onCancel }: { candidate: RecruitingData; onConfirm: () => void; onCancel: () => void }) {
  return <section aria-label="简历导入预览" className="space-y-5 rounded-lg border border-primary/40 bg-card p-5">
    <h2 className="text-lg font-semibold">简历导入预览</h2>
    <p className="text-sm">确认后将更新姓名、通讯地址、个人主页和自我介绍，并替换教育经历、工作与实习经历、技能和证书。请留意预览中的空项；其他基本资料、求职意向、项目、获奖和补充字段保留。已有联系方式和账号绑定保留，简历中有效的新联系方式会追加且不自动绑定账号。请核对后手动保存。</p>
    <h3 className="font-medium">基本资料</h3><ReadOnlyFields labels={basicLabels} values={candidate.basic} />
    {(["education", "experience", "skills", "certificates"] as const).map((key) => <div key={key} className="space-y-3"><h3 className="font-medium">{sectionLabels[key].title}（{candidate[key].length} 条）</h3>{candidate[key].length ? candidate[key].map((row) => <div key={row.id} className="rounded-md border p-3"><ReadOnlyFields labels={sectionLabels[key].fields} values={row} /></div>) : <p className="text-sm text-muted-foreground">无内容，原有条目将清空。</p>}</div>)}
    <div className="space-y-2"><h3 className="font-medium">导入后的联系邮箱</h3>{candidate.emails.length ? candidate.emails.map((row) => <p key={row.id} className="break-all text-sm">{row.address}</p>) : <p className="text-sm text-muted-foreground">无邮箱</p>}</div>
    <div className="space-y-2"><h3 className="font-medium">导入后的联系电话</h3>{candidate.phones.length ? candidate.phones.map((row) => <p key={row.id} className="text-sm">{row.countryCode} {row.number}</p>) : <p className="text-sm text-muted-foreground">无手机号</p>}</div>
    <p className="text-sm text-muted-foreground">保留 {candidate.accounts.length} 个平台账号，原有绑定关系不变。</p>
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={onConfirm}>确认替换到编辑区</Button><Button type="button" variant="outline" onClick={onCancel}>取消导入</Button></div>
  </section>;
}
