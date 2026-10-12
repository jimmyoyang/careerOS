import { Button } from "@/components/ui/button";
import type { BridgeDevice, RecruitingData } from "@/lib/recruiting/contracts";
import { Section, SelectField, TextField } from "./RecruitingFields";

type Props = { data: RecruitingData; devices: BridgeDevice[]; devicesAvailable: boolean; onChange: (data: RecruitingData) => void; previewDisabled: boolean; onPreview: (accountId: string) => void; onRefreshDevices: () => void };
export default function RecruitingAccounts({ data, devices, devicesAvailable, onChange, previewDisabled, onPreview, onRefreshDevices }: Props) {
  function updateEmail(id: string, patch: Partial<RecruitingData["emails"][number]>) {
    onChange({ ...data, emails: data.emails.map((row) => row.id === id ? { ...row, ...patch } : row), accounts: data.accounts.map((row) => row.emailId === id && "address" in patch ? { ...row, confirmed: false } : row) });
  }
  function updatePhone(id: string, patch: Partial<RecruitingData["phones"][number]>) {
    onChange({ ...data, phones: data.phones.map((row) => row.id === id ? { ...row, ...patch } : row), accounts: data.accounts.map((row) => row.phoneId === id && Object.keys(patch).some((key) => key !== "label") ? { ...row, confirmed: false } : row) });
  }
  function updateAccount(id: string, patch: Partial<RecruitingData["accounts"][number]>) {
    const identityChanged = Object.keys(patch).some((key) => ["platform", "username", "emailId", "phoneId", "loginMethod"].includes(key));
    onChange({ ...data, accounts: data.accounts.map((row) => row.id === id ? { ...row, ...patch, ...(identityChanged ? { confirmed: false } : {}) } : row) });
  }
  return <>
    <Section title="联系邮箱">
      <p className="text-sm text-muted-foreground">可保存多个邮箱。被账号引用的邮箱需先在账号中解除绑定，才能删除。</p>
      {data.emails.map((email, index) => <fieldset key={email.id} className="space-y-4 rounded-md border p-4"><legend className="px-2 text-sm">邮箱 {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2">
        <TextField label="邮箱备注名" value={email.label} onChange={(label) => updateEmail(email.id, { label })} />
        <TextField label="邮箱地址" type="email" value={email.address} onChange={(address) => updateEmail(email.id, { address })} />
      </div><Button type="button" size="sm" variant="outline" aria-label={`删除邮箱 ${index + 1}`} disabled={data.accounts.some((row) => row.emailId === email.id)} onClick={() => onChange({ ...data, emails: data.emails.filter((row) => row.id !== email.id) })}>删除邮箱</Button></fieldset>)}
      <Button type="button" variant="outline" disabled={data.emails.length >= 100} onClick={() => onChange({ ...data, emails: [...data.emails, { id: crypto.randomUUID(), label: "", address: "" }] })}>添加邮箱</Button>
    </Section>
    <Section title="联系电话与接码设备">
      <p className="text-sm text-muted-foreground">接码设备需手动选择，同名设备请按设备编号区分。SIM 订阅编号应与手机桥接服务中的编号一致，不确定时留空。被账号引用的号码需先解除绑定，才能删除。</p>
      <Button type="button" variant="outline" size="sm" onClick={onRefreshDevices}>刷新设备列表</Button>
      {devicesAvailable && devices.length === 0 && <p className="text-sm text-muted-foreground">当前没有已配对设备</p>}
      {!devicesAvailable && <p className="text-sm text-amber-700 dark:text-amber-400">设备服务不可用，暂时无法绑定设备；现有绑定保留。</p>}
      {data.phones.map((phone, index) => <fieldset key={phone.id} className="space-y-4 rounded-md border p-4"><legend className="px-2 text-sm">手机号 {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2">
        <TextField label="手机号备注名" value={phone.label} onChange={(label) => updatePhone(phone.id, { label })} />
        <TextField label="国家或地区区号" value={phone.countryCode} onChange={(countryCode) => updatePhone(phone.id, { countryCode })} />
        <TextField label="手机号" type="tel" value={phone.number} onChange={(number) => updatePhone(phone.id, { number })} />
        <SelectField label="接码设备" value={phone.deviceId} disabled={!devicesAvailable} onChange={(deviceId) => updatePhone(phone.id, { deviceId, subscriptionId: null })}>
          <option value="">不绑定接码设备</option>
          {devices.filter((device) => device.active || device.deviceId === phone.deviceId).map((device) => <option key={device.deviceId} value={device.deviceId} disabled={!device.active}>{device.deviceName}（{device.deviceId}）{device.active ? "" : "（不可用）"}</option>)}
          {phone.deviceId && !devices.some((device) => device.deviceId === phone.deviceId) && <option value={phone.deviceId} disabled>当前设备（不可用）：{phone.deviceId}</option>}
        </SelectField>
        <label className="grid gap-2 text-sm font-medium"><span>SIM 订阅编号</span><input className="h-10 rounded-md border border-input bg-background px-3 disabled:opacity-50" type="number" min="0" max="2147483647" step="1" disabled={!phone.deviceId || !devicesAvailable || !devices.some((device) => device.deviceId === phone.deviceId && device.active)} value={phone.subscriptionId ?? ""} onChange={(event) => updatePhone(phone.id, { subscriptionId: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      </div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" aria-label={`删除手机号 ${index + 1}`} disabled={data.accounts.some((row) => row.phoneId === phone.id)} onClick={() => onChange({ ...data, phones: data.phones.filter((row) => row.id !== phone.id) })}>删除手机号</Button>{phone.deviceId && <Button type="button" size="sm" variant="outline" onClick={() => updatePhone(phone.id, { deviceId: "", subscriptionId: null })}>解除设备与 SIM 绑定</Button>}</div></fieldset>)}
      <Button type="button" variant="outline" disabled={data.phones.length >= 100} onClick={() => onChange({ ...data, phones: [...data.phones, { id: crypto.randomUUID(), label: "", countryCode: "+86", number: "", deviceId: "", subscriptionId: null }] })}>添加手机号</Button>
    </Section>
    <Section title="招聘平台账号">
      <p className="text-sm text-muted-foreground">同一平台可添加多个账号。邮箱、号码均不会自动关联。修改登录身份后，请重新核对并保存。这里只记录登录关系，不保存密码，也不会发送短信或执行登录。</p>
      {data.accounts.map((account, index) => {
        const email = data.emails.find((row) => row.id === account.emailId);
        const phone = data.phones.find((row) => row.id === account.phoneId);
        const missing = account.loginMethod === "sms" ? !phone : account.loginMethod === "email" ? !email : !account.username.trim();
        return <fieldset key={account.id} className="space-y-4 rounded-md border p-4"><legend className="px-2 text-sm">平台账号 {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2">
          <TextField label="平台名称" value={account.platform} onChange={(platform) => updateAccount(account.id, { platform })} />
          <TextField label="账号备注名" value={account.label} onChange={(label) => updateAccount(account.id, { label })} />
          <TextField label="用户名" value={account.username} onChange={(username) => updateAccount(account.id, { username })} />
          <SelectField label="登录方式" value={account.loginMethod} onChange={(loginMethod) => updateAccount(account.id, { loginMethod: loginMethod as "sms" | "email" | "username" })}><option value="sms">手机验证码</option><option value="email">邮箱</option><option value="username">用户名</option></SelectField>
          <SelectField label="绑定邮箱" value={account.emailId} onChange={(emailId) => updateAccount(account.id, { emailId })}><option value="">未绑定邮箱</option>{data.emails.map((row) => <option key={row.id} value={row.id}>{row.address || "未填写地址"}{row.label ? `（${row.label}）` : ""}</option>)}</SelectField>
          <SelectField label="绑定手机号" value={account.phoneId} onChange={(phoneId) => updateAccount(account.id, { phoneId })}><option value="">未绑定手机号</option>{data.phones.map((row) => <option key={row.id} value={row.id}>{row.countryCode} {row.number}{row.label ? `（${row.label}）` : ""}</option>)}</SelectField>
          <TextField label="账号说明" value={account.note} multiline onChange={(note) => updateAccount(account.id, { note })} />
        </div>
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm"><p>当前选择的邮箱：{email?.address || "未绑定"}</p><p>当前选择的手机号：{phone ? `${phone.countryCode} ${phone.number}` : "未绑定"}</p>{missing && <p className="text-amber-700 dark:text-amber-400">尚未填写当前登录方式所需的绑定信息。</p>}{account.loginMethod === "sms" && phone && !devices.some((device) => device.deviceId === phone.deviceId && device.active) && <p className="text-amber-700 dark:text-amber-400">接码设备未绑定或不可用。</p>}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={account.confirmed} onChange={(event) => updateAccount(account.id, { confirmed: event.target.checked })} /><span>我已核对该账号的登录信息与绑定关系</span></label>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={previewDisabled || !account.confirmed} onClick={() => onPreview(account.id)}>预览登录信息</Button><Button type="button" variant="outline" aria-label={`删除平台账号 ${index + 1}`} onClick={() => onChange({ ...data, accounts: data.accounts.filter((row) => row.id !== account.id) })}>删除账号</Button></div>
        </fieldset>;
      })}
      <Button type="button" variant="outline" disabled={data.accounts.length >= 100} onClick={() => onChange({ ...data, accounts: [...data.accounts, { id: crypto.randomUUID(), platform: "", label: "", username: "", emailId: "", phoneId: "", loginMethod: "sms", confirmed: false, note: "" }] })}>添加平台账号</Button>
    </Section>
  </>;
}
