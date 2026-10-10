import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobSearchWorkspace } from "@/components/search/JobSearchWorkspace";
import { getJobsList } from "@/actions/job.actions";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/actions/job.actions", () => ({ getJobsList: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn() }));
vi.mock("@/components/agent/AgentChatProvider", () => ({ useAgentChat: () => ({ busy: false }) }));

const props = { sources: [], locations: [], statuses: [] };
const job = (id: string) => ({ id, JobTitle: { label: `职位 ${id}` }, Company: { label: "测试公司" } });

beforeEach(() => {
  navigation.replace.mockClear();
  navigation.params = new URLSearchParams();
  vi.mocked(getJobsList).mockReset().mockResolvedValue({ success: true, data: [], total: 0 });
});

it("applies all URL facets together without adding an applied-only restriction", async () => {
  navigation.params = new URLSearchParams("q=工程师&source=bytedance-campus&location=shanghai&status=interview&title=engineer&page=2");
  render(<JobSearchWorkspace {...props} />);
  await waitFor(() => expect(getJobsList).toHaveBeenCalledWith(2, 24, "interview", "工程师", undefined, undefined, "engineer", "shanghai", "bytedance-campus"));
  fireEvent.change(screen.getByLabelText("来源平台"), { target: { value: "" } });
  const url = new URL(navigation.replace.mock.lastCall![0], "http://localhost");
  expect(url.searchParams.has("page")).toBe(false);
  expect(url.searchParams.has("source")).toBe(false);
  expect(url.searchParams.get("status")).toBe("interview");
  expect(url.searchParams.get("q")).toBe("工程师");
});

it("handles a rejected server call and normalizes invalid page numbers", async () => {
  navigation.params = new URLSearchParams("page=-9&q=Java");
  vi.mocked(getJobsList).mockRejectedValueOnce(new Error("连接中断"));
  render(<JobSearchWorkspace {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("连接中断");
  expect(vi.mocked(getJobsList).mock.lastCall?.[0]).toBe(1);
  expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
});

it("renders the same source and details links in table view", async () => {
  navigation.params = new URLSearchParams("view=table");
  vi.mocked(getJobsList).mockResolvedValue({ success: true, data: [{ ...job("table"), JobSource: { value: "custom", label: "自定义来源" } }], total: 1 });
  render(<JobSearchWorkspace {...props} />);
  expect(await screen.findByRole("table")).toHaveTextContent("自定义来源");
  expect(screen.getByRole("link", { name: "职位 table" })).toHaveAttribute("href", "/dashboard/myjobs/table");
});

it("updates the query after another header search on the same route", async () => {
  const view = render(<JobSearchWorkspace {...props} />);
  await screen.findByText("暂时没有匹配的职位");
  navigation.params = new URLSearchParams("q=算法&source=huawei-campus");
  view.rerender(<JobSearchWorkspace {...props} />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "搜索职位、公司或技能" })).toHaveValue("算法"));
  await waitFor(() => expect(vi.mocked(getJobsList).mock.lastCall?.[8]).toBe("huawei-campus"));
});

it("submits the search button and preserves other filters in the URL", async () => {
  navigation.params = new URLSearchParams("source=bytedance-campus&page=2");
  render(<JobSearchWorkspace {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "搜索职位、公司或技能" }), { target: { value: "C++ 工程师" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  expect(navigation.replace).toHaveBeenCalled();
  const url = new URL(navigation.replace.mock.lastCall![0], "http://localhost");
  expect(url.searchParams.get("q")).toBe("C++ 工程师");
  expect(url.searchParams.get("source")).toBe("bytedance-campus");
  expect(url.searchParams.has("page")).toBe(false);
});

it("lets users reach results after the first 24", async () => {
  vi.mocked(getJobsList).mockResolvedValue({ success: true, data: [job("1")], total: 25 });
  const view = render(<JobSearchWorkspace {...props} />);
  await screen.findByText("25 个职位");
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  expect(navigation.replace.mock.lastCall![0]).toContain("page=2");
  navigation.params = new URLSearchParams("page=2");
  view.rerender(<JobSearchWorkspace {...props} />);
  await waitFor(() => expect(vi.mocked(getJobsList).mock.lastCall?.[0]).toBe(2));
});

it("shows a retry action on failure, preserving the query", async () => {
  navigation.params = new URLSearchParams("q=算法");
  vi.mocked(getJobsList).mockResolvedValueOnce({ success: false, message: "网络错误" });
  render(<JobSearchWorkspace {...props} />);
  const retry = await screen.findByRole("button", { name: "重试" });
  expect(screen.getByRole("textbox", { name: "搜索职位、公司或技能" })).toHaveValue("算法");
  fireEvent.click(retry);
  await screen.findByText("暂时没有匹配的职位");
});

it("does not let a stale response replace a newer search", async () => {
  let resolveOld!: (value: unknown) => void;
  vi.mocked(getJobsList).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<JobSearchWorkspace {...props} />);
  await waitFor(() => expect(resolveOld).toBeDefined());
  vi.mocked(getJobsList).mockResolvedValue({ success: true, data: [job("new")], total: 1 });
  navigation.params = new URLSearchParams("q=new");
  view.rerender(<JobSearchWorkspace {...props} />);
  await screen.findByText("职位 new");
  await act(async () => resolveOld({ success: true, data: [job("old")], total: 1 }));
  expect(screen.queryByText("职位 old")).not.toBeInTheDocument();
});

it("preserves newer typing when an earlier search navigation commits", async () => {
  const view = render(<JobSearchWorkspace {...props} />);
  const input = screen.getByRole("textbox", { name: "搜索职位、公司或技能" });
  fireEvent.change(input, { target: { value: "Java" } });
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dashboard/search?q=Java", { scroll: false }));
  fireEvent.change(input, { target: { value: "JavaScript" } });
  navigation.params = new URLSearchParams("q=Java");
  view.rerender(<JobSearchWorkspace {...props} />);
  expect(input).toHaveValue("JavaScript");
  await waitFor(() => expect(navigation.replace.mock.lastCall?.[0]).toBe("/dashboard/search?q=JavaScript"));
});

it("merges successive filters before the previous navigation commits", async () => {
  const view = render(<JobSearchWorkspace sources={[{ id: "s1", createdBy: "u1", value: "huawei-campus", label: "华为校招" }]} locations={[{ id: "l1", createdBy: "u1", value: "shanghai", label: "上海" }]} statuses={[]} />);
  fireEvent.change(screen.getByLabelText("来源平台"), { target: { value: "huawei-campus" } });
  const firstUrl = navigation.replace.mock.lastCall![0];
  fireEvent.change(screen.getByLabelText("工作地点"), { target: { value: "shanghai" } });
  const secondUrl = navigation.replace.mock.lastCall![0];
  expect(new URL(secondUrl, "http://localhost").searchParams.get("source")).toBe("huawei-campus");
  expect(new URL(secondUrl, "http://localhost").searchParams.get("location")).toBe("shanghai");
  navigation.params = new URL(firstUrl, "http://localhost").searchParams;
  view.rerender(<JobSearchWorkspace {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "表格" }));
  expect(new URL(navigation.replace.mock.lastCall![0], "http://localhost").searchParams.get("location")).toBe("shanghai");
});

it("accepts an external search after a pending query is cleared back to the current URL", async () => {
  const view = render(<JobSearchWorkspace {...props} />);
  const input = screen.getByRole("textbox", { name: "搜索职位、公司或技能" });
  fireEvent.change(input, { target: { value: "Java" } });
  await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(navigation.replace.mock.lastCall?.[0]).toBe("/dashboard/search");
  // The canceled navigation returns to the existing URL, with no URL change.
  // A later global-header navigation is external, even if its text matches.
  navigation.params = new URLSearchParams("q=Java");
  view.rerender(<JobSearchWorkspace {...props} />);
  expect(input).toHaveValue("Java");
});
