"use client";

import { getToolName, type ToolUIPart } from "ai";
import { AgentStatusRow } from "@/components/agent/AgentStatusRow";

// Confirmation renders null for these states, so this is not redundant with
// it. On a local 8B, deciding on a tool call is the longest phase of a turn.
export function AgentToolRunningCard({ part }: { part: ToolUIPart }) {
  const toolName = getToolName(part);
  const label =
    toolName === "add_job"
      ? "正在准备添加岗位…"
      : toolName === "get_resume"
        ? "正在读取简历…"
        : toolName === "review_resume"
          ? "正在评估简历…"
          : toolName === "match_job"
            ? "正在分析简历与此岗位的匹配度…"
            : toolName === "generate_cover_letter"
              ? "正在撰写求职信…"
              : "正在处理…";

  return <AgentStatusRow label={label} />;
}
