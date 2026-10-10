"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobBoard, LeverSourceConfig } from "@/models/automation.model";
import { companyBoardUrl } from "@/lib/atsBoardUrl";
import { APP_CONSTANTS } from "@/lib/constants";

// Pure JSON parse (no runner dependency — this is a client component, and
// runner.ts pulls the network-calling scraper into the client bundle). The raw
// parse may be missing any field, so it's a Partial of the config shape.
function parseAtsConfig(
  sourceConfig: string | null | undefined,
  jobBoard: JobBoard,
): Partial<LeverSourceConfig> | null {
  if (!sourceConfig) return null;
  try {
    return JSON.parse(sourceConfig)?.[jobBoard] ?? null;
  } catch {
    return null;
  }
}

interface AutomationSearchConfigProps {
  sourceConfig: string | null | undefined;
  jobBoard: JobBoard;
  retired: boolean;
}

export function AutomationSearchConfig({
  sourceConfig,
  jobBoard,
  retired,
}: AutomationSearchConfigProps) {
  const [showSearchConfig, setShowSearchConfig] = useState(false);

  const greenhouseConfig = retired
    ? null
    : parseAtsConfig(sourceConfig, jobBoard);

  if (!greenhouseConfig) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mt-4 -ml-2 text-muted-foreground"
        onClick={() => setShowSearchConfig((prev) => !prev)}
      >
        {showSearchConfig ? (
          <ChevronUp className="h-4 w-4 mr-1" />
        ) : (
          <ChevronDown className="h-4 w-4 mr-1" />
        )}
        {showSearchConfig ? "收起" : "展开"}
      </Button>

      {showSearchConfig && (
        <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-4">
            <p className="text-sm text-muted-foreground">公司</p>
            {greenhouseConfig.companies?.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {greenhouseConfig.companies.map((c) => (
                  <Badge key={c.token} variant="secondary" className="gap-1">
                    {c.name}
                    <a
                      href={companyBoardUrl(jobBoard, c)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`打开 ${c.name} 招聘页面`}
                      title="打开招聘页面"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">目标职位</p>
            <p className="font-medium">
              {greenhouseConfig.targetTitles?.length
                ? greenhouseConfig.targetTitles.join(", ")
                : "不限"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">关键词</p>
            <p className="font-medium">
              {greenhouseConfig.keywords?.length
                ? greenhouseConfig.keywords.join(", ")
                : "无"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">地点</p>
            <p className="font-medium">
              {greenhouseConfig.locations?.length
                ? `${greenhouseConfig.locations.join(", ")}${
                    greenhouseConfig.strictLocation ? "（严格匹配）" : ""
                  }`
                : "不限地点"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              每次运行分析的岗位数
            </p>
            <p className="font-medium">
              {greenhouseConfig.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">其他岗位</p>
            <p className="font-medium">
              {greenhouseConfig.saveUnanalyzed !== false
                ? "已保存"
                : "未保存"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
