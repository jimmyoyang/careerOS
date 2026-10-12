"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { listHuaweiJobsAction } from "@/actions/huawei.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HuaweiPage, HuaweiQuery, HuaweiRecruitmentType } from "@/lib/huawei/types";
import HuaweiAccountPanel from "./HuaweiAccountPanel";
import HuaweiJobDetail from "./HuaweiJobDetail";

export default function HuaweiWorkspace() {
  const [keyword, setKeyword] = useState("");
  const [recruitmentType, setRecruitmentType] = useState<HuaweiRecruitmentType>("campus");
  const [query, setQuery] = useState<HuaweiQuery>({ recruitmentType: "campus", keyword: "", page: 1 });
  const [result, setResult] = useState<HuaweiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setResult(null);
    async function load() {
      try {
        const response = await listHuaweiJobsAction(query);
        if (!active) return;
        if (response.ok) setResult(response.data);
        else setError(response.error);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "公开职位读取失败，请重试。");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [query]);

  function search(next: HuaweiQuery) { setSelectedId(""); setQuery(next); }
  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return <div className="career-workspace-shell mx-auto w-full min-w-0 max-w-7xl space-y-6 py-4 sm:py-8">
    <Link href="/dashboard/search" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回职位中心</Link>
    <header className="career-search-hero rounded-2xl px-5 py-8 text-white sm:px-10">
      <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-white/80">CAREEROS · 华为公开招聘</p>
      <h1 className="text-3xl font-semibold">华为校招与实习职位</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90">查询公开职位，选择具体意向后导入我的职位。核对已保存的账号，再到华为官网继续申请。</p>
    </header>
    <form onSubmit={(event) => { event.preventDefault(); search({ recruitmentType, keyword: keyword.trim(), page: 1 }); }} className="grid items-end gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
      <label className="grid gap-2 text-sm"><span>招聘类型</span><select value={recruitmentType} onChange={(event) => setRecruitmentType(event.target.value as HuaweiRecruitmentType)} className="h-10 min-w-0 rounded-md border bg-background px-3"><option value="campus">校园招聘</option><option value="internship">实习招聘</option></select></label>
      <label className="grid min-w-0 gap-2 text-sm"><span>职位关键词</span><Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="例如：软件、算法" maxLength={100} /></label>
      <Button type="submit"><Search className="size-4" />查询公开职位</Button>
    </form>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label="华为公开职位列表" className="min-w-0 space-y-4">
        <div><h2 className="text-xl font-semibold">公开职位</h2><p className="mt-1 text-sm text-muted-foreground">仅展示当前查询结果，查询与导入均不代表已提交申请。</p></div>
        {loading ? <p role="status" className="rounded-xl border bg-card p-6">正在读取华为公开职位…</p> : error ? <div role="alert" className="space-y-3 rounded-xl border bg-card p-5"><p>{error}</p><Button variant="outline" onClick={() => search({ ...query })}>重试职位查询</Button></div> : result && <>
          <div className="space-y-1 text-sm text-muted-foreground"><p>当前筛选共 {result.total} 个职位 · 第 {result.page} 页 / 共 {pageCount} 页</p><p>本页读取时间：<time dateTime={result.fetchedAt}>{new Date(result.fetchedAt).toLocaleString("zh-CN", { hour12: false })}</time></p></div>
          {result.jobs.length === 0 ? <div className="rounded-xl border bg-card p-6"><p className="font-medium">没有找到匹配的公开职位</p><p className="mt-2 text-sm text-muted-foreground">试试其他关键词或招聘类型。</p></div> : <ul className="space-y-3">{result.jobs.map((job) => <li key={job.advertisementId} className={`min-w-0 rounded-xl border bg-card p-5 ${selectedId === job.advertisementId ? "border-primary" : ""}`}>
            <h3 className="break-words font-semibold">{job.title}</h3>
            <p className="mt-2 break-words text-sm text-muted-foreground">{job.location || "地点未提供"} · {job.category || "类别未提供"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{job.recruitmentType === "campus" ? "校园招聘" : "实习招聘"}{job.updatedAt ? ` · 官网更新：${job.updatedAt}` : ""}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant={selectedId === job.advertisementId ? "default" : "outline"} size="sm" aria-label={`查看${job.title}`} aria-pressed={selectedId === job.advertisementId} onClick={() => setSelectedId(job.advertisementId)}>查看详情</Button><a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">查看官网<ExternalLink className="size-3" /></a></div>
          </li>)}</ul>}
          <nav aria-label="华为职位分页" className="flex items-center justify-between gap-3"><Button variant="outline" disabled={result.page <= 1} onClick={() => search({ ...query, page: result.page - 1 })}>上一页</Button><span className="text-sm text-muted-foreground">{result.page} / {pageCount}</span><Button variant="outline" disabled={result.page >= pageCount} onClick={() => search({ ...query, page: result.page + 1 })}>下一页</Button></nav>
        </>}
      </section>
      <div className="min-w-0 space-y-6">
        {selectedId ? <HuaweiJobDetail key={selectedId} advertisementId={selectedId} /> : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">选择职位查看职责、要求及可申请的具体意向。</div>}
        <HuaweiAccountPanel />
      </div>
    </div>
  </div>;
}
