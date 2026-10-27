import { test, expect, uniqueName } from "./fixtures";

test.describe("data backup", () => {
  test("restores records and rolls back using a real snapshot", async ({ page }) => {
    test.skip(process.env.E2E_ISOLATED_ACCOUNTS !== "true", "完整恢复需要独立测试账号");
    const savedTitle = uniqueName("备份保留岗位");
    const laterTitle = uniqueName("备份之后的岗位");
    const importJob = async (title: string) => {
      await page.goto("/dashboard/career");
      await page.getByLabel("公司 *", { exact: true }).fill("备份验收公司");
      await page.getByLabel("岗位名称 *", { exact: true }).fill(title);
      await page.getByLabel("岗位描述原文 *", { exact: true }).fill("负责 TypeScript 开发与测试，要求熟悉数据库。");
      await page.getByRole("button", { name: "预览导入", exact: true }).click();
      await page.getByRole("button", { name: "确认导入岗位" }).click();
      await expect(page.getByRole("tab", { name: "岗位准备" })).toHaveAttribute("data-state", "active");
    };
    const openData = async () => {
      await page.goto("/dashboard/settings");
      await page.getByRole("button", { name: "数据", exact: true }).click();
    };
    const expectJobs = async (titles: string[]) => {
      await page.goto("/dashboard/myjobs");
      for (const title of titles) await expect(page.getByRole("row", { name: title })).toBeVisible();
    };
    await importJob(savedTitle);
    const backup = await page.request.get("/api/backup/export");
    expect(backup.status()).toBe(200);
    const bytes = await backup.body();
    await importJob(laterTitle);
    await openData();
    await page.getByLabel("备份文件", { exact: true }).setInputFiles({ name: "roundtrip.zip", mimeType: "application/zip", buffer: bytes });
    await page.getByRole("button", { name: "使用此备份替换我的数据" }).click();
    await page.getByRole("button", { name: "删除全部数据并导入", exact: true }).click();
    await expect(page.getByText("导入完成", { exact: true })).toBeVisible();
    await expectJobs([savedTitle]);
    await expect(page.getByRole("row", { name: laterTitle })).toHaveCount(0);
    await openData();
    await page.getByRole("button", { name: "恢复", exact: true }).first().click();
    await page.getByRole("button", { name: "回滚", exact: true }).click();
    await expect(page.getByText("回滚完成", { exact: true })).toBeVisible();
    await expectJobs([savedTitle, laterTitle]);
  });

  test("exports a non-empty zip", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "数据" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /下载备份/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^jobsync-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);
    expect(bytes.length).toBeGreaterThan(100);
    // Local file header signature.
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
  });

  // Stops at the confirmation on purpose: committing an import here would wipe
  // the shared dev account every other spec depends on.
  test("previews a backup without touching anything and requires confirmation", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "数据" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /下载备份/i }).click();
    const download = await downloadPromise;
    const zipPath = await download.path();

    await page.getByLabel(/备份文件/i).setInputFiles(zipPath!);

    await expect(page.getByText(/导出时间/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /使用此备份替换我的数据/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /使用此备份替换我的数据/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /删除此账号的数据？/i }),
    ).toBeVisible();

    // Cancel — nothing is imported.
    await page.getByRole("button", { name: /^取消$/i }).click();
    await expect(
      page.getByRole("heading", { name: /删除此账号的数据？/i }),
    ).toBeHidden();
  });
});
