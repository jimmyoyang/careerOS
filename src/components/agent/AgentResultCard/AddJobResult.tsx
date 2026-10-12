"use client";

import { zhLabel, zhMessage } from "@/lib/i18n/zh-CN";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AgentAddJobResult } from "@/models/agent.model";

// Composed from the tool result's STRUCTURED fields, never from
// createJobFromNames' message string — that prose is MCP-facing protocol text
// naming update_job and allowDuplicate, tools this surface does not expose.
export function AddJobResult({
  output,
  input,
}: {
  output: AgentAddJobResult;
  input: Record<string, unknown>;
}) {
  if (output.validationError) {
    return (
      <p className="text-sm">
        无法添加岗位： {zhMessage(output.displayError ?? output.validationError)}
      </p>
    );
  }

  if (output.duplicateOf) {
    return (
      <div className="text-sm">
        <p>
          已在跟踪： <strong>{output.duplicateOf.title}</strong> ·{" "}
          <strong>{output.duplicateOf.company}</strong>。未重复创建岗位。
        </p>
        <Link
          className="text-xs underline"
          href={`/dashboard/myjobs/${output.duplicateOf.id}`}
        >
          打开已有岗位
        </Link>
      </div>
    );
  }

  const newEntities = output.resolutions
    .filter((r) => r.created)
    .map((r) => r.label);
  const jobTitle = typeof input.jobTitle === "string" ? input.jobTitle : "岗位";
  const company = typeof input.company === "string" ? input.company : undefined;

  return (
    <div className="text-sm">
      <p>
        已添加 <strong>{jobTitle}</strong>
        {company ? ` · ${company}` : ""}.
      </p>
      {output.jobId && (
        <Link
          className="text-xs underline"
          href={`/dashboard/myjobs/${output.jobId}`}
        >
          打开岗位
        </Link>
      )}
      {newEntities.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          新增： {newEntities.join(", ")}
        </p>
      )}
      {output.descriptionChars !== undefined && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            描述 ·{" "}
            {output.descriptionSource === "pasted"
              ? "按原文粘贴"
              : "模型提取"}{" "}
            · {output.descriptionChars} 字符
          </span>
          {output.descriptionCompleteness && (
            <Badge variant="outline">{zhLabel(output.descriptionCompleteness)}</Badge>
          )}
        </p>
      )}
    </div>
  );
}
