import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sendMessage = vi.fn();
const seedExchange = vi.fn();
let preflight = { checked: true, ok: true };

vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => ({ sendMessage, seedExchange, preflight }),
}));

import { AgentChatEmptyState } from "@/components/agent/AgentChatEmptyState";
import { AGENT_ADD_JOB_INTRO } from "@/lib/agent/prompt";

describe("AgentChatEmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preflight = { checked: true, ok: true };
  });

  // The click carries no company, title or posting, so add_job is
  // unreachable and the prompt leaves the model one legal reply. Spending a
  // 15-30s turn on it is latency for text we already know.
  it("answers the add-job suggestion locally instead of calling the model", async () => {
    render(<AgentChatEmptyState />);
    await userEvent.click(screen.getByText("添加招聘信息"));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(seedExchange).toHaveBeenCalledWith(
      "添加招聘信息",
      AGENT_ADD_JOB_INTRO,
    );
  });

  // The other three end in a tool call whose outcome depends on the page.
  it("sends the tool-backed suggestions to the model", async () => {
    render(<AgentChatEmptyState />);
    await userEvent.click(screen.getByText("匹配岗位"));

    expect(seedExchange).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({
      parts: [{ type: "text", text: "匹配岗位" }],
    });
  });

  it("does nothing when preflight failed", async () => {
    preflight = { checked: true, ok: false };
    render(<AgentChatEmptyState />);
    await userEvent.click(screen.getByText("添加招聘信息"));

    expect(seedExchange).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
