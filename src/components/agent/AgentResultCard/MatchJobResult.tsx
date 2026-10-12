"use client";

import { zhMessage } from "@/lib/i18n/zh-CN";

import { AgentMatchContent } from "@/components/agent/AgentMatchContent";
import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentMatchJobResult } from "@/models/agent.model";

// The score and body come from the tool output, not from parsed prose — the
// match is a server-side generation, so the card cannot disagree with what
// was saved.
export function MatchJobResult({ output }: { output: AgentMatchJobResult }) {
  if (output.status === "no_job") {
    return (
      <p className="text-sm">
        请先打开目标岗位，我会评估您正在查看的岗位。
      </p>
    );
  }

  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return (
      <ResumeSelectionPrompt
        prompt="应使用哪份简历进行匹配？"
        resumes={output.resumes}
        messageFor={(title) => `请将此岗位与我的简历“${title}”进行匹配。`}
      />
    );
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        无法读取 <strong>{output.title}</strong> — {zhMessage(output.reason)}
      </p>
    );
  }

  if (output.status === "generation_failed") {
    return (
      <p className="text-sm">
        无法匹配 <strong>{output.jobTitle}</strong> — {zhMessage(output.reason)}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentMatchContent body={output.body} scores={output.scores} />
      <p className="mt-2 text-xs text-muted-foreground">
        {output.jobTitle}
        {output.company ? ` · ${output.company}` : ""} · 匹配简历{" "}
        {output.resumeTitle}
      </p>
      {!output.saved && (
        <p className="mt-1 text-xs text-muted-foreground">
          匹配结果未保存： {zhMessage(output.saveError ?? "")}
        </p>
      )}
    </div>
  );
}
