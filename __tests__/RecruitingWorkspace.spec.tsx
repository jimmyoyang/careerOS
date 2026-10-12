import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruitingDraftProvider } from "@/components/recruiting/RecruitingDraftProvider";
import RecruitingWorkspace from "@/components/recruiting/RecruitingWorkspace";
import { RecruitingDataSchema } from "@/lib/recruiting/contracts";
import * as actions from "@/actions/recruiting.actions";

vi.mock("@/actions/recruiting.actions", () => ({
  getRecruitingProfileAction: vi.fn(), saveRecruitingProfileAction: vi.fn(),
  getRecruitingDevicesAction: vi.fn(), getRecruitingResumesAction: vi.fn(),
  importRecruitingResumeAction: vi.fn(), previewRecruitingLoginAction: vi.fn(),
}));
const initial = () => RecruitingDataSchema.parse({});
const user = userEvent.setup();
beforeEach(() => {
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 0, data: initial() } });
  vi.mocked(actions.getRecruitingDevicesAction).mockResolvedValue({ ok: true, data: [{ deviceId: "device-1", deviceName: "测试手机", active: true }] });
  vi.mocked(actions.getRecruitingResumesAction).mockResolvedValue({ ok: true, data: [{ id: "resume-1", title: "研发简历" }] });
  vi.mocked(actions.saveRecruitingProfileAction).mockImplementation(async (data) => ({ ok: true, data: { revision: 1, data: data as ReturnType<typeof initial> } }));
});
async function ready() { render(<RecruitingWorkspace />); await screen.findByLabelText("姓名"); }

it("saves explicit email and phone references with device and SIM mapping", async () => {
  await ready();
  await user.type(screen.getByLabelText("姓名"), "张三");
  await user.click(screen.getByRole("button", { name: "添加邮箱" }));
  await user.type(screen.getByLabelText("邮箱地址"), "work@example.com");
  await user.click(screen.getByRole("button", { name: "添加手机号" }));
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.selectOptions(screen.getByLabelText("接码设备"), "device-1");
  await user.type(screen.getByLabelText("SIM 订阅编号"), "2");
  await user.click(screen.getByRole("button", { name: "添加平台账号" }));
  expect(screen.getByLabelText("绑定邮箱")).toHaveValue("");
  expect(screen.getByLabelText("绑定手机号")).toHaveValue("");
  await user.type(screen.getByLabelText("平台名称"), "腾讯校招");
  await user.selectOptions(screen.getByLabelText("绑定邮箱"), screen.getByRole("option", { name: "work@example.com" }));
  await user.selectOptions(screen.getByLabelText("绑定手机号"), screen.getByRole("option", { name: "+86 13800138000" }));
  await user.click(screen.getByLabelText("我已核对该账号的登录信息与绑定关系"));
  expect(screen.getByRole("button", { name: "预览登录信息" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(actions.saveRecruitingProfileAction).toHaveBeenCalled());
  const [saved, revision] = vi.mocked(actions.saveRecruitingProfileAction).mock.calls[0];
  const data = saved as ReturnType<typeof initial>;
  expect(revision).toBe(0);
  expect(data.basic.fullName).toBe("张三");
  expect(data.phones[0]).toMatchObject({ countryCode: "+86", number: "13800138000", deviceId: "device-1", subscriptionId: 2 });
  expect(data.accounts[0]).toMatchObject({ emailId: data.emails[0].id, phoneId: data.phones[0].id, confirmed: true });
  await waitFor(() => expect(screen.getByRole("button", { name: "预览登录信息" })).toBeEnabled());
});

it("keeps edits and disables preview after save errors", async () => {
  vi.mocked(actions.saveRecruitingProfileAction).mockResolvedValue({ ok: false, error: "服务器暂时不可用" });
  await ready();
  await user.type(screen.getByLabelText("姓名"), "保留修改");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("服务器暂时不可用");
  expect(screen.getByLabelText("姓名")).toHaveValue("保留修改");
  expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
});

it("does not expose editable defaults when initial loading fails", async () => {
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: false, error: "读取失败" });
  render(<RecruitingWorkspace />);
  expect(await screen.findByRole("alert")).toHaveTextContent("读取失败");
  expect(screen.queryByLabelText("姓名")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "保存资料" })).not.toBeInTheDocument();
});

it("invalidates account confirmation when its bound contact changes and prevents deleting it", async () => {
  const data = RecruitingDataSchema.parse({ emails: [{ id: "e1", address: "old@example.com" }], accounts: [{ id: "a1", platform: "腾讯", emailId: "e1", loginMethod: "email", confirmed: true }] });
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 3, data } });
  await ready();
  expect(screen.getByRole("button", { name: "删除邮箱 1" })).toBeDisabled();
  await user.type(screen.getByLabelText("邮箱地址"), "x");
  expect(screen.getByLabelText("我已核对该账号的登录信息与绑定关系")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "预览登录信息" })).toBeDisabled();
});

it("requires a visible import preview before replacing local fields", async () => {
  vi.mocked(actions.importRecruitingResumeAction).mockResolvedValue({ ok: true, data: RecruitingDataSchema.parse({ basic: { fullName: "简历姓名" } }) });
  await ready();
  await user.selectOptions(screen.getByLabelText("选择已有简历"), "resume-1");
  await user.click(screen.getByRole("button", { name: "预览简历导入" }));
  const preview = await screen.findByRole("region", { name: "简历导入预览" });
  expect(within(preview).getByText("简历姓名")).toBeInTheDocument();
  expect(screen.getByLabelText("姓名")).toHaveValue("");
  await user.click(within(preview).getByRole("button", { name: "确认替换到编辑区" }));
  expect(screen.getByLabelText("姓名")).toHaveValue("简历姓名");
  expect(actions.saveRecruitingProfileAction).not.toHaveBeenCalled();
});

it("previews the exact saved account and revision, then hides the result on edits", async () => {
  const data = RecruitingDataSchema.parse({ phones: [{ id: "p1", number: "13800138000", deviceId: "device-1", subscriptionId: 2 }], accounts: [{ id: "a1", platform: "腾讯", phoneId: "p1", confirmed: true }] });
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 7, data } });
  vi.mocked(actions.previewRecruitingLoginAction).mockResolvedValue({ ok: true, data: { binding: { accountId: "a1", platform: "腾讯", label: "", loginMethod: "sms", loginIdentifier: "+8613800138000", email: "", phone: "+8613800138000", deviceId: "device-1", subscriptionId: 2 }, device: null, warning: "绑定设备不可用" } });
  await ready();
  await user.click(screen.getByRole("button", { name: "预览登录信息" }));
  const preview = await screen.findByRole("region", { name: "已保存的登录信息" });
  expect(actions.previewRecruitingLoginAction).toHaveBeenCalledWith("a1", 7);
  expect(within(preview).getAllByText("+8613800138000")).toHaveLength(2);
  expect(within(preview).getByText("绑定设备不可用")).toBeInTheDocument();
  await user.type(screen.getByLabelText("姓名"), "张三");
  expect(screen.queryByRole("region", { name: "已保存的登录信息" })).not.toBeInTheDocument();
});

it("preserves unavailable device IDs and clears SIM with explicit unbinding", async () => {
  vi.mocked(actions.getRecruitingDevicesAction).mockResolvedValue({ ok: false, error: "设备桥接服务离线" });
  const data = RecruitingDataSchema.parse({ phones: [{ id: "p1", number: "13800138000", deviceId: "old-device", subscriptionId: 12 }] });
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 1, data } });
  await ready();
  expect(screen.getByLabelText("接码设备")).toHaveValue("old-device");
  expect(screen.getByLabelText("接码设备")).toBeDisabled();
  expect(screen.getByLabelText("SIM 订阅编号")).toHaveValue(12);
  await user.click(screen.getByRole("button", { name: "解除设备与 SIM 绑定" }));
  expect(screen.getByLabelText("接码设备")).toHaveValue("");
  expect(screen.getByLabelText("SIM 订阅编号")).toHaveValue(null);
});

it("supports multiple accounts on one platform with distinct explicit bindings", async () => {
  const data = RecruitingDataSchema.parse({ emails: [{ id: "e1", address: "one@example.com" }, { id: "e2", address: "two@example.com" }], accounts: [{ id: "a1", platform: "腾讯", emailId: "e1", loginMethod: "email", confirmed: true }, { id: "a2", platform: "腾讯", emailId: "e2", loginMethod: "email", confirmed: true }] });
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 3, data } });
  await ready();
  expect(screen.getAllByLabelText("平台名称").map((input) => (input as HTMLInputElement).value)).toEqual(["腾讯", "腾讯"]);
  await user.type(screen.getAllByLabelText("用户名")[1], "second");
  expect(screen.getAllByLabelText("我已核对该账号的登录信息与绑定关系")[0]).toBeChecked();
  expect(screen.getAllByLabelText("我已核对该账号的登录信息与绑定关系")[1]).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(actions.saveRecruitingProfileAction).toHaveBeenCalled());
  const submitted = vi.mocked(actions.saveRecruitingProfileAction).mock.calls[0][0] as ReturnType<typeof initial>;
  expect(submitted.accounts.map((row) => [row.platform, row.emailId])).toEqual([["腾讯", "e1"], ["腾讯", "e2"]]);
});

it("exposes all profile sections and saves repeated entries without losing values", async () => {
  await ready();
  const entries = [
    ["教育经历", "学校", "测试大学", "education", "school"],
    ["工作与实习经历", "公司", "测试公司", "experience", "company"],
    ["项目经历", "项目名称", "测试项目", "projects", "name"],
    ["技能", "技能名称", "TypeScript", "skills", "name"],
    ["证书", "证书名称", "资格证", "certificates", "name"],
    ["获奖经历", "奖项名称", "一等奖", "awards", "name"],
    ["补充字段", "字段名称", "招聘批次", "extras", "field"],
  ];
  for (const [title, field, value] of entries) {
    await user.click(screen.getByRole("button", { name: `添加${title}` }));
    await user.type(screen.getByLabelText(field), value);
  }
  await user.type(screen.getByLabelText("意向岗位"), "软件研发");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(actions.saveRecruitingProfileAction).toHaveBeenCalled());
  const submitted = vi.mocked(actions.saveRecruitingProfileAction).mock.calls[0][0] as ReturnType<typeof initial>;
  expect(submitted.preferences.targetRoles).toBe("软件研发");
  for (const [, , value, key, field] of entries) expect((submitted[key as "education"] as Array<Record<string, string>>)[0][field]).toBe(value);
});

it("shows candidate contacts in the import preview before accepting them", async () => {
  vi.mocked(actions.importRecruitingResumeAction).mockResolvedValue({ ok: true, data: RecruitingDataSchema.parse({ emails: [{ id: "e1", address: "resume@example.com" }], phones: [{ id: "p1", number: "13900139000" }] }) });
  await ready();
  await user.selectOptions(screen.getByLabelText("选择已有简历"), "resume-1");
  await user.click(screen.getByRole("button", { name: "预览简历导入" }));
  const preview = await screen.findByRole("region", { name: "简历导入预览" });
  expect(within(preview).getByText("resume@example.com")).toBeInTheDocument();
  expect(within(preview).getByText("+86 13900139000")).toBeInTheDocument();
  expect(screen.queryByLabelText("邮箱地址")).not.toBeInTheDocument();
});

it("refreshes devices after bridge recovery without discarding draft edits", async () => {
  vi.mocked(actions.getRecruitingDevicesAction).mockResolvedValueOnce({ ok: false, error: "离线" }).mockResolvedValue({ ok: true, data: [] });
  await ready();
  await user.type(screen.getByLabelText("姓名"), "未保存姓名");
  await user.click(screen.getByRole("button", { name: "刷新设备列表" }));
  expect(await screen.findByText("当前没有已配对设备")).toBeInTheDocument();
  expect(screen.getByLabelText("姓名")).toHaveValue("未保存姓名");
  expect(actions.getRecruitingProfileAction).toHaveBeenCalledTimes(1);
  expect(actions.saveRecruitingProfileAction).not.toHaveBeenCalled();
});


it("cancels internal client navigation while dirty and leaves clean navigation unchanged", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const navigate = vi.fn((event: React.MouseEvent) => event.preventDefault());
  render(<><a href="/dashboard/profile" onClick={navigate}><span>切换到简历中心</span></a><RecruitingWorkspace /></>);
  await screen.findByLabelText("姓名");
  await user.click(screen.getByText("切换到简历中心"));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("姓名"), "保留草稿");
  await user.click(screen.getByText("切换到简历中心"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("姓名")).toHaveValue("保留草稿");
  confirm.mockReturnValue(true);
  await user.click(screen.getByText("切换到简历中心"));
  expect(navigate).toHaveBeenCalledTimes(2);
  confirm.mockRestore();
});

it("cancels the header search submit before its client router handler can discard edits", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const navigate = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<><header><form aria-label="顶部搜索" onSubmit={navigate}><input id="global-job-search" /></form></header><RecruitingWorkspace /></>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "保留姓名");
  fireEvent.submit(screen.getByRole("form", { name: "顶部搜索" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByLabelText("姓名")).toHaveValue("保留姓名");
  confirm.mockRestore();
});

it("allows same-page hashes, new tabs, downloads, external links and modified clicks without an extra prompt", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const navigate = vi.fn((event: React.MouseEvent) => event.preventDefault());
  render(<><nav>
    <a href="#details" onClick={navigate}>页内位置</a>
    <a href="/dashboard/profile" target="_blank" onClick={navigate}>新标签页</a>
    <a href="/export" download onClick={navigate}>下载资料</a>
    <a href="https://example.com" onClick={navigate}>外部网站</a>
    <a href="/dashboard/profile" onClick={navigate}>修饰键跳转</a>
  </nav><RecruitingWorkspace /></>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "未保存内容");
  for (const label of ["页内位置", "新标签页", "下载资料", "外部网站"]) await user.click(screen.getByText(label));
  fireEvent.click(screen.getByText("修饰键跳转"), { ctrlKey: true });
  fireEvent.click(screen.getByText("修饰键跳转"), { metaKey: true });
  expect(navigate).toHaveBeenCalledTimes(6);
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("restores an unsaved draft after client navigation unmounts and remounts the page", async () => {
  const initialProfile = { revision: 7, data: initial() };
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: initialProfile });
  const view = render(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "返回后保留的姓名");
  view.rerender(<RecruitingDraftProvider userId="user-a"><div>其他页面</div></RecruitingDraftProvider>);
  view.rerender(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  expect(await screen.findByLabelText("姓名")).toHaveValue("返回后保留的姓名");
  expect(screen.getByText(/已恢复此标签页中未保存的修改/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(actions.saveRecruitingProfileAction).toHaveBeenCalledWith(expect.objectContaining({ basic: expect.objectContaining({ fullName: "返回后保留的姓名" }) }), 7));
});

it("keeps the original revision when restoring a draft after another window saved", async () => {
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValueOnce({ ok: true, data: { revision: 7, data: initial() } }).mockResolvedValue({ ok: true, data: { revision: 8, data: RecruitingDataSchema.parse({ basic: { fullName: "另一窗口的姓名" } }) } });
  vi.mocked(actions.saveRecruitingProfileAction).mockResolvedValue({ ok: false, error: "资料已在其他窗口更新" });
  const view = render(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "本地未保存姓名");
  view.rerender(<RecruitingDraftProvider userId="user-a"><div>其他页面</div></RecruitingDraftProvider>);
  view.rerender(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  expect(await screen.findByLabelText("姓名")).toHaveValue("本地未保存姓名");
  expect(screen.getByText(/服务器资料已更新/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(actions.saveRecruitingProfileAction).toHaveBeenCalledWith(expect.anything(), 7));
  expect(await screen.findByRole("alert")).toHaveTextContent("资料已在其他窗口更新");
  expect(screen.getByLabelText("姓名")).toHaveValue("本地未保存姓名");
});

it("drops the memory draft when the authenticated user changes", async () => {
  const view = render(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "甲的私人资料");
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 3, data: RecruitingDataSchema.parse({ basic: { fullName: "乙的姓名" } }) } });
  view.rerender(<RecruitingDraftProvider userId="user-b"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await waitFor(() => expect(screen.getByLabelText("姓名")).toHaveValue("乙的姓名"));
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 1, data: initial() } });
  view.rerender(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await waitFor(() => expect(screen.getByLabelText("姓名")).toHaveValue(""));
});

it("clears a successfully saved memory draft before the next navigation", async () => {
  const view = render(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "已保存姓名");
  await user.click(screen.getByRole("button", { name: "保存资料" }));
  await screen.findByText("资料已保存");
  view.rerender(<RecruitingDraftProvider userId="user-a"><div>其他页面</div></RecruitingDraftProvider>);
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: true, data: { revision: 2, data: RecruitingDataSchema.parse({ basic: { fullName: "服务器更新姓名" } }) } });
  view.rerender(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  expect(await screen.findByLabelText("姓名")).toHaveValue("服务器更新姓名");
  expect(screen.queryByText(/已恢复此标签页中未保存的修改/)).not.toBeInTheDocument();
});

it("does not reveal a retained draft when authenticated profile loading fails", async () => {
  const view = render(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  await screen.findByLabelText("姓名");
  await user.type(screen.getByLabelText("姓名"), "内存中的私人姓名");
  view.rerender(<RecruitingDraftProvider userId="user-a"><div>其他页面</div></RecruitingDraftProvider>);
  vi.mocked(actions.getRecruitingProfileAction).mockResolvedValue({ ok: false, error: "请先登录" });
  view.rerender(<RecruitingDraftProvider userId="user-a"><RecruitingWorkspace /></RecruitingDraftProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("请先登录");
  expect(screen.queryByLabelText("姓名")).not.toBeInTheDocument();
});
