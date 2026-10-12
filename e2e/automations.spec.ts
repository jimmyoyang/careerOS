import { type Page, type Locator } from "@playwright/test";
import { test, expect, uniqueName, type CleanupRegistry } from "./fixtures";

// The wizard's resume dropdown only lists resumes with at least
// MIN_RESUME_SECTIONS_FOR_SELECTION (2) sections, so every automation needs a
// resume with two sections. Summary + Certification are the two lightest
// section types (plain text fields, no comboboxes/tags), so they add no extra
// Library rows to clean up.
async function createResumeForMatching(
  page: Page,
  title: string,
  cleanup: CleanupRegistry,
) {
  await page.goto("/dashboard/profile");
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByRole("menuitem", { name: "新建简历" }).click();
  await page.getByPlaceholder("例如：全栈开发工程师").fill(title);
  await page.getByRole("button", { name: "保存" }).click();
  cleanup.resume(title);

  const row = page.getByRole("row", { name: new RegExp(title, "i") }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.getByTestId("document-actions-menu-btn").click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: "简历" })).toBeVisible();

  // Section 1: Summary
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加个人简介" }).click();
  await page.getByLabel("模块标题").fill("Summary");
  await page.locator(".tiptap").click();
  await page.locator(".tiptap").fill("Experienced full stack engineer.\n");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存" })
    .click();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible({
    timeout: 20000,
  });

  // Section 2: Certification
  await page.getByRole("button", { name: "添加模块" }).click();
  await page
    .getByRole("menuitem", { name: "添加证书或执照" })
    .click();
  await page
    .getByPlaceholder("例如：AWS Certified Solutions Architect")
    .fill("AWS Solutions Architect");
  await page
    .getByPlaceholder("例如：Amazon Web Services")
    .fill("Amazon Web Services");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存" })
    .click();
  await expect(page.getByText("AWS Solutions Architect")).toBeVisible({
    timeout: 20000,
  });
}

// Opens the Schedule step's time picker and selects the given hour. Matches the
// option by an anchored label so it works whether or not the hour carries the
// "In use" suffix.
async function selectScheduleHour(page: Page, dialog: Locator, hour: number) {
  const label = `${String(hour).padStart(2, "0")}:00`;
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(`^${label}`) }).click();
}

// Walks the 6-step wizard for a Greenhouse automation. Company selection uses
// the seeded companies.json typeahead (a local filter, no network), picking the
// first browse result so it stays robust to seed changes. The schedule hour
// defaults to the worker's parallelIndex: every spec shares the admin user and
// only one automation may run per hour, so a worker-unique hour keeps parallel
// specs from colliding on that rule.
async function createGreenhouseAutomation(
  page: Page,
  name: string,
  resumeTitle: string,
  cleanup: CleanupRegistry,
  hour: number = test.info().parallelIndex,
) {
  await page.goto("/dashboard/automations");
  await page.getByRole("button", { name: "创建自动化" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("步骤 1 / 6")).toBeVisible();

  // Step 1: Basics (jobBoard defaults to greenhouse)
  await dialog
    .getByPlaceholder("例如：上海全栈工程师岗位")
    .fill(name);
  cleanup.automation(name);
  await dialog.getByRole("button", { name: "下一步" }).click();

  // Step 2: Search — pick the first seeded company
  await dialog.getByRole("button", { name: /搜索公司/ }).click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").first().click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "下一步" }).click();

  // Step 3: Resume
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: resumeTitle }).click();
  await dialog.getByRole("button", { name: "下一步" }).click();

  // Step 4: Matching (default threshold)
  await dialog.getByRole("button", { name: "下一步" }).click();

  // Step 5: Schedule — worker-unique hour (see fn doc)
  await selectScheduleHour(page, dialog, hour);
  await dialog.getByRole("button", { name: "下一步" }).click();

  // Step 6: Review -> submit
  await submitWizard(page, dialog, /创建自动化/, name);
}

// Submits the wizard's final step and waits for the row to appear. The footer's
// "Next" and submit buttons render at the same position, so React reuses one
// <button> DOM node and just morphs its `type` from "button" to "submit" — the
// last "Next" click's default action can therefore already submit the form. So
// only click submit if that auto-submit didn't fire, and gate on the outcome.
async function submitWizard(
  page: Page,
  dialog: Locator,
  submitName: RegExp,
  expectName: string,
) {
  const link = page.getByRole("link", { name: expectName });
  const submit = dialog.getByRole("button", { name: submitName });
  if (!(await link.isVisible().catch(() => false))) {
    if (await submit.isEnabled().catch(() => false)) {
      await submit.click().catch(() => {});
    }
  }
  await expect(link).toBeVisible({ timeout: 20000 });
}

// Scopes to a single automation row by its unique name. Both the row and the
// outer Card share the bg-card class, so anchor on the name link and take its
// nearest bg-card ancestor (the row) — whose only button is the actions menu.
function automationCard(page: Page, name: string) {
  return page
    .getByRole("link", { name })
    .locator("xpath=ancestor::div[contains(@class,'bg-card')][1]");
}

test.describe("Automations", () => {
  test("should create a Greenhouse automation and show it in the list", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const name = uniqueName("Greenhouse Automation");
    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, name, resumeTitle, cleanup);

    const card = automationCard(page, name);
    await expect(card.getByText("greenhouse", { exact: true })).toBeVisible();
    await expect(card.getByText("启用", { exact: true })).toBeVisible();
  });

  test("should block Next until required fields are filled", async ({
    page,
  }) => {
    // No resume/automation is persisted: the wizard is opened and closed
    // without submitting, so this test needs no cleanup.
    await page.goto("/dashboard/automations");
    await page.getByRole("button", { name: "创建自动化" }).click();
    const dialog = page.getByRole("dialog");
    const next = dialog.getByRole("button", { name: "下一步" });

    // Step 1: Next disabled until the automation has a name.
    await expect(next).toBeDisabled();
    await dialog
      .getByPlaceholder("例如：上海全栈工程师岗位")
      .fill(uniqueName("Draft"));
    await expect(next).toBeEnabled();
    await next.click();

    // Step 2: Next disabled until at least one company is selected.
    await expect(next).toBeDisabled();
    await dialog.getByRole("button", { name: /搜索公司/ }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.getByRole("option").first().click();
    await page.keyboard.press("Escape");
    await expect(next).toBeEnabled();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("should show automation details and tabs on the detail page", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const name = uniqueName("Detail Automation");
    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, name, resumeTitle, cleanup);

    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/dashboard\/automations\/[a-f0-9-]+/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("招聘平台")).toBeVisible();
    await expect(page.getByText("匹配阈值")).toBeVisible();
    await expect(page.getByRole("tab", { name: "日志" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /发现的岗位/ }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "运行记录" })).toBeVisible();

    // No run has executed, so the discovered-jobs tab shows the empty state.
    await page.getByRole("tab", { name: /发现的岗位/ }).click();
    await expect(
      page.getByRole("heading", { name: "暂无发现的岗位" }),
    ).toBeVisible();
  });

  test("should pause and resume from the list menu", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const name = uniqueName("Pausable Automation");
    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, name, resumeTitle, cleanup);

    const card = automationCard(page, name);
    await card.getByRole("button").click();
    await page.getByRole("menuitem", { name: "暂停" }).click();
    await expect(card.getByText("已暂停")).toBeVisible({ timeout: 20000 });

    await card.getByRole("button").click();
    await page.getByRole("menuitem", { name: "恢复" }).click();
    await expect(card.getByText("启用")).toBeVisible({ timeout: 20000 });
  });

  test("should delete an automation from the list menu", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const name = uniqueName("Deletable Automation");
    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, name, resumeTitle, cleanup);

    const card = automationCard(page, name);
    await card.getByRole("button").click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "确定删除此自动化？",
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "删除" })
      .click();
    await expect(page.getByRole("link", { name })).not.toBeVisible({
      timeout: 20000,
    });
  });

  test("should edit an automation's name", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const name = uniqueName("Editable Automation");
    const editedName = uniqueName("Edited Automation");
    // Register the edited name too, since it's what the row becomes on success.
    cleanup.automation(editedName);
    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, name, resumeTitle, cleanup);

    const card = automationCard(page, name);
    await card.getByRole("button").click();
    await page.getByRole("menuitem", { name: "编辑" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "编辑自动化" }),
    ).toBeVisible();
    await dialog
      .getByPlaceholder("例如：上海全栈工程师岗位")
      .fill(editedName);

    // Company and resume are already set from the original, so each step's Next
    // is enabled — step straight through to review.
    for (let i = 0; i < 5; i++) {
      await dialog.getByRole("button", { name: "下一步" }).click();
    }
    await submitWizard(page, dialog, /更新自动化/, editedName);
  });

  test("should mark in-use hours, block a duplicate schedule, and allow a free hour", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Automation Resume");
    const nameA = uniqueName("Schedule A");
    const nameB = uniqueName("Schedule B");
    // parallelIndex is 0..3 locally / 0 in CI. Base and +12 stay disjoint from
    // every other worker's base hour, so nothing else claims these two hours.
    const idx = test.info().parallelIndex;
    const hourA = idx;
    const hourB = idx + 12;
    const labelA = `${String(hourA).padStart(2, "0")}:00`;

    await createResumeForMatching(page, resumeTitle, cleanup);
    await createGreenhouseAutomation(page, nameA, resumeTitle, cleanup, hourA);

    // Open a second Create wizard and walk to the Schedule step.
    cleanup.automation(nameB);
    await page.getByRole("button", { name: "创建自动化" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByPlaceholder("例如：上海全栈工程师岗位")
      .fill(nameB);
    await dialog.getByRole("button", { name: "下一步" }).click();

    await dialog.getByRole("button", { name: /搜索公司/ }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.getByRole("option").first().click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "下一步" }).click();

    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: resumeTitle }).click();
    await dialog.getByRole("button", { name: "下一步" }).click();

    // Matching -> Schedule
    await dialog.getByRole("button", { name: "下一步" }).click();

    // hourA (taken by automation A) is flagged "In use" in the picker.
    await dialog.getByRole("combobox").click();
    await expect(
      page
        .getByRole("option")
        .filter({ hasText: labelA })
        .filter({ hasText: "In use" }),
    ).toBeVisible();

    // Picking the taken hour and clicking Next surfaces the clash error and
    // keeps the wizard on the Schedule step.
    await page.getByRole("option").filter({ hasText: labelA }).click();
    await dialog.getByRole("button", { name: "下一步" }).click();
    await expect(
      dialog.getByText(/已有其他自动化在/),
    ).toBeVisible();
    await expect(dialog.getByText("步骤 5 / 6")).toBeVisible();

    // Switching to a free hour clears the error and lets the wizard proceed.
    await selectScheduleHour(page, dialog, hourB);
    await expect(
      dialog.getByText(/已有其他自动化在/),
    ).not.toBeVisible();
    await dialog.getByRole("button", { name: "下一步" }).click();
    await expect(dialog.getByText("步骤 6 / 6")).toBeVisible();
    await submitWizard(page, dialog, /创建自动化/, nameB);
  });
});
