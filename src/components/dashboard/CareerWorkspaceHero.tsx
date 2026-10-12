import Link from "next/link";
import { ArrowRight, FileText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CareerWorkspaceHero({
  resumeCount,
  appliedCount,
}: {
  resumeCount: number | null;
  appliedCount: number;
}) {
  return (
    <section className="career-dashboard-hero overflow-hidden rounded-2xl px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">CAREEROS · 招聘工作台</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">把每一次探索，变成下一步成长</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base">从多平台发现机会，准备更有针对性的简历，持续掌握每一次投递进展。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-[#a20825] hover:bg-white/90"><Link href="/dashboard/search"><Search className="mr-2 h-4 w-4" />搜索职位</Link></Button>
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/dashboard/profile"><FileText className="mr-2 h-4 w-4" />管理简历</Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-white/20 bg-black/10 p-4"><p className="text-white/80">简历版本</p><p className="mt-2 text-3xl font-semibold">{resumeCount ?? "—"}</p><Link href="/dashboard/profile" className="mt-2 inline-flex items-center gap-1 text-xs text-white/90 hover:text-white">进入简历中心<ArrowRight className="h-3 w-3" /></Link></div>
          <div className="rounded-xl border border-white/20 bg-black/10 p-4"><p className="text-white/80">近 30 天投递</p><p className="mt-2 text-3xl font-semibold">{appliedCount}</p><Link href="/dashboard/myjobs?applied=true" className="mt-2 inline-flex items-center gap-1 text-xs text-white/90 hover:text-white">查看全部投递<ArrowRight className="h-3 w-3" /></Link></div>
        </div>
      </div>
    </section>
  );
}
