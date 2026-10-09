import type { Match } from "@/lib/career/contracts";
import { Badge } from "@/components/ui/badge";
import { Section } from "./shared";

export function MatchExplanation({
  analysis,
  stale,
}: {
  analysis: Match;
  stale: boolean;
}) {
  const eligibility = { pass: "已满足", fail: "未满足", unknown: "待核实" };
  const direction = {
    high: "方向接近",
    medium: "部分相关",
    low: "方向差异较大",
    unknown: "方向未知",
  };
  const recommendation = {
    recommended: "建议继续准备",
    review: "建议先核实信息",
    not_recommended: "存在不满足的条件",
  };
  return (
    <Section
      title="匹配依据"
      description="按岗位原文逐项核对。未知不等于满足，结论不使用综合分数。"
    >
      {stale && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          输入已变化，此分析已过期。请重新分析。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{direction[analysis.direction]}</Badge>
        <Badge variant="outline">
          {recommendation[analysis.recommendation]}
        </Badge>
        <Badge variant="outline">
          信息
          {
            { complete: "完整", partial: "部分缺失", insufficient: "不足" }[
              analysis.informationQuality
            ]
          }
        </Badge>
      </div>
      {analysis.requirements.map((requirement) => (
        <article
          key={requirement.requirementKey}
          className="space-y-2 border-t pt-4"
        >
          <div className="flex items-center gap-2">
            <Badge
              variant={
                requirement.eligibility === "fail" ? "destructive" : "outline"
              }
            >
              {eligibility[requirement.eligibility]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {requirement.mandatory ? "硬性条件" : "一般要求"}
            </span>
          </div>
          <blockquote className="border-l-2 pl-3 text-sm leading-6">
            {requirement.source.quote}
          </blockquote>
          <p className="text-sm text-muted-foreground">{requirement.reason}</p>
          <p className="text-xs text-muted-foreground">
            原文位置 {requirement.source.start}–{requirement.source.end} ·
            关联事实 {requirement.evidence.length} 条
          </p>
        </article>
      ))}
      {analysis.unresolvedFields.length > 0 && (
        <p className="text-sm text-muted-foreground">
          仍有 {analysis.unresolvedFields.length}{" "}
          项条件需要核实，见上方岗位原文。
        </p>
      )}
    </Section>
  );
}
