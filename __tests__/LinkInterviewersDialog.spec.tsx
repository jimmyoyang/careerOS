import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkInterviewersDialog } from "@/components/myjobs/job-details/timeline/LinkInterviewersDialog";
import { linkStageInterviewer } from "@/actions/jobStage.actions";
import { getAllContacts } from "@/actions/contact.actions";

vi.mock("@/actions/jobStage.actions", () => ({
  linkStageInterviewer: vi.fn().mockResolvedValue({ success: true, data: { id: "iv2" } }),
}));
vi.mock("@/actions/contact.actions", () => ({
  getAllContacts: vi.fn(),
  createContact: vi.fn().mockResolvedValue({ success: true, data: { id: "c9", name: "New Person" } }),
}));
vi.mock("@/lib/toast", () => ({
  toastActionResult: vi.fn((res, opts) => res.success && opts.onSuccess?.()),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const stage = {
  id: "st1",
  occurredAt: new Date(2026, 8, 24, 10, 0),
  StageType: { label: "Final / Onsite Interview", Status: { value: "interview" } },
  interviewers: [{ id: "iv1", contactId: "c1", Contact: { id: "c1", name: "Priya Nair" } }],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  (getAllContacts as any).mockResolvedValue([
    { id: "c1", label: "Priya Nair", title: "VP Engineering", company: "Acme Corp", value: "priya nair vp engineering acme" },
    { id: "c2", label: "John Smith", title: "Engineering Manager", company: "Acme Corp", value: "john smith engineering manager acme" },
  ]);
});

describe("LinkInterviewersDialog", () => {
  it("heads the dialog with the target stage and its date", async () => {
    render(<LinkInterviewersDialog open stage={stage} onOpenChange={() => {}} onLinked={() => {}} />);

    expect(
      await screen.findByText("终面 / 现场面试 · 2026年9月24日"),
    ).toBeInTheDocument();
  });

  it("marks an already-linked contact and offers no Add button for them", async () => {
    render(<LinkInterviewersDialog open stage={stage} onOpenChange={() => {}} onLinked={() => {}} />);

    expect(await screen.findByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("VP Engineering · Acme Corp")).toBeInTheDocument();
    expect(screen.getByLabelText(/Priya Nair已关联/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /添加 John Smith/ })).toBeInTheDocument();
  });

  it("filters the list by the search box", async () => {
    render(<LinkInterviewersDialog open stage={stage} onOpenChange={() => {}} onLinked={() => {}} />);
    await screen.findByText("John Smith");

    await userEvent.type(
      screen.getByPlaceholderText("按姓名或公司搜索联系人…"),
      "john",
    );

    expect(screen.queryByText("Priya Nair")).toBeNull();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  it("links a contact and reports the running count on the Done button", async () => {
    render(<LinkInterviewersDialog open stage={stage} onOpenChange={() => {}} onLinked={() => {}} />);
    await screen.findByText("John Smith");

    await userEvent.click(screen.getByRole("button", { name: /添加 John Smith/ }));

    expect(linkStageInterviewer).toHaveBeenCalledWith("st1", "c2");
    expect(
      await screen.findByRole("button", { name: "完成，已关联 1 位面试官" }),
    ).toBeInTheDocument();
  });
});
