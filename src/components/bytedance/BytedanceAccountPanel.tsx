"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getBytedanceAccountsAction, previewBytedanceLoginAction } from "@/actions/bytedance.actions";
import { Button } from "@/components/ui/button";
import type { BridgeDevice, LoginBinding } from "@/lib/recruiting/contracts";

type Accounts = { revision: number; accounts: { id: string; label: string; loginMethod: "sms" | "email" | "username"; confirmed: boolean }[] };
type Preview = { binding: LoginBinding; device: BridgeDevice | null; warning: string };
const methods = { sms: "手机验证码", email: "邮箱", username: "用户名" };

export default function BytedanceAccountPanel() {
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setAccounts(null);
    async function load() {
      try {
        const response = await getBytedanceAccountsAction();
        if (!active) return;
        if (response.ok) setAccounts(response.data);
        else setError(response.error);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "字节账号读取失败，请刷新。"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; request.current += 1; };
  }, [refresh]);

  function selectAccount(value: string) {
    request.current += 1;
    setSelectedId(value); setPreview(null); setPreviewError(""); setPreviewing(false);
  }
  const account = accounts?.accounts.find((item) => item.id === selectedId);
  async function previewLogin() {
    if (!account?.confirmed || account.loginMethod !== "sms" || !accounts || previewing) return;
    const current = ++request.current;
    setPreviewing(true); setPreview(null); setPreviewError("");
    try {
      const response = await previewBytedanceLoginAction(account.id, accounts.revision);
      if (current !== request.current) return;
      if (response.ok) setPreview(response.data);
      else setPreviewError(response.error);
    } catch (cause) { if (current === request.current) setPreviewError(cause instanceof Error ? cause.message : "登录信息核对失败，请重试。"); }
    finally { if (current === request.current) setPreviewing(false); }
  }

  return <section aria-label="字节账号核对" className="min-w-0 space-y-4 rounded-xl border bg-card p-5 sm:p-6">
    <div><h2 className="text-lg font-semibold">核对字节招聘账号</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">只读取已保存的账号绑定，不会发送短信、执行登录或提交申请。请确认使用正确的邮箱和手机号。</p></div>
    {loading ? <p role="status" className="text-sm">正在读取已保存的字节账号…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : accounts && (accounts.accounts.length ? <>
      <label className="grid gap-2 text-sm"><span>字节招聘账号</span><select value={selectedId} onChange={(event) => selectAccount(event.target.value)} className="h-10 min-w-0 w-full rounded-md border bg-background px-3"><option value="">请选择已保存的账号</option>{accounts.accounts.map((item, index) => <option key={item.id} value={item.id}>{item.label || `字节账号 ${index + 1}`} · {methods[item.loginMethod]}{item.confirmed ? "" : "（尚未核对绑定）"}</option>)}</select></label>
      {account && !account.confirmed && <p className="text-sm text-muted-foreground">请先到求职资料与账号中核对并保存此账号的绑定关系。</p>}
      {account && account.loginMethod !== "sms" && <p className="text-sm text-muted-foreground">请到求职资料与账号中将此账号的登录方式改为手机验证码，核对手机号并保存后刷新。</p>}
      <Button variant="outline" disabled={!account?.confirmed || account.loginMethod !== "sms" || previewing} onClick={() => void previewLogin()}>{previewing ? "正在核对登录信息…" : "核对已保存的登录信息"}</Button>
    </> : <p className="text-sm text-muted-foreground">尚未保存字节招聘账号</p>)}
    {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
    {preview && <section aria-label="已保存的字节登录信息" className="space-y-3 rounded-lg bg-muted p-4"><h3 className="font-medium">已保存的字节登录信息</h3><dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries({ "登录方式": methods[preview.binding.loginMethod], "登录标识": preview.binding.loginIdentifier, "绑定邮箱": preview.binding.email || "未绑定", "绑定手机号": preview.binding.phone || "未绑定", "接码设备编号": preview.binding.deviceId || "未指定", "接码设备": preview.device ? `${preview.device.deviceName}${preview.device.active ? "" : "（不可用）"}` : "未绑定或不可用", "SIM 订阅编号": preview.binding.subscriptionId === null ? "未指定" : String(preview.binding.subscriptionId) }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl>{preview.warning && <p role="status" className="text-sm">{preview.warning}</p>}<Button asChild variant="outline"><a href="https://jobs.bytedance.com/campus/login" target="_blank" rel="noopener noreferrer">前往字节官网手机登录</a></Button><p className="text-xs leading-5 text-muted-foreground">在官网填写上方手机号、接收验证码并确认协议。登录后可通过职位详情中的申请入口继续。</p></section>}
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="ghost" disabled={loading} onClick={() => { selectAccount(""); setRefresh((value) => value + 1); }}>刷新字节账号</Button><Link href="/dashboard/recruiting" className="text-sm text-primary hover:underline">管理求职资料与账号</Link></div>
  </section>;
}
