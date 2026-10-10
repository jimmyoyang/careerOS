import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageDetailPanel } from "@/components/myjobs/job-details/timeline/StageDetailPanel";
import {
  deleteJobStage,
  setPrepQuestionAsked,
  setStageNotes,
} from "@/actions/jobStage.actions";

vi.mock("@/actions/jobStage.actions", () => ({
  setPrepQuestionAsked: vi.fn().mockResolvedValue({ success: true }),
  removeStagePrepQuestion: vi.fn().mockResolvedValue({ success: true }),
  unlinkStageInterviewer: vi.fn().mockResolvedValue({ success: true }),
  setStageNotes: vi.fn().mockResolvedValue({ success: true }),
  deleteJobStage: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/toast", () => ({
  toastActionResult: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const interviewStage = {
  id: "st1",
  jobId: "j1",
  stageTypeId: "t-int",
  occurredAt: new Date(2026, 8, 24, 10, 0),
  isCurrent: true,
  outcome: "scheduled",
  notes: "Bring laptop",
  durationMins: 90,
  format: "On-site",
  location: "Acme HQ, Bldg 3",
  createdAt: new Date(2026, 8, 2),
  updatedAt: new Date(2026, 8, 2),
  StageType: {
    id: "t-int",
    label: "Final / Onsite Interview",
    value: "final / onsite interview",
    statusId: "s-int",
    sortOrder: 6,
    Status: { id: "s-int", label: "Interview", value: "interview" },
  },
  interviewers: [
    {
      id: "iv1",
      stageId: "st1",
      contactId: "c1",
      Contact: { id: "c1", name: "Priya Nair", title: "VP Engineering", email: null, phone: null, linkedinUrl: null, lastContactedAt: null, Company: { id: "co1", label: "Anthropic" } },
    },
  ],
  prepQuestions: [
    { id: "p1", stageId: "st1", questionId: "q1", asked: true, askedAt: new Date(), Question: { id: "q1", question: "Walk through your caching strategy", tags: [{ id: "tg1", label: "System Design", value: "system design", createdBy: "u1" }] } },
    { id: "p2", stageId: "st1", questionId: "q2", asked: false, askedAt: null, Question: { id: "q2", question: "Tell me about a conflict with a teammate", tags: [] } },
  ],
} as any;

const nonInterviewStage = {
  ...interviewStage,
  id: "st2",
  interviewers: [],
  prepQuestions: [],
  StageType: {
    ...interviewStage.StageType,
    label: "Applied",
    Status: { id: "s-app", label: "Applied", value: "applied" },
  },
};

const noop = () => {};

describe("StageDetailPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the stage name, the current-stage marker and the scheduled line", () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.getByRole("heading", { name: "终面 / 现场面试" })).toBeInTheDocument();
    expect(screen.getByText("当前阶段")).toBeInTheDocument();
    expect(screen.getByText(/2026年9月24日 · 10:00 · 90 分钟/)).toBeInTheDocument();
  });

  // Overview is the landing tab, so format, location, duration and outcome are
  // on screen without a click; interviewers and questions are one tab away.
  it("opens on Overview with location, format, duration and outcome", () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.getByRole("tab", { name: "概览" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Acme HQ, Bldg 3")).toBeInTheDocument();
    expect(screen.getByText("On-site")).toBeInTheDocument();
    expect(screen.getByText("90 分钟")).toBeInTheDocument();
    expect(screen.getByText("已安排")).toBeInTheDocument();
    expect(screen.queryByText("Priya Nair")).toBeNull();
  });

  it("shows the linked interviewers on the Interviewer tab", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: /^面试官/ }));

    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(
      screen.getByText("VP Engineering \u00b7 Anthropic"),
    ).toBeInTheDocument();
  });

  // The tally rides on the trigger, so the prep progress is readable from the
  // Overview tab without opening the list.
  it("carries the asked tally on the Prep List tab trigger", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.getByRole("tab", { name: /准备清单 1 \/ 2/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /准备清单/ }));

    expect(screen.getByText("System Design")).toBeInTheDocument();
  });

  it.each(["<p>TBD</p>", "<p>待填写</p>"])("treats the %s default as an unanswered prep question", async (answer) => {
    const stage = {
      ...interviewStage,
      prepQuestions: [{
        ...interviewStage.prepQuestions[0],
        Question: { ...interviewStage.prepQuestions[0].Question, answer },
      }],
    };
    render(
      <StageDetailPanel stage={stage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );
    await userEvent.click(screen.getByRole("tab", { name: /准备清单/ }));
    expect(screen.getByText("暂无答案")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /显示.*的答案/ })).not.toBeInTheDocument();
  });

  it("drops the tab row on a non-interview stage and shows the overview alone", () => {
    render(
      <StageDetailPanel stage={nonInterviewStage} isCurrent={false} onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText(/面试官/)).toBeNull();
    expect(screen.queryByText(/准备清单/)).toBeNull();
    // Notes are a live textarea, so this is a value, not page text.
    expect(screen.getByLabelText("笔记")).toHaveValue("Bring laptop");
  });

  // Location, format and duration are interview-only in the Add Stage dialog,
  // so a legacy row carrying them must not surface them here either.
  it("hides location, format and duration on a non-interview stage", () => {
    render(
      <StageDetailPanel stage={nonInterviewStage} isCurrent={false} onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.queryByText("地点")).toBeNull();
    expect(screen.queryByText("形式")).toBeNull();
    expect(screen.queryByText("时长")).toBeNull();
    expect(screen.queryByText(/90 min/)).toBeNull();
    expect(screen.getByText("结果")).toBeInTheDocument();
  });

  // Nothing remounts when another stage is selected, so the tab has to be
  // reset by hand or an interview tab survives onto a stage that has none.
  it("returns to Overview when another stage is selected", async () => {
    const { rerender } = render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: /^面试官/ }));
    rerender(
      <StageDetailPanel stage={{ ...interviewStage, id: "st9" }} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.getByRole("tab", { name: "概览" })).toHaveAttribute("data-state", "active");
  });

  it("marks a question asked inline, with no dialog and no save step", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: /准备清单/ }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Tell me about a conflict with a teammate/ }),
    );

    expect(setPrepQuestionAsked).toHaveBeenCalledWith("p2", true);
  });

  // The artboard's inline notes editor. Save appears only once the text has
  // actually changed, so the resting panel is not cluttered with dead buttons.
  it("edits notes in place, showing Save only once the text changes", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    expect(screen.queryByRole("button", { name: "保存更改" })).toBeNull();

    await userEvent.type(screen.getByLabelText("笔记"), " Ask about on-call.");
    await userEvent.click(screen.getByRole("button", { name: "保存更改" }));

    expect(setStageNotes).toHaveBeenCalledWith(
      "st1",
      "Bring laptop Ask about on-call.",
    );
  });

  it("deletes the stage once the alert is confirmed", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "删除终面 / 现场面试" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(deleteJobStage).toHaveBeenCalledWith("st1");
  });

  it("does not delete when the alert is dismissed", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "删除终面 / 现场面试" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(deleteJobStage).not.toHaveBeenCalled();
  });

  // Deleting the current stage re-derives the job's status server-side, so
  // the alert has to say so rather than use the generic warning.
  it("warns that the status follows when the current stage is deleted", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "删除终面 / 现场面试" }),
    );

    expect(screen.getByText(/职位状态也会随之更新/)).toBeInTheDocument();
  });

  it("uses the generic warning for a stage that is not current", async () => {
    render(
      <StageDetailPanel stage={nonInterviewStage} isCurrent={false} onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除已投递" }));

    expect(screen.getByText(/此操作无法撤销/)).toBeInTheDocument();
  });

  it("reverts the draft on Cancel without calling the action", async () => {
    render(
      <StageDetailPanel stage={interviewStage} isCurrent onEdit={noop} onLinkInterviewers={noop} onAddPrepQuestions={noop} onChanged={noop} />,
    );

    await userEvent.type(screen.getByLabelText("笔记"), " scratch");
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.getByLabelText("笔记")).toHaveValue("Bring laptop");
    expect(setStageNotes).not.toHaveBeenCalled();
  });
});
