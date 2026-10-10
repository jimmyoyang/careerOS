import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentApprovalCard } from "@/components/agent/AgentApprovalCard";

const part = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "tool-add_job",
    toolCallId: "c1",
    state: "approval-requested",
    approval: { id: "ap1" },
    input: {
      company: "Acme Corp",
      jobTitle: "Senior Platform Engineer",
      location: "Remote",
      source: "LinkedIn",
      jobUrl: "https://example.com/jobs/1",
      salaryRange: "$180k",
      tags: ["Go", "Kubernetes"],
    },
    ...overrides,
  }) as any;

const longPaste = Array.from({ length: 200 }, () => "word").join(" ");

describe("AgentApprovalCard", () => {
  it("renders the arguments as labelled rows under a Needs approval pill", () => {
    render(<AgentApprovalCard part={part()} onRespond={vi.fn()} />);
    expect(screen.getByText("需要确认")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Senior Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("$180k")).toBeInTheDocument();
    expect(screen.getByText(/Go/)).toBeInTheDocument();
  });

  it("renders a model-supplied URL as text, never as an anchor", () => {
    const { container } = render(
      <AgentApprovalCard part={part()} onRespond={vi.fn()} />,
    );
    expect(screen.getByText("https://example.com/jobs/1")).toBeInTheDocument();
    const anchors = Array.from(container.querySelectorAll("a"));
    expect(
      anchors.some((a) => a.getAttribute("href")?.includes("example.com")),
    ).toBe(false);
  });

  it("shows the pasted source, its size and a completeness badge before Confirm", () => {
    render(
      <AgentApprovalCard
        part={part()}
        pastedText={longPaste}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText(/粘贴/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${longPaste.length}`)),
    ).toBeInTheDocument();
    expect(screen.getByText(/完整/i)).toBeInTheDocument();
  });

  it("labels a model-supplied description and classifies it as thin when it is", () => {
    render(
      <AgentApprovalCard
        part={part({
          input: {
            company: "Acme",
            jobTitle: "Eng",
            jobDescription: "Backend role, remote.",
          },
        })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText(/模型提取/i)).toBeInTheDocument();
    expect(screen.getByText(/仅标题/i)).toBeInTheDocument();
  });

  it("uses Confirm and Cancel, not Approve and Deny", () => {
    render(<AgentApprovalCard part={part()} onRespond={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /确认/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /取消/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deny/i }),
    ).not.toBeInTheDocument();
  });

  it("responds approved with the approval id from the tool part", async () => {
    const onRespond = vi.fn();
    render(<AgentApprovalCard part={part()} onRespond={onRespond} />);
    await userEvent.click(screen.getByRole("button", { name: /确认/i }));
    expect(onRespond).toHaveBeenCalledWith({ id: "ap1", approved: true });
  });

  it("carries an optional decline reason back to the model", async () => {
    const onRespond = vi.fn();
    render(<AgentApprovalCard part={part()} onRespond={onRespond} />);
    await userEvent.click(screen.getByRole("button", { name: /取消/i }));
    const reason = screen.getByPlaceholderText(/哪里有问题/i);
    await userEvent.type(reason, "wrong company");
    await userEvent.click(screen.getByRole("button", { name: /发送/i }));
    expect(onRespond).toHaveBeenCalledWith({
      id: "ap1",
      approved: false,
      reason: "wrong company",
    });
  });

  it("cancels with no reason if the user does not give one", async () => {
    const onRespond = vi.fn();
    render(<AgentApprovalCard part={part()} onRespond={onRespond} />);
    await userEvent.click(screen.getByRole("button", { name: /取消/i }));
    await userEvent.click(screen.getByRole("button", { name: /跳过/i }));
    expect(onRespond).toHaveBeenCalledWith({ id: "ap1", approved: false });
  });

  it("replaces the buttons with a waiting state once responded", () => {
    render(
      <AgentApprovalCard
        part={part({
          state: "approval-responded",
          approval: { id: "ap1", approved: true },
        })}
        onRespond={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /确认/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/等待/i)).toBeInTheDocument();
  });

  it("renders nothing for a state it does not own", () => {
    const { container } = render(
      <AgentApprovalCard
        part={part({ state: "input-available" })}
        onRespond={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
