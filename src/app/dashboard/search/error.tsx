"use client";

import { Button } from "@/components/ui/button";

export default function SearchError({ reset }: { reset: () => void }) {
  return <div role="alert" className="col-span-3 space-y-4 rounded-xl border bg-card p-6">
    <h1 className="text-xl font-semibold">暂时无法加载职位搜索</h1>
    <p className="text-sm text-muted-foreground">请重试以重新加载职位和筛选条件。</p>
    <Button onClick={reset}>重试</Button>
  </div>;
}
