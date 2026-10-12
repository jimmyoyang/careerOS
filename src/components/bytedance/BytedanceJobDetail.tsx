"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getBytedanceJobAction, importBytedanceJobAction } from "@/actions/bytedance.actions";
import { Button } from "@/components/ui/button";
import type { BytedanceDetail } from "@/lib/bytedance/types";

export default function BytedanceJobDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<BytedanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [imported, setImported] = useState<{ jobId: string; duplicate: boolean } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const importRequest = useRef(0);
  const importKey = useRef("");
  const importPending = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setDetail(null);
    setImported(null); setImportError(""); setImporting(false);
    importKey.current = ""; importPending.current = false;
    async function load() {
      try {
        const response = await getBytedanceJobAction(id);
        if (!active) return;
        if (response.ok) setDetail(response.data);
        else setError(response.error);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "职位详情读取失败，请重试。"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; importRequest.current += 1; };
  }, [id, retry]);

  useEffect(() => {
    if (loading || window.innerWidth >= 1024) return;
    sectionRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, [loading]);

  async function importJob() {
    if (!detail || importPending.current || imported) return;
    const request = ++importRequest.current;
    importPending.current = true;
    setImporting(true); setImportError("");
    try {
      importKey.current ||= crypto.randomUUID();
      const response = await importBytedanceJobAction(id, importKey.current);
      if (request !== importRequest.current) return;
      if (response.ok) setImported(response.data);
      else setImportError(response.error);
    } catch (cause) { if (request === importRequest.current) setImportError(cause instanceof Error ? cause.message : "职位导入失败，请重试。"); }
    finally { if (request === importRequest.current) { importPending.current = false; setImporting(false); } }
  }

  return <section ref={sectionRef} tabIndex={-1} aria-label="职位详情" className="scroll-mt-20 min-w-0 space-y-5 rounded-xl border bg-card p-5 sm:p-6">
    {loading ? <p role="status">正在读取职位详情…</p> : error ? <div role="alert" className="space-y-3"><p>{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>重试职位详情</Button></div> : detail && <>
      <div><p className="text-xs font-medium text-muted-foreground">职位详情</p><h2 className="mt-2 break-words text-xl font-semibold">{detail.title}</h2></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries({ "职位编号": detail.code, "工作地点": detail.location, "招聘项目": detail.project, "官网发布日期": detail.publishedAt }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value || "官网未提供"}</dd></div>)}</dl>
      <div><h3 className="font-medium">岗位职责</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{detail.responsibilities || "官网未提供"}</p></div>
      <div><h3 className="font-medium">岗位要求</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{detail.requirements || "官网未提供"}</p></div>
      {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
      {imported && <div role="status" className="space-y-2 rounded-lg bg-muted p-4 text-sm"><p>{imported.duplicate ? "此职位已在我的职位中，已关联原记录。" : "已导入我的职位，尚未提交申请。"}</p><div className="flex flex-wrap gap-4"><Link className="text-primary underline" href={`/dashboard/myjobs/${encodeURIComponent(imported.jobId)}`}>查看已导入职位</Link><Link className="text-primary underline" href={`/dashboard/career?jobId=${encodeURIComponent(imported.jobId)}`}>准备简历与申请</Link></div></div>}
      <div className="flex flex-wrap gap-3"><Button onClick={() => void importJob()} disabled={importing || !!imported}>{importing ? "正在导入…" : imported ? "已导入我的职位" : "导入我的职位"}</Button><Button asChild variant="outline"><a href={detail.url} target="_blank" rel="noopener noreferrer">在字节官网继续申请</a></Button></div>
      <p className="text-xs leading-5 text-muted-foreground">申请前请核对下方账号的邮箱与手机号。打开官网后仍需自行登录、确认资料并提交申请。</p>
    </>}
  </section>;
}
