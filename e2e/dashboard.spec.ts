import { type Page } from "@playwright/test";
import {
  test,
  expect,
  createNewJob,
  selectOrCreate,
  uniqueName,
  type CleanupRegistry,
} from "./fixtures";

async function navigateToDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "把每一次探索，变成下一步成长", exact: true }),
  ).toBeVisible();
}

// The running activity is a per-user singleton and specs run in parallel
// against one shared user, so a concurrently running spec can interleave a
// switch-confirm around our stop click. Retry the whole click/confirm
// handshake until the Stop button actually disappears.
async function stopRunningActivity(page: Page) {
  const stopButton = page.getByRole("button", {
    name: "结束活动",
    exact: true,
  });
  const confirmSwitchBtn = page.getByRole("button", { name: "结束并开始" });
  await expect(async () => {
    if (await stopButton.isVisible().catch(() => false)) {
      await stopButton.click({ force: true });
    }
    if (await confirmSwitchBtn.isVisible().catch(() => false)) {
      await confirmSwitchBtn.click({ force: true });
    }
    await expect(stopButton).not.toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 10000 });
}

async function navigateToTasks(page: Page) {
  await page.goto("/dashboard/tasks");
  await page.getByTestId("add-task-btn").waitFor({ state: "visible" });
}

async function createTaskWithActivityType(
  page: Page,
  title: string,
  activityType: string,
  cleanup: CleanupRegistry,
) {
  await page.getByTestId("add-task-btn").click({ force: true });
  await expect(page.getByTestId("task-form-dialog-title")).toBeVisible();
  const titleInput = page.getByPlaceholder("输入任务标题");
  await titleInput.waitFor({ state: "visible" });
  await titleInput.fill(title);
  await titleInput.blur();

  await page.getByText("选择活动类型").click({ force: true });
  await page
    .getByPlaceholder("创建或搜索活动类型")
    .fill(activityType);
  const createOption = page.getByText(`创建： ${activityType}`);
  const existingOption = page.getByRole("option", {
    name: activityType,
    exact: true,
  });
  await expect(createOption.or(existingOption).first()).toBeVisible();
  if (await existingOption.isVisible()) {
    await existingOption.click({ force: true });
  } else {
    await createOption.click({ force: true });
  }
  await expect(
    page.getByPlaceholder("创建或搜索活动类型"),
  ).not.toBeVisible({ timeout: 15000 });
  cleanup.activityType(activityType);

  const saveBtn = page.getByTestId("save-task-btn");
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.getByTestId("task-form-dialog-title")).not.toBeVisible({
    timeout: 10000,
  });
  cleanup.task(title);
}

// The New Activity dialog pre-fills valid start/end times (now .. now+5m),
// so this creates a completed activity that lands directly in the recent
// activities list without waiting on ACTIVITY_MIN_DURATION_MINUTES.
async function createCompletedActivity(
  page: Page,
  activityName: string,
  activityType: string,
  cleanup: CleanupRegistry,
) {
  await page.goto("/dashboard/activities");
  await page.getByTestId("add-activity-btn").waitFor({ state: "visible" });
  await page.getByTestId("add-activity-btn").click();
  await expect(page.getByText("添加活动")).toBeVisible();

  await page
    .getByPlaceholder("例如：找工作、学习技能等")
    .fill(activityName);
  await selectOrCreate(
    page,
    "活动类型",
    "创建或搜索活动类型",
    activityType,
  );
  cleanup.activityType(activityType);

  await page.getByTestId("save-activity-btn").click();
  await expect(page.getByText("添加活动")).not.toBeVisible({
    timeout: 10000,
  });
  cleanup.activity(activityName);
}

test.describe("Dashboard page", () => {
  test("should display all dashboard sections and reflect a newly applied job", async ({
    page,
    cleanup,
  }) => {
    const jobText = uniqueName("dashboard applied job");
    await createNewJob(page, jobText, cleanup, {
      beforeSave: async (page) => {
        await page.getByLabel("选择职位状态").click();
        await page.getByRole("option", { name: "已投递", exact: true }).click();
      },
    });
    await expect(page.getByRole("row", { name: jobText }).first()).toBeVisible();

    await navigateToDashboard(page);

    await expect(
      page.getByRole("button", { name: "添加职位", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "添加待办", exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "职位与活动", exact: true }),
    ).toBeVisible();
    // The merged donut's center reports the applied-job count for the active
    // period. The job created above is applied today, so the default 7d tab
    // must show at least one. Specs share a user, so don't assert an exact
    // count. Match the count's own span: the center stacks hours, jobs and
    // trend with no separators, so asserting on the container would match
    // against a concatenation like "17h8 jobs14%".
    await expect(
      page
        .getByTestId("jobs-activity-total")
        .getByText(/^[1-9]\d* 个职位$/),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "最近 职位", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: jobText })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "本周 职位", exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "活动日历", exact: true }),
    ).toBeVisible();
    const currentYear = new Date().getFullYear().toString();
    await page.getByLabel("选择年份").click();
    await expect(
      page.getByRole("option", { name: currentYear, exact: true }),
    ).toBeVisible();
  });

  test("should navigate to create a new job, task, question, and automation from dashboard quick actions", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "添加职位", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/myjobs/);
    await expect(page.getByTestId("add-job-dialog-title")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByTestId("add-job-dialog-title")).not.toBeVisible();

    await navigateToDashboard(page);
    await page.getByRole("button", { name: "添加待办", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.getByTestId("task-form-dialog-title")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByTestId("task-form-dialog-title")).not.toBeVisible();

    await navigateToDashboard(page);
    await page
      .getByRole("button", { name: "添加题目", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/questions/);
    await expect(page.getByTestId("question-form-dialog-title")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(
      page.getByTestId("question-form-dialog-title"),
    ).not.toBeVisible();

    await navigateToDashboard(page);
    await page
      .getByRole("button", { name: "添加自动任务", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/automations/);
    const wizard = page.getByRole("dialog");
    await expect(wizard.getByText("步骤 1 / 6")).toBeVisible();
    await wizard.getByRole("button", { name: "关闭" }).click();
    await expect(wizard).not.toBeVisible();
  });

  test("should toggle the recent, weekly, jobs and activities cards", async ({
    page,
  }) => {
    const jobsActivityToggle = page.getByTestId("jobs-activity-toggle-group");
    await jobsActivityToggle.getByRole("button", { name: "30d" }).click();
    await expect(
      jobsActivityToggle.getByRole("button", { name: "30d" }),
    ).toHaveClass(/bg-primary/);

    const recentToggle = page.getByTestId("recent-card-toggle-group");
    await recentToggle.getByRole("button", { name: "活动" }).click();
    await expect(
      page.getByRole("heading", { name: "最近 活动", exact: true }),
    ).toBeVisible();

    const weeklyToggle = page.getByTestId("weekly-chart-toggle-group");
    await weeklyToggle.getByRole("button", { name: "活动" }).click();
    await expect(
      page.getByRole("heading", { name: "本周 活动", exact: true }),
    ).toBeVisible();
  });

  test("should discard a very short activity and not show it in the dashboard's recent activities list", async ({
    page,
    cleanup,
  }) => {
    // Activities below ACTIVITY_MIN_DURATION_MINUTES are discarded on stop
    // (src/context/ActivityContext.tsx), so a start immediately followed by
    // a stop is deleted server-side rather than saved.
    const taskTitle = uniqueName("E2E Dashboard Activity Task");
    const activityType = uniqueName("E2E Dashboard Activity Type");
    await navigateToTasks(page);
    await createTaskWithActivityType(page, taskTitle, activityType, cleanup);
    const taskRow = page
      .getByRole("row", { name: new RegExp(taskTitle, "i") })
      .first();
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    await taskRow.hover();
    await taskRow.getByTestId("task-start-activity-btn").click({ force: true });
    // If another activity was already running (e.g. from a concurrently
    // running spec), confirm the switch instead of hanging on the dialog.
    const confirmSwitchBtn = page.getByRole("button", { name: "结束并开始" });
    try {
      await confirmSwitchBtn.waitFor({ state: "visible", timeout: 3000 });
      await confirmSwitchBtn.click();
    } catch {
      // No conflicting activity, continue.
    }
    await expect(
      page.getByRole("button", { name: "结束活动", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    await stopRunningActivity(page);

    await navigateToDashboard(page);
    await page
      .getByTestId("recent-card-toggle-group")
      .getByRole("button", { name: "活动" })
      .click();
    await expect(page.getByText(taskTitle, { exact: true })).not.toBeVisible();
  });

  test("should start an activity from the dashboard's recent activities list", async ({
    page,
    cleanup,
  }) => {
    const activityName = uniqueName("E2E Recent Activity");
    const activityType = uniqueName("E2E Recent Activity Type");
    await createCompletedActivity(page, activityName, activityType, cleanup);

    await navigateToDashboard(page);
    await page
      .getByTestId("recent-card-toggle-group")
      .getByRole("button", { name: "活动" })
      .click();

    const activityRow = page
      .getByTestId("recent-activity-row")
      .filter({ hasText: activityName });
    await expect(activityRow).toBeVisible({ timeout: 10000 });

    // The play button is hover-revealed (opacity-0 -> opacity-100 on
    // group-hover), so hover the row before clicking it.
    await activityRow.hover();
    await activityRow
      .getByTestId("recent-activity-start-btn")
      .click({ force: true });

    // If another activity was already running (e.g. from a concurrently
    // running spec), confirm the switch instead of hanging on the dialog.
    const confirmSwitchBtn = page.getByRole("button", { name: "结束并开始" });
    try {
      await confirmSwitchBtn.waitFor({ state: "visible", timeout: 3000 });
      await confirmSwitchBtn.click();
    } catch {
      // No conflicting activity, continue.
    }

    await expect(
      page.getByRole("button", { name: "结束活动", exact: true }),
    ).toBeVisible({ timeout: 10000 });

    await stopRunningActivity(page);
  });
});
