import { type Page } from "@playwright/test";
import {
  test,
  expect,
  selectOrCreate,
  uniqueName,
  type CleanupRegistry,
} from "./fixtures";

async function createResume(
  page: Page,
  title: string,
  cleanup: CleanupRegistry,
) {
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByRole("menuitem", { name: "新建简历" }).click();
  await page.getByPlaceholder("例如：全栈开发工程师").fill(title);
  await page.getByRole("button", { name: "保存" }).click();
  cleanup.resume(title);
}

test.describe("Profile page", () => {
  test("should create a new resume", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    // Reload-after-create/delete is a client fetch; under parallel e2e load
    // the dev server can take longer than the default 10s to reflect it.
    await expect(page.locator("tbody")).toContainText(resumeTitle, {
      timeout: 20000,
    });
    await deleteResume(page, resumeTitle);
    // Assert on the persistent outcome (row removed) rather than the toast,
    // which auto-dismisses after 5s and can vanish before the poll under load.
    await expect(page.getByRole("row", { name: new RegExp(resumeTitle) })).toHaveCount(0, {
      timeout: 20000,
    });
  });

  test("should edit the resume title", async ({ page, baseURL, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const editedTitle = uniqueName("Test Resume edited");
    // Register the edited title too, since it's what the row becomes on success.
    cleanup.resume(editedTitle);
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await expect(page).toHaveURL(baseURL + "/dashboard/profile");
    await createResume(page, resumeTitle, cleanup);

    const cells = page.getByText(new RegExp(resumeTitle, "i"));
    await expect(cells.first()).toBeVisible();
    await page
      .getByRole("row", { name: resumeTitle })
      .getByTestId("document-actions-menu-btn")
      .first()
      .click();
    await page.getByRole("menuitem", { name: /编辑简历标题/ }).click();
    await page.getByPlaceholder("例如：全栈开发工程师").fill(editedTitle);
    await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await expect(page.locator("tbody")).toContainText(editedTitle);
  });

  test("should add resume contact info", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addContactInfo(page, resumeTitle, "John", "Doe");
    // Same reload-under-load headroom as the create/delete assertions above.
    await expect(
      page.getByRole("heading", { name: "John Doe" }),
    ).toBeVisible({ timeout: 20000 });
  });

  test("should edit resume contact info", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addContactInfo(page, resumeTitle, "John", "Doe");
    await expect(
      page.getByRole("heading", { name: "John Doe" }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "编辑" }).click();
    await expect(
      page.getByRole("heading", { name: "编辑联系方式" }),
    ).toBeVisible();
    await page.getByLabel("名", { exact: true }).fill("Jane");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("heading", { name: "Jane Doe" })).toBeVisible();
  });

  test("should add resume summary section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addSummary(page, resumeTitle, "this is test summary");
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect(page.getByText("this is test summary")).toBeVisible();
  });

  test("should edit resume summary section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addSummary(page, resumeTitle, "this is test summary");
    await expect(page.getByText("this is test summary")).toBeVisible();
    await page.getByRole("button", { name: "编辑" }).click();
    await expect(
      page.getByRole("heading", { name: "编辑个人简介" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .locator(".tiptap")
      .fill("this is updated summary\n");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("this is updated summary")).toBeVisible();
    await expect(page.getByText("this is test summary")).not.toBeVisible();
  });

  test("should add resume work experience section", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Test Resume");
    const jobText = uniqueName("Software Developer");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addExperience(page, resumeTitle, jobText, cleanup);
    await expect(
      page.getByRole("heading", { name: jobText }).first(),
    ).toBeVisible();
  });

  test("should add resume work experience after clicking Edit Experience section", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Test Resume");
    const jobText = uniqueName("Software Developer");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addExperience(page, resumeTitle, jobText, cleanup);
    await expect(
      page.getByRole("heading", { name: jobText }).first(),
    ).toBeVisible();
    await page
      .getByText(jobText + "编辑")
      .getByRole("button", { name: "编辑" })
      .click();
    await expect(
      page.getByRole("heading", { name: "编辑工作经历" }),
    ).toBeVisible();
    await page.getByText("取消").click();
    await page.getByRole("button", { name: "添加模块" }).click();
    await page.getByRole("menuitem", { name: "添加工作经历" }).click();
    await expect(
      page.getByRole("heading", { name: "添加工作经历" }),
    ).toBeVisible();
    await page.getByText("取消").click();
  });

  test("should add resume education section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const schoolText = uniqueName("test school");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addEducation(page, resumeTitle, schoolText, cleanup);
    await expect(
      page.getByRole("heading", { name: schoolText }).first(),
    ).toBeVisible();
  });

  test("should edit resume education section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const schoolText = uniqueName("test school");
    const editedSchoolText = uniqueName("edited school");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addEducation(page, resumeTitle, schoolText, cleanup);
    await expect(
      page.getByRole("heading", { name: schoolText }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "编辑" }).click();
    await expect(
      page.getByRole("heading", { name: "编辑教育经历" }),
    ).toBeVisible();
    await page.getByPlaceholder("例如：斯坦福大学").fill(editedSchoolText);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(
      page.getByRole("heading", { name: editedSchoolText }).first(),
    ).toBeVisible();
  });

  test("should add resume skills section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const skillText = uniqueName("Skill Test");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addSkill(page, resumeTitle, skillText, cleanup);
    await expect(
      page.getByRole("heading", { name: "核心技能" }),
    ).toBeVisible();
    await expect(page.getByText(skillText, { exact: true })).toBeVisible();
  });

  test("should delete resume skills section", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const skillText = uniqueName("Skill Test");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addSkill(page, resumeTitle, skillText, cleanup);
    await expect(page.getByText(skillText, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "删除" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "删除技能模块？",
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "删除" })
      .click();
    await expect(page.getByText(skillText, { exact: true })).not.toBeVisible();
  });

  test("should add resume certification section", async ({
    page,
    cleanup,
  }) => {
    const resumeTitle = uniqueName("Test Resume");
    const certTitle = uniqueName("AWS Certified Solutions Architect");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addCertification(page, resumeTitle, certTitle, cleanup);
    await expect(
      page.getByRole("heading", { name: certTitle }).first(),
    ).toBeVisible();
    await expect(page.getByText("Amazon Web Services")).toBeVisible();
  });

  test("should edit resume certification", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const certTitle = uniqueName("AWS Certified Solutions Architect");
    const editedOrg = uniqueName("Edited Org");
    await page.getByRole("link", { name: "简历中心", exact: true }).click();
    await createResume(page, resumeTitle, cleanup);
    await addCertification(page, resumeTitle, certTitle, cleanup);
    await expect(
      page.getByRole("heading", { name: certTitle }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "编辑" }).click();
    await expect(
      page.getByRole("heading", { name: "编辑证书或执照" }),
    ).toBeVisible();
    await page.getByLabel("颁发机构").fill(editedOrg);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(editedOrg)).toBeVisible();
  });
});

async function addContactInfo(
  page: Page,
  resumeTitle: string,
  firstName: string,
  lastName: string,
) {
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加联系方式" }).click();
  await page.getByLabel("名", { exact: true }).waitFor({ state: "visible" });
  await page.getByLabel("名", { exact: true }).click();
  await page.getByLabel("名", { exact: true }).fill(firstName);
  await page.getByLabel("姓").click();
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("个人简介标题").click();
  await page
    .getByLabel("个人简介标题")
    .fill("Skill developer with testing skills");
  await page.getByLabel("邮箱").click();
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("电话").click();
  await page.getByLabel("电话").fill("123456789");
  await page.getByLabel("地址").click();
  await page.getByLabel("地址").fill("Calgary");
  await page.getByRole("button", { name: "保存" }).click();
}

async function addSummary(page: Page, resumeTitle: string, summaryText: string) {
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: resumeTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加个人简介" }).click();
  await page.getByLabel("模块标题").fill("Summary");
  await page.locator(".tiptap").click();
  await page.locator(".tiptap").fill(summaryText + "\n");
  await page.getByRole("button", { name: "保存" }).click();
}

async function addEducation(
  page: Page,
  resumeTitle: string,
  schoolText: string,
  cleanup: CleanupRegistry,
) {
  const locationText = uniqueName("location test");
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click({ force: true });
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: resumeTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加教育经历" }).click();
  // Wait for the dialog to open
  await page.waitForTimeout(500);
  // Only fill section title if it's visible (when creating new section)
  const sectionTitleField = page.getByPlaceholder("例如：教育经历");
  if (await sectionTitleField.isVisible()) {
    await sectionTitleField.fill("Education");
  }
  await page.getByPlaceholder("例如：斯坦福大学").click();
  await page.getByPlaceholder("例如：斯坦福大学").fill(schoolText);
  await selectOrCreate(
    page,
    "地点",
    "创建或搜索地点",
    locationText,
  );
  cleanup.location(locationText);
  await page.getByPlaceholder("例如：学士").click();
  await page.getByPlaceholder("例如：学士").fill("degree text");
  await page.getByPlaceholder("例如：计算机科学").click();
  await page.getByPlaceholder("例如：计算机科学").fill("computer science");
  await page.getByLabel("开始日期").click();
  // Wait for calendar popover to open
  await page.waitForTimeout(1000);
  // Click on any available date in the calendar
  const startDateCell = page.getByRole("gridcell", { name: "15" }).first();
  await startDateCell.waitFor({ state: "visible", timeout: 5000 });
  await startDateCell.click();
  await page.getByLabel("结束日期").click();
  // Wait for calendar popover to open
  await page.waitForTimeout(1000);
  // Click on any available date in the calendar
  const endDateCell = page.getByRole("gridcell", { name: "20" }).first();
  await endDateCell.waitFor({ state: "visible", timeout: 5000 });
  await endDateCell.click();
  await page.locator("div:nth-child(2) > .tiptap").click();
  await page.locator("div:nth-child(2) > .tiptap").fill("test description");
  await page.getByRole("button", { name: "保存" }).click();
}

async function addExperience(
  page: Page,
  resumeTitle: string,
  jobText: string,
  cleanup: CleanupRegistry,
) {
  const companyText = uniqueName("company test");
  const locationText = uniqueName("location test");
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: resumeTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加工作经历" }).click();
  // Wait for the dialog to open
  await page.waitForTimeout(500);
  // Only fill section title if it's visible (when creating new section)
  const sectionTitleField = page.getByPlaceholder("例如：工作经历");
  if (await sectionTitleField.isVisible()) {
    await sectionTitleField.fill("Experience");
    await sectionTitleField.press("Tab");
  }
  await selectOrCreate(page, "职位名称", "创建或搜索职位", jobText);
  cleanup.title(jobText);
  await selectOrCreate(page, "公司", "创建或搜索公司", companyText);
  cleanup.company(companyText);
  await selectOrCreate(
    page,
    "工作地点",
    "创建或搜索地点",
    locationText,
  );
  cleanup.location(locationText);
  await page.getByLabel("开始日期").click();
  // Wait for calendar popover to open
  await page.waitForTimeout(1000);
  // Click on any available date in the calendar
  const dateCell = page.getByRole("gridcell", { name: "15" }).first();
  await dateCell.waitFor({ state: "visible", timeout: 5000 });
  await dateCell.click();
  await page.locator("div:nth-child(2) > .tiptap").click();
  await page.locator("div:nth-child(2) > .tiptap").fill("test description");
  await page.getByRole("button", { name: "保存" }).click();
}

async function addSkill(
  page: Page,
  resumeTitle: string,
  skillText: string,
  cleanup: CleanupRegistry,
) {
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: resumeTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page.getByRole("menuitem", { name: "添加技能" }).click();
  await page.getByRole("combobox", { name: "搜索或添加技能…" }).click();
  await page.getByPlaceholder("输入技能…").fill(skillText);
  await page.getByText(`创建“${skillText}”`).click();
  cleanup.tag(skillText);
  await expect(page.getByText(skillText, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存" }).click();
}

async function addCertification(
  page: Page,
  resumeTitle: string,
  certTitle: string,
  cleanup: CleanupRegistry,
) {
  await page
    .getByRole("row", { name: new RegExp(resumeTitle, "i") })
    .first()
    .getByTestId("document-actions-menu-btn")
    .click();
  await page.getByRole("link", { name: "查看或编辑简历" }).click();
  await expect(page.getByRole("heading", { name: resumeTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加模块" }).click();
  await page
    .getByRole("menuitem", { name: "添加证书或执照" })
    .click();
  // Wait for the dialog to open
  await page.waitForTimeout(500);
  // Only fill section title if it's visible (when creating new section)
  const sectionTitleField = page.getByPlaceholder("例如：证书与资质");
  if (await sectionTitleField.isVisible()) {
    await sectionTitleField.fill("Certifications");
  }
  await page.getByLabel("证书或执照名称").fill(certTitle);
  await page.getByLabel("颁发机构").fill("Amazon Web Services");
  await page.getByLabel("颁发日期").click();
  // Wait for calendar popover to open
  await page.waitForTimeout(1000);
  const issueDateCell = page.getByRole("gridcell", { name: "10" }).first();
  await issueDateCell.waitFor({ state: "visible", timeout: 5000 });
  await issueDateCell.click();
  await page.getByRole("button", { name: "保存" }).click();
}

async function deleteResume(page: Page, title: string) {
  await page.getByRole("link", { name: "简历中心", exact: true }).click();
  await page.waitForLoadState("networkidle");
  const row = page.getByRole("row", { name: new RegExp(title, "i") }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  await row.getByTestId("document-actions-menu-btn").click({ force: true });
  await page.getByRole("menuitem", { name: "删除" }).click({ force: true });
  await expect(page.getByRole("alertdialog")).toContainText(
    "确定删除此简历吗？",
  );
  await page.getByRole("button", { name: "删除" }).click({ force: true });
}
