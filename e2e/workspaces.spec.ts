import { test, expect, createNewJob, uniqueName } from "./fixtures";

test("global search finds persisted jobs and applies backend filters", async ({ page, cleanup }) => {
  const title = uniqueName("搜索验收工程师");
  const id = await createNewJob(page, title, cleanup);
  const search = page.getByRole("searchbox", { name: "搜索职位、公司或技能" });
  await search.fill(title);
  await search.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/search\?q=/);
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "表格", exact: true }).click();
  await expect(page.getByRole("table", { name: "职位搜索结果" })).toContainText(title);
  await page.getByLabel("跟踪状态", { exact: true }).selectOption("rejected");
  await expect(page.getByText("暂时没有匹配的职位", { exact: true })).toBeVisible();
  await page.getByLabel("跟踪状态", { exact: true }).selectOption("draft");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/myjobs/${id}$`));
});

test("recruiting profile and account binding survive reload", async ({ page }) => {
  await page.goto("/dashboard/recruiting");
  await page.getByLabel("姓名", { exact: true }).fill("资料验收用户");
  await page.getByLabel("意向岗位", { exact: true }).fill("算法工程师");
  await page.getByLabel("意向城市", { exact: true }).fill("杭州");
  await page.getByRole("button", { name: "添加平台账号", exact: true }).click();
  await page.getByLabel("平台名称", { exact: true }).fill("腾讯");
  await page.getByRole("combobox", { name: "登录方式", exact: true }).selectOption("username");
  await page.getByLabel("用户名", { exact: true }).fill("qa-career-account");
  await page.getByLabel("我已核对该账号的登录信息与绑定关系").check();
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("资料已保存");
  await page.reload();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("资料验收用户");
  await expect(page.getByLabel("意向岗位", { exact: true })).toHaveValue("算法工程师");
  await page.getByRole("button", { name: "预览登录信息", exact: true }).click();
  await expect(page.getByRole("region", { name: "已保存的登录信息" })).toContainText("qa-career-account");
});
