import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionForm } from "@/components/questions/QuestionForm";
import { createQuestion } from "@/actions/question.actions";

vi.mock("@/actions/question.actions", () => ({
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
}));
vi.mock("@/actions/tag.actions", () => ({ createTag: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

it("submits a new question with the unchanged Chinese default answer", async () => {
  vi.mocked(createQuestion).mockResolvedValue({ success: true, message: "题目已创建" } as any);
  const onQuestionSaved = vi.fn();
  const setDialogOpen = vi.fn();
  const user = userEvent.setup();

  render(
    <QuestionForm
      availableTags={[]}
      resetEditQuestion={vi.fn()}
      onQuestionSaved={onQuestionSaved}
      dialogOpen
      setDialogOpen={setDialogOpen}
    />,
  );

  expect(screen.getByText("答案 *")).toBeInTheDocument();
  await user.type(screen.getByPlaceholderText("输入面试题目"), "请介绍你负责过的项目");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(screen.queryByText("答案至少需要 10 个字符。")).not.toBeInTheDocument());

  await waitFor(() => expect(createQuestion).toHaveBeenCalledWith({
    question: "请介绍你负责过的项目",
    answer: "待填写",
    tagIds: [],
  }));
  expect(onQuestionSaved).toHaveBeenCalledOnce();
  expect(setDialogOpen).toHaveBeenCalledWith(false);
});
