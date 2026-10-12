"use client";

import { zhMessage } from "@/lib/i18n/zh-CN";

import Link from "next/link";
import { AgentMarkdown } from "@/components/agent/AgentMarkdown";
import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentCoverLetterResult } from "@/models/agent.model";

// The letter comes from the tool output, not from the streamed text: the
// stream is a progress indicator and the output is what was saved.
export function CoverLetterResult({ output }: { output: AgentCoverLetterResult }) {
  if (output.status === "no_job") {
    return (
      <p className="text-sm">
        请先打开目标岗位，我会为您正在查看的岗位撰写求职信。
      </p>
    );
  }

  if (output.status === "no_description") {
    return (
      <p className="text-sm">
        <strong>{output.jobTitle}</strong> 尚无完整描述。添加招聘信息后，我就可以据此撰写求职信。
      </p>
    );
  }

  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return (
      <ResumeSelectionPrompt
        prompt="求职信应参考哪份简历？"
        resumes={output.resumes}
        messageFor={(title) =>
          `请使用我的简历“${title}”为此岗位撰写求职信。`
        }
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
        无法为以下岗位撰写求职信： <strong>{output.jobTitle}</strong> —{" "}
        {zhMessage(output.reason)}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentMarkdown text={output.body} />
      <p className="mt-2 text-xs text-muted-foreground">
        {output.jobTitle}
        {output.company ? ` · ${output.company}` : ""} · 参考简历{" "}
        {output.resumeTitle}
      </p>
      {output.saved ? (
        <p className="mt-1 text-xs text-muted-foreground">
          已保存为“{output.coverLetterTitle}” —{" "}
          <Link href="/dashboard/profile" className="underline">
            可在“个人资料 → 文档”中编辑
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          求职信未保存： {zhMessage(output.saveError ?? "")}
        </p>
      )}
    </div>
  );
}
