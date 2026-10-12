import { test, expect, createNewJob, uniqueName } from "./fixtures";
import type { Page } from "@playwright/test";

// Opens the Add Stage dialog and picks a seeded type. The picker is a
// non-creatable ComboBox: filter first, then match the label exactly —
// "Offer" would otherwise also hit "Offer Accepted".
async function openStageDialogWith(page: Page, stageLabel: string) {
  await page.getByTestId("timeline-add-stage-btn").click();
  await page.getByTestId("stage-type-select").click();
  const search = page.getByPlaceholder("搜索阶段");
  await search.fill(stageLabel);
  await page.getByRole("option", { name: stageLabel, exact: true }).click();
  await expect(search).not.toBeVisible();
}

test("adding an Offer stage moves the job's status on the Jobs list", async ({
  page,
  cleanup,
}) => {
  const jobTitle = uniqueName("Timeline Engineer");
  const jobId = await createNewJob(page, jobTitle, cleanup);

  await page.goto(`/dashboard/myjobs/${jobId}?tab=timeline`);
  await openStageDialogWith(page, "录用通知");

  await expect(
    page.getByRole("checkbox", { name: /设为当前阶段/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "添加阶段", exact: true }).click();

  // The Stage History list reflects it without a reload.
  await expect(page.getByRole("button", { name: /^录用通知/ }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: /进展记录/ })).toContainText("2");

  // ...and the derived status reached the Jobs list.
  await page.goto("/dashboard/myjobs");
  const row = page.getByRole("row", { name: jobTitle }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("录用通知");
});

test("linking an interviewer to a stage puts them on the job's Contacts tab", async ({
  page,
  cleanup,
}) => {
  const jobTitle = uniqueName("Timeline Interview");
  const contactName = uniqueName("Priya Tester");
  const jobId = await createNewJob(page, jobTitle, cleanup);

  await page.goto(`/dashboard/myjobs/${jobId}?tab=timeline`);

  // An interview stage first: the stage-scoped menu items gate on stage kind.
  await openStageDialogWith(page, "终面 / 现场面试");
  await page.getByRole("button", { name: "添加阶段", exact: true }).click();

  // Adding a stage does not move the selection, and the menu targets the
  // selected stage — so pick the new one before opening it.
  await page
    .getByRole("button", { name: /^终面 \/ 现场面试/ })
    .first()
    .click();

  await page.getByTestId("update-status-menu-btn").click();
  await page.getByRole("menuitem", { name: "添加面试官" }).click();

  await page.getByPlaceholder("姓名").fill(contactName);
  cleanup.contact(contactName);
  await page.getByRole("button", { name: "添加联系人" }).click();
  await expect(
    page.getByLabel(new RegExp(`${contactName}已关联`)),
  ).toBeVisible();
  await page.getByRole("button", { name: /^完成/ }).click();

  // The job's Contacts tab is the single roster of everyone involved. Loaded
  // fresh: JobContactsTab seeds its rows from the server prop on mount.
  await page.goto(`/dashboard/myjobs/${jobId}?tab=contacts`);
  await expect(page.getByText(contactName)).toBeVisible();
  await expect(page.getByText("面试官")).toBeVisible();
});
