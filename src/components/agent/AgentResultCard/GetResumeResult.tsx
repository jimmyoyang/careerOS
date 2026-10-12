"use client";

import { zhMessage } from "@/lib/i18n/zh-CN";

import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentGetResumeResult } from "@/models/agent.model";

// The resume text itself is never rendered: the user is about to read the
// review, not the serialization, and the card would be a wall of text.
export function GetResumeResult({ output }: { output: AgentGetResumeResult }) {
  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        无法读取 <strong>{output.title}</strong> — {zhMessage(output.reason)}
      </p>
    );
  }

  if (output.status === "needs_selection") {
    return <ResumeSelectionPrompt prompt="请选择简历" resumes={output.resumes} />;
  }

  const sourceNote =
    output.source === "default"
      ? "（默认简历）"
      : output.source === "page"
        ? "（您正在查看的简历）"
        : "";

  return (
    <div className="text-sm">
      <p>
        已读取 <strong>{output.title}</strong>
        {sourceNote}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {output.chars.toLocaleString()} 字符
        {output.truncated ? "· 已截断" : ""}
        {output.ambiguousTitle ? "· 多份简历使用此标题" : ""}
      </p>
    </div>
  );
}
