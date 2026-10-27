"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getRecruitingProfileAction, saveRecruitingProfileAction, getRecruitingDevicesAction, getRecruitingResumesAction, importRecruitingResumeAction, previewRecruitingLoginAction } from "@/actions/recruiting.actions";
import type { BridgeDevice, LoginBinding, RecruitingData, RecruitingDocument } from "@/lib/recruiting/contracts";
import RecruitingAccounts from "./RecruitingAccounts";
import RecruitingImportPreview from "./RecruitingImportPreview";
import { useRecruitingDraft } from "./RecruitingDraftProvider";
import { useUnsavedRecruitingChanges } from "./useUnsavedRecruitingChanges";
import { basicLabels, preferenceLabels, Fields, RepeatedSection, Section, sectionLabels, SelectField, type SectionKey } from "./RecruitingFields";

type LoginPreview = { binding: LoginBinding; device: BridgeDevice | null; warning: string };
export default function RecruitingWorkspace() {
  const retainedDraft = useRecruitingDraft();
  const loadRequest = useRef(0);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [saved, setSaved] = useState<RecruitingDocument | null>(null);
  const [draft, setDraft] = useState<RecruitingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [devicesAvailable, setDevicesAvailable] = useState(false);
  const [resumes, setResumes] = useState<Array<{ id: string; title: string }>>([]);
  const [resumeError, setResumeError] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [candidate, setCandidate] = useState<RecruitingData | null>(null);
  const [preview, setPreview] = useState<LoginPreview | null>(null);
  const dirty = saved !== null && draft !== null && JSON.stringify(saved.data) !== JSON.stringify(draft);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true); setError("");
    const [profile, bridge, list] = await Promise.allSettled([getRecruitingProfileAction(), getRecruitingDevicesAction(), getRecruitingResumesAction()]);
    if (request !== loadRequest.current) return;
    if (profile.status === "fulfilled" && profile.value.ok) {
      const latest = profile.value.data;
      const retained = retainedDraft?.current;
      if (retained && JSON.stringify(retained.draft) !== JSON.stringify(latest.data)) {
        // Keep the original revision so restoring cannot silently overwrite a
        // save made elsewhere while this page was unmounted.
        setSaved(retained.saved); setDraft(retained.draft);
        setRecoveryNotice(latest.revision === retained.saved.revision
          ? "已恢复此标签页中未保存的修改，请核对后保存。"
          : "已恢复此标签页中未保存的修改。服务器资料已更新，保存时仍会检查原版本，避免覆盖其他修改。");
      } else {
        if (retainedDraft) retainedDraft.current = null;
        setSaved(latest); setDraft(latest.data); setRecoveryNotice("");
      }
    }
    else setError(profile.status === "fulfilled" && !profile.value.ok ? profile.value.error : "资料读取失败，请稍后重试。");
    if (bridge.status === "fulfilled" && bridge.value.ok) { setDevices(bridge.value.data); setDevicesAvailable(true); }
    else { setDevices([]); setDevicesAvailable(false); }
    if (list.status === "fulfilled" && list.value.ok) { setResumes(list.value.data); setResumeError(""); }
    else setResumeError(list.status === "fulfilled" && !list.value.ok ? list.value.error : "简历列表读取失败。");
    setLoading(false);
  }, [retainedDraft]);
  useEffect(() => { void load(); return () => { loadRequest.current += 1; }; }, [load]);
  useUnsavedRecruitingChanges(dirty);

  function edit(data: RecruitingData) {
    if (retainedDraft && saved) retainedDraft.current = JSON.stringify(saved.data) === JSON.stringify(data) ? null : { saved, draft: data };
    setDraft(data); setPreview(null); setNotice("");
  }
  async function refreshDevices() {
    if (busy) return;
    setBusy("正在刷新设备…"); setError(""); setPreview(null);
    try {
      const result = await getRecruitingDevicesAction();
      if (result.ok) { setDevices(result.data); setDevicesAvailable(true); }
      else { setDevicesAvailable(false); setError(result.error); }
    } catch { setDevicesAvailable(false); setError("设备列表读取失败，当前修改已保留。"); }
    finally { setBusy(""); }
  }
  async function save() {
    if (!draft || !saved || busy || candidate) return;
    setBusy("保存中…"); setError(""); setPreview(null);
    try {
      const result = await saveRecruitingProfileAction(draft, saved.revision);
      if (result.ok) {
        // A save finishing after navigation must not erase a newer draft.
        if (retainedDraft?.current?.draft === draft) retainedDraft.current = null;
        setSaved(result.data); setDraft(result.data.data); setRecoveryNotice(""); setNotice("资料已保存");
      }
      else setError(result.error);
    } catch { setError("保存失败，修改已保留，请重试。"); }
    finally { setBusy(""); }
  }
  async function importResume() {
    if (!resumeId || dirty || busy || !saved) return;
    setBusy("读取简历中…"); setError(""); setPreview(null);
    try { const result = await importRecruitingResumeAction(resumeId); if (result.ok) setCandidate(result.data); else setError(result.error); }
    catch { setError("简历读取失败，现有资料未更改。"); }
    finally { setBusy(""); }
  }
  async function previewLogin(accountId: string) {
    if (!saved || dirty || busy) return;
    setBusy("核对已保存的登录信息…"); setError(""); setPreview(null);
    try { const result = await previewRecruitingLoginAction(accountId, saved.revision); if (result.ok) setPreview(result.data); else setError(result.error); }
    catch { setError("登录信息预览失败，请重试。"); }
    finally { setBusy(""); }
  }
  return <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
    {error && <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</div>}
    {loading ? <p role="status">正在读取资料…</p> : !draft || !saved ? <Button onClick={() => void load()}>重新读取资料</Button> : <>
      {recoveryNotice && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{recoveryNotice}</p>}
      {dirty && <p className="text-sm text-muted-foreground">未保存草稿仅在当前登录用户的此标签页内暂存。刷新、关闭标签页或退出登录前请先保存。</p>}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-4 backdrop-blur-sm"><p role="status" className="text-sm">{busy || (dirty ? "有未保存的修改" : notice || "资料已与服务器同步")}</p><Button type="button" disabled={!dirty || !!busy || !!candidate} onClick={() => void save()}>保存资料</Button></div>
      <Section title="从已有简历导入">
        <p className="text-sm text-muted-foreground">导入前请先保存当前修改。导入会先展示可核对的预览。</p>
        {resumeError && <p className="text-sm text-amber-700 dark:text-amber-400">{resumeError}</p>}
        <div className="flex flex-wrap items-end gap-3"><SelectField label="选择已有简历" value={resumeId} onChange={setResumeId} disabled={dirty || !!busy || !!candidate}><option value="">请选择简历</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}</SelectField><Button type="button" variant="outline" disabled={!resumeId || dirty || !!busy || !!candidate} onClick={() => void importResume()}>预览简历导入</Button></div>
      </Section>
      {candidate && <RecruitingImportPreview candidate={candidate} onCancel={() => setCandidate(null)} onConfirm={() => { edit(candidate); setCandidate(null); setNotice("简历已放入编辑区，请核对并保存。"); }} />}
      {preview && !dirty && <section aria-label="已保存的登录信息" className="space-y-2 rounded-lg border border-primary/40 bg-card p-5"><h2 className="text-lg font-semibold">已保存的登录信息</h2><p className="text-sm">以下信息来自服务器保存的账号，不会发送短信或执行登录。</p><dl className="grid gap-3 text-sm sm:grid-cols-2">
        {Object.entries({ "招聘平台": preview.binding.platform, "账号备注": preview.binding.label || "未填写", "登录方式": { sms: "手机验证码", email: "邮箱", username: "用户名" }[preview.binding.loginMethod], "将使用的登录标识": preview.binding.loginIdentifier, "绑定邮箱": preview.binding.email || "未绑定", "绑定手机号": preview.binding.phone || "未绑定", "接码设备编号": preview.binding.deviceId || "未指定", "接码设备": preview.device ? `${preview.device.deviceName}${preview.device.active ? "" : "（不可用）"}` : "未绑定或不可用", "SIM 订阅编号": preview.binding.subscriptionId === null ? "未指定" : String(preview.binding.subscriptionId) }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}
      </dl>{preview.warning && <p className="text-sm text-amber-700 dark:text-amber-400">{preview.warning}</p>}</section>}
      <fieldset disabled={!!busy || !!candidate} className="min-w-0 space-y-6 disabled:opacity-70">
        <Section title="基本资料"><Fields labels={basicLabels} values={draft.basic} onChange={(key, value) => edit({ ...draft, basic: { ...draft.basic, [key]: value } })} /></Section>
        <Section title="求职意向"><Fields labels={preferenceLabels} values={draft.preferences} onChange={(key, value) => edit({ ...draft, preferences: { ...draft.preferences, [key]: value } })} /></Section>
        <RecruitingAccounts data={draft} devices={devices} devicesAvailable={devicesAvailable} onChange={edit} previewDisabled={dirty || !!busy} onPreview={(accountId) => void previewLogin(accountId)} onRefreshDevices={() => void refreshDevices()} />
        {(Object.keys(sectionLabels) as SectionKey[]).map((key) => <RepeatedSection key={key} section={key} rows={draft[key]} onChange={(rows) => edit({ ...draft, [key]: rows })} />)}
      </fieldset>
    </>}
  </div>;
}
