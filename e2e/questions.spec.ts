import { type Page } from "@playwright/test";
import { test, expect, uniqueName, type CleanupRegistry } from "./fixtures";

async function navigateToQuestions(page: Page) {
  await page.goto("/dashboard/questions");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "新建题目" })
    .waitFor({ state: "visible" });
}

async function createQuestion(
  page: Page,
  questionText: string,
  answerText: string,
  cleanup: CleanupRegistry,
  options?: { tag?: string },
) {
  await page.getByRole("button", { name: "新建题目" }).click();
  await expect(page.getByTestId("question-form-dialog-title")).toBeVisible();
  await page.getByPlaceholder("输入面试题目").fill(questionText);

  if (options?.tag) {
    await page
      .getByRole("combobox", { name: "搜索或添加技能…" })
      .click();
    await page.getByPlaceholder("输入技能…").fill(options.tag);
    await page.getByText(`创建“${options.tag}”`).click();
    // Wait for the create server action to resolve and the field to update
    // (the badge only renders once the tag id lands in form state).
    await expect(page.getByText(options.tag, { exact: true })).toBeVisible();
    cleanup.tag(options.tag);
  }

  // Scope to the dialog: existing question cards render their answers
  // through a read-only TipTapContentViewer that also uses the ".tiptap"
  // class, so an unscoped locator matches those too.
  const answerEditor = page.getByRole("dialog").locator(".tiptap");
  await answerEditor.click();
  await answerEditor.fill(answerText);

  await page.getByRole("button", { name: "保存" }).click();
  await expect(
    page.getByTestId("question-form-dialog-title"),
  ).not.toBeVisible({ timeout: 10000 });
  cleanup.question(questionText);
}

function questionCard(page: Page, questionText: string) {
  return page.getByTestId("question-card").filter({ hasText: questionText });
}

test.describe("Question Bank", () => {
  test("should create a new question", async ({ page, cleanup }) => {
    const questionText = uniqueName("E2E Test Question");
    await navigateToQuestions(page);
    await createQuestion(
      page,
      questionText,
      "This is a test answer for e2e coverage.",
      cleanup,
    );

    await expect(
      page.getByRole("heading", { name: questionText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should edit an existing question", async ({ page, cleanup }) => {
    const editQuestionText = uniqueName("E2E Edit Question");
    const updatedQuestionText = uniqueName("E2E Edit Question Updated");
    // Register the updated text too, since it's what the card becomes on success.
    cleanup.question(updatedQuestionText);
    await navigateToQuestions(page);
    await createQuestion(
      page,
      editQuestionText,
      "Original answer text for editing.",
      cleanup,
    );
    await expect(
      page.getByRole("heading", { name: editQuestionText }),
    ).toBeVisible({ timeout: 10000 });

    await questionCard(page, editQuestionText)
      .getByTestId("question-edit-btn")
      .click();
    await expect(page.getByTestId("question-form-dialog-title")).toBeVisible();
    await expect(
      page.getByPlaceholder("输入面试题目"),
    ).toHaveValue(editQuestionText);

    const questionInput = page.getByPlaceholder("输入面试题目");
    await questionInput.fill(updatedQuestionText);

    await page.getByRole("button", { name: "保存" }).click();
    await expect(
      page.getByTestId("question-form-dialog-title"),
    ).not.toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("heading", { name: updatedQuestionText }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should delete a question", async ({ page, cleanup }) => {
    const deleteQuestionText = uniqueName("E2E Delete Question");
    await navigateToQuestions(page);
    await createQuestion(
      page,
      deleteQuestionText,
      "Answer text for a question we will delete.",
      cleanup,
    );
    await expect(
      page.getByRole("heading", { name: deleteQuestionText }),
    ).toBeVisible({ timeout: 10000 });

    await questionCard(page, deleteQuestionText)
      .getByTestId("question-delete-btn")
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "删除" })
      .click();

    await expect(
      page.getByRole("heading", { name: deleteQuestionText }),
    ).not.toBeVisible();
  });

  test("should add and persist a skill tag on a question", async ({
    page,
    cleanup,
  }) => {
    const questionText = uniqueName("E2E Tag Question");
    const tagText = uniqueName("skill tag");
    await navigateToQuestions(page);
    await createQuestion(
      page,
      questionText,
      "Answer text for the tagged question.",
      cleanup,
      { tag: tagText },
    );

    const card = questionCard(page, questionText);
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText(tagText, { exact: true })).toBeVisible();

    await card.getByTestId("question-edit-btn").click();
    await expect(page.getByTestId("question-form-dialog-title")).toBeVisible();
    // Scope to the dialog: the sidebar's tag filter button also renders the
    // same tag label now that the question has been saved with it.
    await expect(
      page.getByRole("dialog").getByText(tagText, { exact: true }),
    ).toBeVisible();
  });

  test("should filter questions by tag", async ({ page, cleanup }) => {
    const taggedQuestionText = uniqueName("E2E Filter Tagged Question");
    const untaggedQuestionText = uniqueName("E2E Filter Untagged Question");
    const tagText = uniqueName("filter tag");
    await navigateToQuestions(page);
    await createQuestion(
      page,
      taggedQuestionText,
      "Answer text for the filter-tagged question.",
      cleanup,
      { tag: tagText },
    );
    await createQuestion(
      page,
      untaggedQuestionText,
      "Answer text for the filter-untagged question.",
      cleanup,
    );
    await expect(
      page.getByRole("heading", { name: taggedQuestionText }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: untaggedQuestionText }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: tagText }).click();

    await expect(
      page.getByRole("heading", { name: taggedQuestionText }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: untaggedQuestionText }),
    ).not.toBeVisible();

    await page.getByRole("button", { name: "全部" }).click();
    await expect(
      page.getByRole("heading", { name: untaggedQuestionText }),
    ).toBeVisible();
  });

  test("should search questions", async ({ page, cleanup }) => {
    const searchableQuestionText = uniqueName("E2E Searchable Question");
    await navigateToQuestions(page);
    await createQuestion(
      page,
      searchableQuestionText,
      "Answer text for the searchable question.",
      cleanup,
    );
    await expect(
      page.getByRole("heading", { name: searchableQuestionText }),
    ).toBeVisible({ timeout: 10000 });

    await page
      .getByPlaceholder("搜索题目…")
      .fill(uniqueName("no match"));
    await expect(
      page.getByRole("heading", { name: searchableQuestionText }),
    ).not.toBeVisible();

    await page.getByPlaceholder("搜索题目…").fill(searchableQuestionText);
    await expect(
      page.getByRole("heading", { name: searchableQuestionText }),
    ).toBeVisible();
  });
});
