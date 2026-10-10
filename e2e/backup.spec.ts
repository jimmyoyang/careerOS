import { test, expect } from "./fixtures";

test.describe("data backup", () => {
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
