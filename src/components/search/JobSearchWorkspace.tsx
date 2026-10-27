"use client";

import Link from "next/link";
import { BriefcaseBusiness, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zhLabel } from "@/lib/i18n/zh-CN";
import type { JobLocation, JobSource, JobStatus, JobTitle } from "@/models/job.model";
import { SEARCH_PAGE_SIZE, useJobSearch } from "./useJobSearch";
import { SearchJobResults } from "./SearchJobResults";

type SearchProps = {
  sources: JobSource[];
  locations: JobLocation[];
  statuses: JobStatus[];
  titles?: JobTitle[];
};

function Filter({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  return <label className="grid min-w-0 gap-2 text-sm">
    <span>{label}</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring">
      <option value="">全部</option>
      {value && !options.some((option) => option.value === value) && <option value={value}>{value}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function JobSearchWorkspace({ sources, locations, statuses, titles = [] }: SearchProps) {
  const search = useJobSearch();
  const pageCount = Math.max(1, Math.ceil(search.total / SEARCH_PAGE_SIZE));
  return (
    <div className="career-workspace-shell col-span-3 mx-auto w-full min-w-0 max-w-7xl space-y-6 py-4 sm:py-8">
      <section className="career-search-hero relative overflow-hidden rounded-3xl px-5 py-8 text-white shadow-[0_24px_70px_-32px_rgba(159,8,37,0.65)] sm:px-10 sm:py-12">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-white/80">CAREEROS · 多平台职位中心</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">集中查找，逐一准备</h1>
        <p className="mt-3 text-sm leading-6 text-white/90">搜索已保存和导入的职位，按来源比较机会，查看简历匹配与申请进展。</p>
        <form onSubmit={(event) => { event.preventDefault(); search.submit(); }} className="mt-7 flex max-w-2xl items-center gap-2 rounded-xl bg-white p-2">
          <Search className="ml-2 hidden h-5 w-5 shrink-0 text-slate-500 sm:block" />
          <Input value={search.draftQuery} onChange={(event) => search.setDraftQuery(event.target.value)} placeholder="搜索职位、公司或技能" aria-label="搜索职位、公司或技能" className="h-11 min-w-0 border-0 bg-transparent text-slate-900" />
          <Button type="submit" className="h-11 shrink-0 bg-[#cf0a2c] px-5 text-white hover:bg-[#b70926]">搜索</Button>
        </form>
      </section>
      <section className="app-surface flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div><h2 className="font-semibold">华为公开招聘</h2><p className="mt-1 text-sm text-muted-foreground">查询官网校招与实习职位，选择意向后导入并准备申请。</p></div>
        <Button asChild variant="outline"><Link href="/dashboard/huawei">查询华为公开职位</Link></Button>
      </section>
      <section className="app-surface flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div><h2 className="font-semibold">字节公开招聘</h2><p className="mt-1 text-sm text-muted-foreground">查询官网校招与实习职位，导入后核对手机号并准备申请。</p></div>
        <Button asChild variant="outline"><Link href="/dashboard/bytedance">查询字节公开职位</Link></Button>
      </section>
      <section className="app-surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="h-4 w-4 text-[#cf0a2c]" />筛选已收录职位</div>
        <div className="grid gap-3 sm:grid-cols-2 @3xl/main:grid-cols-4">
          <Filter label="来源平台" value={search.source} options={sources.map((source) => ({ ...source, label: zhLabel(source.label) }))} onChange={(source) => search.update({ source, q: search.draftQuery.trim() })} />
          <Filter label="工作地点" value={search.location} options={locations} onChange={(location) => search.update({ location, q: search.draftQuery.trim() })} />
          <Filter label="职位名称" value={search.title} options={titles} onChange={(title) => search.update({ title, q: search.draftQuery.trim() })} />
          <Filter label="跟踪状态" value={search.status} options={statuses.map((status) => ({ ...status, label: zhLabel(status.label) }))} onChange={(status) => search.update({ status, q: search.draftQuery.trim() })} />
        </div>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => { search.setDraftQuery(""); search.update({ q: "", source: "", location: "", title: "", status: "" }); }}>清除筛选</Button>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 aria-live="polite" className="text-2xl font-semibold">{search.loading ? "搜索中" : search.error ? "搜索未完成" : `${search.total} 个职位`}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" aria-pressed={search.view === "cards"} onClick={() => search.update({ view: "cards" }, false)}>卡片</Button>
          <Button size="sm" variant="outline" aria-pressed={search.view === "table"} onClick={() => search.update({ view: "table" }, false)}>表格</Button>
          <Link href="/dashboard/myjobs" className="text-sm font-medium text-primary hover:underline">管理我的职位</Link>
        </div>
      </div>
      {search.loading ? (
        <div role="status" className="app-surface flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#cf0a2c]" /><span className="sr-only">正在加载职位</span></div>
      ) : search.error ? (
        <div role="alert" className="app-surface space-y-3 p-6"><p>{search.error}</p><Button onClick={search.retry}>重试</Button></div>
      ) : search.jobs.length === 0 ? (
        <div className="app-surface flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
          <BriefcaseBusiness className="h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">暂时没有匹配的职位</p>
          <p className="text-sm text-muted-foreground">调整筛选条件，或先添加职位。这里显示已收录记录，不代表平台实时职位数量。</p>
          <Button asChild variant="outline"><Link href="/dashboard/myjobs?add-job=true">添加职位</Link></Button>
        </div>
      ) : <SearchJobResults jobs={search.jobs} view={search.view} />}
      {!search.loading && !search.error && (pageCount > 1 || search.page > 1) && <nav aria-label="职位分页" className="flex flex-wrap items-center justify-center gap-4">
        <Button variant="outline" disabled={search.page <= 1} onClick={() => search.update({ page: String(search.page - 1) }, false)}>上一页</Button>
        <span className="text-sm">第 {search.page} 页 / 共 {pageCount} 页</span>
        <Button variant="outline" disabled={search.page >= pageCount} onClick={() => search.update({ page: String(search.page + 1) }, false)}>下一页</Button>
      </nav>}
    </div>
  );
}
