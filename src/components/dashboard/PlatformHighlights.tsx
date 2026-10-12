import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";

import { PlatformBadge } from "@/components/career/PlatformBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PlatformHighlights({ sources }: { sources: { value: string; label: string; count: number }[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">最近投递的来源</CardTitle>
        <Layers3 className="h-5 w-5 text-[#cf0a2c]" />
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">记录投递后，这里会显示最近投递的来源。</p>
        ) : sources.map((source) => (
          <Link href={`/dashboard/search?source=${encodeURIComponent(source.value)}`} key={source.value} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
            <PlatformBadge source={source.value} label={source.label} />
            <span className="flex items-center gap-1 text-sm text-muted-foreground">{source.count}<ArrowUpRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">统计最近 10 条投递记录；点击来源可查找该来源的全部已收录职位。</p>
      </CardContent>
    </Card>
  );
}
