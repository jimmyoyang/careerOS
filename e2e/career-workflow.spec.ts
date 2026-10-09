import { test, expect, uniqueName } from "./fixtures";

test.setTimeout(180_000);

test("CareerOS imports an exact JD, reviews facts, and produces a guarded preparation flow", async ({
  page,
  cleanup,
}) => {
  test.setTimeout(180_000);
  const company = uniqueName("CareerOS 测试公司");
  const title = uniqueName("前端开发实习生");
  const evidenceTitle = uniqueName("CareerOS 端到端测试项目");
  const rawJd =
    "岗位职责：开发和维护 TypeScript 应用。\n任职要求：本科及以上学历，每周至少 4 天，实习至少 3 个月。";
  await page.goto("/dashboard/career");
  await expect(
    page.getByRole("heading", { name: "让每一次投递都有依据" }),
  ).toBeVisible();
  await page.getByLabel("公司 *", { exact: true }).fill(company);
  await page.getByLabel("岗位名称 *", { exact: true }).fill(title);
  await page.getByLabel("岗位描述原文 *", { exact: true }).fill(rawJd);
  await page.getByRole("button", { name: "预览导入", exact: true }).click();
  await expect(page.getByText("地点未知 · 截止日期 未知")).toBeVisible();
  await page.getByRole("button", { name: "确认导入岗位" }).click();
  await expect(page.getByRole("tab", { name: "岗位准备" })).toHaveAttribute(
    "data-state",
    "active",
  );
  const jobId = await page.getByLabel("当前岗位").inputValue();
  cleanup.job(jobId);
  cleanup.company(company);
  cleanup.title(title);
  await page.getByText("岗位描述原文", { exact: true }).click();
  await expect(page.locator("pre").filter({ hasText: rawJd })).toBeVisible();
  await page.getByRole("button", { name: "分析岗位匹配" }).click();
  await expect(page.getByRole("heading", { name: "匹配依据" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("待核实", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "事实库", exact: true }).click();
  await page.getByLabel("事实标题", { exact: true }).fill(evidenceTitle);
  await page
    .getByLabel("事实原文", { exact: true })
    .fill("使用 TypeScript 完成 3 个接口的开发与测试。");
  await page.getByLabel("技能标签（逗号分隔）").fill("TypeScript");
  await page.getByRole("button", { name: "确认事实并保存" }).click();
  await expect(page.getByRole("status")).toContainText("事实已确认");
  await page.getByRole("tab", { name: "岗位准备", exact: true }).click();
  await page.getByRole("checkbox", { name: new RegExp(evidenceTitle) }).check();
  await page.getByRole("button", { name: "生成简历草稿" }).click();
  await expect(page.getByRole("heading", { name: "逐条复核简历" })).toBeVisible(
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("button", { name: "生成 PDF", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "全部采纳", exact: true }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试用户");
  await expect(
    page.getByRole("button", { name: "生成 PDF", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "生成 PDF", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "预览材料", exact: true }).first(),
  ).toBeVisible({ timeout: 60_000 });
  const downloadUrl = await page
    .getByRole("link", { name: "打开 PDF", exact: true })
    .first()
    .getAttribute("href");
  expect(downloadUrl).toMatch(/^\/api\/career\/materials\/.+\/download$/);
  const pdfResponse = await page.request.get(downloadUrl!);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page
    .getByRole("button", { name: "预览材料", exact: true })
    .first()
    .click();
  await expect(page.getByTitle("简历 PDF 预览")).toBeVisible();
  await page
    .getByRole("button", { name: "我已检查 PDF，确认材料", exact: true })
    .click();
  await page
    .getByRole("button", { name: "生成投递计划", exact: true })
    .first()
    .click();
  const record = page.getByRole("button", {
    name: "记录已完成的投递",
    exact: true,
  });
  await expect(record).toBeDisabled();
  await expect(page.getByText(/平台规则未知/)).toBeVisible();
  await page
    .getByLabel("实际投递时间", { exact: true })
    .fill("2026-10-09T10:30");
  await expect(record).toBeDisabled();
  await page
    .getByLabel("我已核对以上信息，并已在外部招聘网站实际提交。")
    .check();
  await record.click();
  await expect(
    page.getByRole("button", { name: "已记录投递", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/careeros-preparation-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(
      async () =>
        (
          await page
            .getByRole("heading", { name: "让每一次投递都有依据" })
            .boundingBox()
        )?.x ?? 999,
    )
    .toBeLessThan(30);
  await page.screenshot({
    path: "/tmp/careeros-preparation-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (process.env.E2E_PRODUCTION !== "true") {
    const cleared = await page.request.post("/api/test/cleanup", {
      data: { careerEvidenceTitles: [evidenceTitle] },
    });
    expect(cleared.status()).toBe(200);
  }
});

test("CareerOS table preview allows corrections before import", async ({
  page,
}) => {
  await page.goto("/dashboard/career");
  await page
    .getByLabel("表格文本", { exact: true })
    .fill("company,title,rawJd\n待修改公司,测试岗位,熟悉 TypeScript");
  await page.getByRole("button", { name: "解析并预览", exact: true }).click();
  const company = page.getByLabel("第 1 行 · 公司 *", { exact: true });
  await expect(company).toHaveValue("待修改公司");
  await company.fill("已核对公司");
  await expect(
    page.getByText("1. 已核对公司 · 测试岗位", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "移除此行", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "导入已核对的 1 条岗位" }),
  ).toHaveCount(0);
});
