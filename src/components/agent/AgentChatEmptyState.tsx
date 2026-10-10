"use client";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useAgentChat } from "@/components/agent/AgentChatProvider";
import { AGENT_ADD_JOB_INTRO } from "@/lib/agent/prompt";

// None need editing first, so they act on click. "Review resume" runs a real
// turn. "Match a job" and "Generate cover letter" have no page context here,
// so the tools reply with a graceful "no_job" result telling the user to open
// a job's page first. ADD_JOB is the one whose answer is knowable without the
// model — see AGENT_ADD_JOB_INTRO.
const ADD_JOB = "添加招聘信息";
const EXAMPLES = [
  ADD_JOB,
  "评估简历",
  "匹配岗位",
  "生成求职信",
];

export function AgentChatEmptyState() {
  const { sendMessage, seedExchange, preflight } = useAgentChat();

  const handleClick = (example: string) => {
    if (!preflight.ok) return;
    if (example === ADD_JOB) {
      seedExchange(example, AGENT_ADD_JOB_INTRO);
      return;
    }
    void sendMessage({ parts: [{ type: "text", text: example }] });
  };

  return (
    <div className="flex flex-1 flex-col justify-end gap-4 p-4">
      {/* Stated up front rather than left to the model to confess: a local 8B
          asked what it can do will happily invent capabilities. */}
      <p className="text-sm text-muted-foreground">
        我可以帮您添加要跟踪的岗位。粘贴招聘信息或输入详情后，我会先展示提取结果，确认后再保存。我也可以读取和评估简历；在您查看岗位时，分析简历与岗位的匹配度或撰写求职信。目前还无法搜索已有岗位或读取任务。
      </p>

      <Suggestions>
        {EXAMPLES.map((example) => (
          <Suggestion
            disabled={!preflight.ok}
            key={example}
            onClick={handleClick}
            suggestion={example}
          />
        ))}
      </Suggestions>
    </div>
  );
}
