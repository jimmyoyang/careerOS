import { test, expect } from "./fixtures";

// Opt in against a disposable database. These tests call the real public
// recruitment sites; no requests or server actions are intercepted.
test.skip(process.env.E2E_LIVE_SOURCES !== "true", "需要显式启用真实招聘站验收");
test.setTimeout(120_000);

for (const provider of ["tencent", "alibaba", "meituan"]) {
  test(`${provider}: searches, imports full text, persists and deduplicates`, async ({ page, cleanup }) => {
    await page.goto("/dashboard/career");
    const search = async () => {
      await page.getByRole("tab", { name: "岗位导入", exact: true }).click();
      await page.getByLabel("公开招聘平台").selectOption(provider);
      await page.getByLabel("公开岗位关键词").fill("算法");
      await page.getByLabel("公开岗位关键词").press("Enter");
      await expect(page.locator("article").first()).toBeVisible({ timeout: 40_000 });
    };
    await search();
    const article = page.locator("article").first();
    const summary = await article.locator("p.whitespace-pre-wrap").innerText();
    const source = new URL((await article.getByRole("link", { name: "查看官方来源" }).getAttribute("href"))!);
    const idParam = provider === "tencent" ? "postId" : provider === "alibaba" ? "positionId" : "jobUnionId";
    const sourceId = source.searchParams.get(idParam);
    expect(sourceId).toBeTruthy();
    await page.locator("article").first().getByRole("button", { name: "导入 CareerOS" }).click();
    await expect(page.getByRole("tab", { name: "岗位准备" })).toHaveAttribute("data-state", "active", { timeout: 30_000 });
    const jobId = await page.getByLabel("当前岗位").inputValue();
    cleanup.job(jobId);
    await page.goto(`/dashboard/career?jobId=${jobId}`);
    await page.getByText("岗位描述原文", { exact: true }).click();
    const rawJd = await page.locator("pre").first().innerText();
    expect(rawJd.length).toBeGreaterThan(50);
    if (provider === "tencent") {
      expect(rawJd).toContain(summary);
      expect(rawJd.length).toBeGreaterThan(summary.length);
    }
    await search();
    await page.locator("article").filter({ has: page.locator(`a[href*="${idParam}=${encodeURIComponent(sourceId!)}"]`) }).getByRole("button", { name: "导入 CareerOS" }).click();
    await expect(page.getByRole("tab", { name: "岗位准备" })).toHaveAttribute("data-state", "active");
    await expect(page.getByLabel("当前岗位")).toHaveValue(jobId);
  });
}

for (const provider of ["huawei", "bytedance"]) {
  test(`${provider}: reads official details and imports into saved jobs`, async ({ page, cleanup }) => {
    await page.goto(`/dashboard/${provider}`);
    const list = page.getByRole("region", { name: provider === "huawei" ? "华为公开职位列表" : "字节公开职位列表" });
    await expect(list.getByRole("button", { name: /^查看/ }).first()).toBeVisible({ timeout: 40_000 });
    await list.getByRole("button", { name: /^查看/ }).first().click();
    const detail = page.getByRole("region", { name: "职位详情", exact: true });
    await expect(detail.getByRole("heading", { name: "岗位要求" })).toBeVisible({ timeout: 30_000 });
    const intention = detail.getByLabel("职位意向");
    if (await intention.isVisible()) await intention.selectOption({ index: 1 });
    await detail.getByRole("button", { name: "导入我的职位", exact: true }).click();
    const link = detail.getByRole("link", { name: "查看已导入职位" });
    await expect(link).toBeVisible({ timeout: 30_000 });
    const href = await link.getAttribute("href");
    cleanup.job(href!.split("/").pop()!);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("main")).toContainText("职位");
  });
}
