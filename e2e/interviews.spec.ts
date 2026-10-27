import { test, expect, createNewJob, uniqueName } from "./fixtures";

test("an interview stage added on a job appears on the Interviews page", async ({
  page,
  cleanup,
}) => {
  const jobTitle = uniqueName("Interview Engineer");
  const jobId = await createNewJob(page, jobTitle, cleanup);

  // The round is created where rounds are created: the job's Timeline tab.
  await page.goto(`/dashboard/myjobs/${jobId}?tab=timeline`);
  await page.getByTestId("timeline-add-stage-btn").click();
  await page.getByTestId("stage-type-select").click();
  const search = page.getByPlaceholder("搜索阶段");
  await search.fill("终面 / 现场面试");
  await page
    .getByRole("option", { name: "终面 / 现场面试", exact: true })
    .click();
  await expect(search).not.toBeVisible();
  await page.getByRole("button", { name: "添加阶段", exact: true }).click();
  await expect(page.getByRole("tab", { name: /进展记录/ })).toContainText("2");

  await page.goto("/dashboard/interviews");

  const row = page.getByRole("row", { name: new RegExp(jobTitle) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("终面 / 现场面试");

  // Expanding shows the prep-question panel for the round.
  await page
    .getByRole("button", { name: new RegExp(`展开 ${jobTitle}`) })
    .click();
  await expect(page.getByText(/准备题目/)).toBeVisible();

  // The round menu records an outcome, and the badge follows.
  await row.getByRole("button", { name: /打开(?:操作)?菜单/ }).click();
  await page.getByRole("menuitem", { name: "设置结果" }).click();
  await page.getByRole("menuitem", { name: "已通过", exact: true }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(jobTitle) }),
  ).toContainText("已通过");
});
