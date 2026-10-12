import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { JobSearchWorkspace } from "@/components/search/JobSearchWorkspace";
import HuaweiWorkspace from "@/components/huawei/HuaweiWorkspace";
import * as actions from "@/actions/huawei.actions";
import type { HuaweiDetail, HuaweiPage } from "@/lib/huawei/types";

vi.mock("@/components/search/useJobSearch", () => ({ SEARCH_PAGE_SIZE: 24, useJobSearch: () => ({
  draftQuery: "", setDraftQuery: vi.fn(), submit: vi.fn(), update: vi.fn(), retry: vi.fn(),
  source: "", location: "", title: "", status: "", view: "cards", loading: false, error: "", jobs: [], total: 0, page: 1,
}) }));
vi.mock("@/components/search/SearchJobResults", () => ({ SearchJobResults: () => null }));
vi.mock("@/actions/huawei.actions", () => ({
  listHuaweiJobsAction: vi.fn(), getHuaweiJobAction: vi.fn(), importHuaweiJobAction: vi.fn(),
  getHuaweiAccountsAction: vi.fn(), previewHuaweiLoginAction: vi.fn(),
}));
const job = (id = "job-1"): HuaweiDetail => ({ advertisementId: id, title: `软件工程师 ${id}`, location: "深圳", category: "研发", recruitmentType: "campus", updatedAt: "2026-10-10", url: `https://career.huawei.com/reccampportal/portal5/campus-recruitment-detail.html?jobId=${id}`, responsibilities: "基础职责", requirements: "基础要求", intentions: [{ id: "intent-1", title: "云计算研发", responsibilities: "开发云平台", requirements: "熟悉分布式系统", location: "杭州", departments: "云计算部门" }, { id: "intent-2", title: "操作系统研发", responsibilities: "开发操作系统", requirements: "熟悉 C++", location: "北京", departments: "操作系统部门" }] });
const page = (jobs = [job()], current = 1, total = 21): HuaweiPage => ({ jobs, total, page: current, pageSize: 20, fetchedAt: "2026-10-12T08:00:00.000Z" });
const accountData = { revision: 7, accounts: [{ id: "a1", label: "个人邮箱", loginMethod: "email" as const, confirmed: true }, { id: "a2", label: "备用账号", loginMethod: "sms" as const, confirmed: false }] };
const previewData = { binding: { accountId: "a1", platform: "华为", label: "个人邮箱", loginMethod: "email" as const, loginIdentifier: "saved@example.com", email: "saved@example.com", phone: "+8613800138000", deviceId: "device-1", subscriptionId: 2 }, device: null, warning: "接码设备不可用，请在官网自行接收验证码" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(actions.listHuaweiJobsAction).mockResolvedValue({ ok: true, data: page() });
  vi.mocked(actions.getHuaweiJobAction).mockImplementation(async (id) => ({ ok: true, data: job(id) }));
  vi.mocked(actions.importHuaweiJobAction).mockResolvedValue({ ok: true, data: { jobId: "saved-1", duplicate: false } });
  vi.mocked(actions.getHuaweiAccountsAction).mockResolvedValue({ ok: true, data: accountData });
  vi.mocked(actions.previewHuaweiLoginAction).mockResolvedValue({ ok: true, data: previewData });
});
async function ready() { render(<HuaweiWorkspace />); await screen.findByRole("button", { name: "查看软件工程师 job-1" }); }
async function detail() { await ready(); fireEvent.click(screen.getByRole("button", { name: "查看软件工程师 job-1" })); return screen.findByRole("region", { name: "职位详情" }); }
function chooseIntention() { fireEvent.change(screen.getByLabelText("职位意向"), { target: { value: "intent-1" } }); }

it("loads public jobs with visible progress and accurate page provenance", async () => {
  const pending = deferred<Awaited<ReturnType<typeof actions.listHuaweiJobsAction>>>();
  vi.mocked(actions.listHuaweiJobsAction).mockReturnValueOnce(pending.promise);
  render(<HuaweiWorkspace />);
  expect(screen.getByText("正在读取华为公开职位…")).toBeInTheDocument();
  await act(async () => pending.resolve({ ok: true, data: page() }));
  expect(actions.listHuaweiJobsAction).toHaveBeenCalledWith({ recruitmentType: "campus", keyword: "", page: 1 });
  expect(screen.getByText(/当前筛选共 21 个职位/)).toBeInTheDocument();
  expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
  expect(document.querySelector("time")).toHaveAttribute("datetime", page().fetchedAt);
  expect(screen.getByText(/仅展示当前查询结果/)).toBeInTheDocument();
});

it("retries list errors and displays empty results", async () => {
  vi.mocked(actions.listHuaweiJobsAction).mockResolvedValueOnce({ ok: false, error: "官网暂时不可用" }).mockResolvedValue({ ok: true, data: page([], 1, 0) });
  render(<HuaweiWorkspace />);
  expect(await screen.findByText("官网暂时不可用")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重试职位查询" }));
  expect(await screen.findByText("没有找到匹配的公开职位")).toBeInTheDocument();
});

it("applies keyword and recruitment filters and resets pagination", async () => {
  await ready();
  vi.mocked(actions.listHuaweiJobsAction).mockResolvedValueOnce({ ok: true, data: page([job("job-2")], 2) });
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  await screen.findByRole("button", { name: "查看软件工程师 job-2" });
  expect(actions.listHuaweiJobsAction).toHaveBeenLastCalledWith({ recruitmentType: "campus", keyword: "", page: 2 });
  fireEvent.change(screen.getByLabelText("职位关键词"), { target: { value: "  算法  " } });
  fireEvent.change(screen.getByLabelText("招聘类型"), { target: { value: "internship" } });
  fireEvent.click(screen.getByRole("button", { name: "查询公开职位" }));
  await waitFor(() => expect(actions.listHuaweiJobsAction).toHaveBeenLastCalledWith({ recruitmentType: "internship", keyword: "算法", page: 1 }));
});

it("ignores stale list responses after a new query", async () => {
  const old = deferred<Awaited<ReturnType<typeof actions.listHuaweiJobsAction>>>();
  vi.mocked(actions.listHuaweiJobsAction).mockReturnValueOnce(old.promise);
  render(<HuaweiWorkspace />);
  fireEvent.change(screen.getByLabelText("职位关键词"), { target: { value: "new" } });
  fireEvent.click(screen.getByRole("button", { name: "查询公开职位" }));
  await screen.findByRole("button", { name: "查看软件工程师 job-1" });
  await act(async () => old.resolve({ ok: true, data: page([job("old")]) }));
  expect(screen.queryByRole("button", { name: "查看软件工程师 old" })).not.toBeInTheDocument();
});

it("requires a job intention and shows its exact plain text before import", async () => {
  const region = await detail();
  expect(within(region).getByRole("button", { name: "导入我的职位" })).toBeDisabled();
  chooseIntention();
  expect(within(region).getByText("开发云平台")).toBeInTheDocument();
  expect(within(region).getByText("熟悉分布式系统")).toBeInTheDocument();
  expect(within(region).getByText("杭州")).toBeInTheDocument();
  expect(within(region).getByText("云计算部门")).toBeInTheDocument();
  fireEvent.click(within(region).getByRole("button", { name: "导入我的职位" }));
  expect(await within(region).findByRole("link", { name: "查看已导入职位" })).toHaveAttribute("href", "/dashboard/myjobs/saved-1");
  expect(within(region).getByRole("link", { name: "准备简历与申请" })).toHaveAttribute("href", "/dashboard/career?jobId=saved-1");
  expect(actions.importHuaweiJobAction).toHaveBeenCalledWith({ advertisementId: "job-1", intentionId: "intent-1" }, expect.stringMatching(/^[0-9a-f-]{36}$/));
  const official = within(region).getByRole("link", { name: "在华为官网继续申请" });
  expect(new URL(official.getAttribute("href")!).searchParams.get("positionIntentionId")).toBe("intent-1");
  expect(official).toHaveAttribute("target", "_blank");
  expect(official).toHaveAttribute("rel", "noopener noreferrer");
});

it("reuses the same import key after failure and reports existing jobs", async () => {
  vi.mocked(actions.importHuaweiJobAction).mockResolvedValueOnce({ ok: false, error: "保存暂时失败" }).mockResolvedValue({ ok: true, data: { jobId: "existing", duplicate: true } });
  await detail(); chooseIntention();
  fireEvent.click(screen.getByRole("button", { name: "导入我的职位" }));
  await screen.findByText("保存暂时失败");
  fireEvent.click(screen.getByRole("button", { name: "导入我的职位" }));
  expect(await screen.findByText(/此职位已在我的职位中/)).toBeInTheDocument();
  expect(vi.mocked(actions.importHuaweiJobAction).mock.calls[0][1]).toBe(vi.mocked(actions.importHuaweiJobAction).mock.calls[1][1]);
});

it("allows a job with no intentions and retries detail failures", async () => {
  vi.mocked(actions.getHuaweiJobAction).mockResolvedValueOnce({ ok: false, error: "详情暂时不可用" }).mockResolvedValue({ ok: true, data: { ...job(), intentions: [] } });
  await ready(); fireEvent.click(screen.getByRole("button", { name: "查看软件工程师 job-1" }));
  await screen.findByText("详情暂时不可用");
  fireEvent.click(screen.getByRole("button", { name: "重试职位详情" }));
  expect(await screen.findByText("基础职责")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导入我的职位" })).toBeEnabled();
});

it("ignores late details after switching jobs", async () => {
  vi.mocked(actions.listHuaweiJobsAction).mockResolvedValue({ ok: true, data: page([job(), job("job-2")]) });
  const old = deferred<Awaited<ReturnType<typeof actions.getHuaweiJobAction>>>();
  vi.mocked(actions.getHuaweiJobAction).mockReturnValueOnce(old.promise);
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "查看软件工程师 job-1" }));
  fireEvent.click(screen.getByRole("button", { name: "查看软件工程师 job-2" }));
  const region = await screen.findByRole("region", { name: "职位详情" });
  await within(region).findByRole("heading", { name: "软件工程师 job-2" });
  await act(async () => old.resolve({ ok: true, data: job() }));
  expect(within(region).queryByRole("heading", { name: "软件工程师 job-1" })).not.toBeInTheDocument();
});

it("does not attach late import results to a different intention", async () => {
  const old = deferred<Awaited<ReturnType<typeof actions.importHuaweiJobAction>>>();
  vi.mocked(actions.importHuaweiJobAction).mockReturnValueOnce(old.promise);
  await detail(); chooseIntention(); fireEvent.click(screen.getByRole("button", { name: "导入我的职位" }));
  fireEvent.change(screen.getByLabelText("职位意向"), { target: { value: "intent-2" } });
  await act(async () => old.resolve({ ok: true, data: { jobId: "wrong-intention", duplicate: false } }));
  expect(screen.queryByRole("link", { name: "查看已导入职位" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导入我的职位" })).toBeEnabled();
});

it("requires explicit saved account selection and previews the exact binding", async () => {
  await ready();
  expect(screen.getByLabelText("华为招聘账号")).toHaveValue("");
  expect(screen.getByRole("button", { name: "核对已保存的登录信息" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("华为招聘账号"), { target: { value: "a1" } });
  fireEvent.click(screen.getByRole("button", { name: "核对已保存的登录信息" }));
  const preview = await screen.findByRole("region", { name: "已保存的华为登录信息" });
  expect(actions.previewHuaweiLoginAction).toHaveBeenCalledWith("a1", 7);
  expect(within(preview).getAllByText("saved@example.com")).toHaveLength(2);
  expect(within(preview).getByText("+8613800138000")).toBeInTheDocument();
  expect(within(preview).getByText(previewData.warning)).toBeInTheDocument();
  expect(screen.getByText(/不会发送短信、执行登录或提交申请/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "管理求职资料与账号" })).toHaveAttribute("href", "/dashboard/recruiting");
  fireEvent.change(screen.getByLabelText("华为招聘账号"), { target: { value: "a2" } });
  expect(screen.queryByRole("region", { name: "已保存的华为登录信息" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "核对已保存的登录信息" })).toBeDisabled();
});

it("ignores a stale account preview after switching accounts", async () => {
  const old = deferred<Awaited<ReturnType<typeof actions.previewHuaweiLoginAction>>>();
  vi.mocked(actions.previewHuaweiLoginAction).mockReturnValueOnce(old.promise);
  await ready();
  fireEvent.change(screen.getByLabelText("华为招聘账号"), { target: { value: "a1" } });
  fireEvent.click(screen.getByRole("button", { name: "核对已保存的登录信息" }));
  fireEvent.change(screen.getByLabelText("华为招聘账号"), { target: { value: "a2" } });
  await act(async () => old.resolve({ ok: true, data: previewData }));
  expect(screen.queryByRole("region", { name: "已保存的华为登录信息" })).not.toBeInTheDocument();
});

it("retries account load errors without disturbing public jobs", async () => {
  vi.mocked(actions.getHuaweiAccountsAction).mockRejectedValueOnce(new Error("账号读取失败")).mockResolvedValue({ ok: true, data: { revision: 0, accounts: [] } });
  await ready();
  expect(screen.getByText("账号读取失败")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "刷新华为账号" }));
  expect(await screen.findByText("尚未保存华为招聘账号")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "查看软件工程师 job-1" })).toBeInTheDocument();
});

it("shows account preview failures without displaying a binding", async () => {
  vi.mocked(actions.previewHuaweiLoginAction).mockResolvedValue({ ok: false, error: "账号资料已更新，请刷新" });
  await ready();
  fireEvent.change(screen.getByLabelText("华为招聘账号"), { target: { value: "a1" } });
  fireEvent.click(screen.getByRole("button", { name: "核对已保存的登录信息" }));
  expect(await screen.findByText("账号资料已更新，请刷新")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "已保存的华为登录信息" })).not.toBeInTheDocument();
});

it("clears detail and pending imports when a different query starts", async () => {
  const old = deferred<Awaited<ReturnType<typeof actions.importHuaweiJobAction>>>();
  vi.mocked(actions.importHuaweiJobAction).mockReturnValueOnce(old.promise);
  await detail(); chooseIntention(); fireEvent.click(screen.getByRole("button", { name: "导入我的职位" }));
  fireEvent.change(screen.getByLabelText("职位关键词"), { target: { value: "算法" } });
  fireEvent.click(screen.getByRole("button", { name: "查询公开职位" }));
  await act(async () => old.resolve({ ok: true, data: { jobId: "stale", duplicate: false } }));
  expect(screen.queryByRole("region", { name: "职位详情" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "查看已导入职位" })).not.toBeInTheDocument();
});

it("renders remote content as text without interpreting markup", async () => {
  vi.mocked(actions.getHuaweiJobAction).mockResolvedValue({ ok: true, data: { ...job(), responsibilities: '<img src=x onerror="alert(1)">', intentions: [] } });
  const region = await detail();
  expect(within(region).getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  expect(region.querySelector("img")).toBeNull();
});

it("provides a dedicated public Huawei jobs entry from the saved job search", () => {
  render(<JobSearchWorkspace sources={[]} locations={[]} statuses={[]} />);
  expect(screen.getByRole("link", { name: "查询华为公开职位" })).toHaveAttribute("href", "/dashboard/huawei");
});

it("focuses and reveals the loaded detail after narrow-screen selection", async () => {
  vi.stubGlobal("innerWidth", 390);
  const pending = deferred<Awaited<ReturnType<typeof actions.getHuaweiJobAction>>>();
  vi.mocked(actions.getHuaweiJobAction).mockReturnValueOnce(pending.promise);
  try {
    await ready();
    const button = screen.getByRole("button", { name: "查看软件工程师 job-1" });
    button.focus(); fireEvent.click(button);
    const region = screen.getByRole("region", { name: "职位详情" });
    const scroll = vi.fn(); region.scrollIntoView = scroll;
    expect(region).not.toHaveFocus();
    await act(async () => pending.resolve({ ok: true, data: job() }));
    expect(region).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
  } finally { vi.unstubAllGlobals(); }
});

it("keeps desktop selection focus and scrolling in the results list", async () => {
  vi.stubGlobal("innerWidth", 1138);
  const pending = deferred<Awaited<ReturnType<typeof actions.getHuaweiJobAction>>>();
  vi.mocked(actions.getHuaweiJobAction).mockReturnValueOnce(pending.promise);
  try {
    await ready();
    const button = screen.getByRole("button", { name: "查看软件工程师 job-1" });
    button.focus(); fireEvent.click(button);
    const region = screen.getByRole("region", { name: "职位详情" });
    const scroll = vi.fn(); region.scrollIntoView = scroll;
    await act(async () => pending.resolve({ ok: true, data: job() }));
    expect(button).toHaveFocus();
    expect(scroll).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
