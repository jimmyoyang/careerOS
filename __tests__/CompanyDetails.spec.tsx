import CompanyDetails from "@/components/admin/CompanyDetails";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  deleteCompanyById,
  setCompanyWatched,
  getAllCompanies,
} from "@/actions/company.actions";
import { deleteContactById, getContactById } from "@/actions/contact.actions";
import { toastError } from "@/lib/toast";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() };
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
  usePathname: () => "/dashboard/admin/companies/co1",
}));

vi.mock("@/actions/company.actions", () => ({
  deleteCompanyById: vi.fn(),
  setCompanyWatched: vi.fn(),
  addCompany: vi.fn(),
  updateCompany: vi.fn(),
  getAllCompanies: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn(),
}));

vi.mock("@/components/CircularScore", () => ({
  CircularScore: ({ score }: { score: number }) => (
    <div data-testid="circular-score">{score}%</div>
  ),
}));

vi.mock("@/actions/contact.actions", () => ({
  getContactById: vi.fn(),
  deleteContactById: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/actions/contactRole.actions", () => ({
  getAllContactRoles: vi.fn().mockResolvedValue([]),
  createContactRole: vi.fn(),
}));

vi.mock("@/actions/jobLocation.actions", () => ({
  getAllJobLocations: vi.fn().mockResolvedValue([]),
}));

// jsdom lacks scrollIntoView, which cmdk calls when selecting an item
Element.prototype.scrollIntoView = vi.fn();

const makeDetails = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "co1",
    label: "Stripe",
    value: "stripe",
    createdBy: "u1",
    watched: false,
    watchedAt: null,
    atsProvider: null,
    atsToken: null,
    atsHost: null,
    websiteUrl: null,
    careersUrl: null,
    industry: null,
    jobs: [],
    appliedCount: 0,
    dismissedJobsCount: 0,
    currentContacts: [],
    formerContacts: [],
    ...overrides,
  }) as any;

const fact = (label: string) =>
  within(screen.getByTestId("company-summary")).getByText(label)
    .nextElementSibling as HTMLElement;

describe("CompanyDetails – header", () => {
  const user = userEvent.setup({ skipHover: true });

  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  it("shows the company name with its industry and website host", () => {
    render(
      <CompanyDetails
        details={makeDetails({
          industry: "Payments",
          websiteUrl: "https://stripe.com/about",
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "Stripe" })).toBeInTheDocument();
    expect(screen.getByText("Payments · stripe.com")).toBeInTheDocument();
  });

  it("drops the subtitle line when there is neither industry nor website", () => {
    render(<CompanyDetails details={makeDetails()} />);

    expect(screen.getByRole("heading", { name: "Stripe" }).nextElementSibling).toBeNull();
  });

  it("goes back using browser history", async () => {
    render(<CompanyDetails details={makeDetails()} />);

    await user.click(screen.getByRole("button", { name: /返回公司列表/i }));

    expect(router.back).toHaveBeenCalled();
  });

  it("watches the company and refreshes the page", async () => {
    (setCompanyWatched as any).mockResolvedValue({ success: true });
    render(<CompanyDetails details={makeDetails()} />);

    await user.click(screen.getByRole("button", { name: /^关注$/i }));

    expect(setCompanyWatched).toHaveBeenCalledWith("co1", true);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("offers Unwatch for a watched company", () => {
    render(<CompanyDetails details={makeDetails({ watched: true })} />);

    expect(screen.getByRole("button", { name: /取消关注/i })).toBeInTheDocument();
  });

  it("opens the edit dialog", async () => {
    render(<CompanyDetails details={makeDetails()} />);

    await user.click(screen.getByRole("button", { name: /^编辑$/i }));

    expect(
      await screen.findByRole("heading", { name: "编辑公司" }),
    ).toBeInTheDocument();
  });

  it("reopens Edit with the saved values after an abandoned change", async () => {
    render(<CompanyDetails details={makeDetails({ industry: "Payments" })} />);

    await user.click(screen.getByRole("button", { name: /^编辑$/i }));
    const industry = await screen.findByLabelText("行业");
    await user.clear(industry);
    await user.type(industry, "Half typed");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /^编辑$/i }));

    expect(await screen.findByLabelText("行业")).toHaveValue("Payments");
  });

  it("lists only the external links the company has", async () => {
    render(
      <CompanyDetails
        details={makeDetails({ websiteUrl: "https://stripe.com" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /更多链接/i }));

    expect(
      screen.getByRole("menuitem", { name: /打开网站/i }),
    ).toHaveAttribute("href", "https://stripe.com");
    expect(
      screen.queryByRole("menuitem", { name: /打开招聘页面/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /打开招聘平台/i }),
    ).not.toBeInTheDocument();
  });

  it("builds the job board link from the board coordinates", async () => {
    render(
      <CompanyDetails
        details={makeDetails({ atsProvider: "greenhouse", atsToken: "stripe" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /更多链接/i }));

    expect(
      screen.getByRole("menuitem", { name: /打开招聘平台/i }).getAttribute("href"),
    ).toMatch(/\/stripe$/);
  });

  it("hides the links menu when there is nothing to open", () => {
    render(<CompanyDetails details={makeDetails()} />);

    expect(
      screen.queryByRole("button", { name: /更多链接/i }),
    ).not.toBeInTheDocument();
  });
});

describe("CompanyDetails – summary card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  it("shows the watch state", () => {
    render(
      <CompanyDetails
        details={makeDetails({ watched: true, watchedAt: new Date() })}
      />,
    );

    expect(fact("关注列表")).toHaveTextContent(/^已关注/);
  });

  it("shows Not watched and em dashes for missing attributes", () => {
    render(<CompanyDetails details={makeDetails()} />);

    expect(fact("关注列表")).toHaveTextContent("未关注");
    expect(fact("招聘平台")).toHaveTextContent("—");
    expect(fact("行业")).toHaveTextContent("—");
    expect(fact("网站")).toHaveTextContent("—");
    expect(fact("招聘页面")).toHaveTextContent("—");
  });

  it("counts jobs, applied jobs and distinct contacts", () => {
    const dave = { id: "c1", name: "Dave Patel", _count: { jobLinks: 0 } };
    const priya = { id: "c2", name: "Priya Nair", _count: { jobLinks: 0 } };
    render(
      <CompanyDetails
        details={makeDetails({
          jobs: [
            { id: "j1", applied: true, JobTitle: { label: "A" }, Status: { label: "Applied", value: "applied" }, Location: null, JobSource: null, appliedDate: null, matchScore: null, createdAt: new Date() },
            { id: "j2", applied: false, JobTitle: { label: "B" }, Status: { label: "Draft", value: "draft" }, Location: null, JobSource: null, appliedDate: null, matchScore: null, createdAt: new Date() },
          ],
          appliedCount: 1,
          currentContacts: [dave, priya],
          formerContacts: [dave],
        })}
      />,
    );

    expect(fact("职位")).toHaveTextContent("2");
    expect(fact("已投递")).toHaveTextContent("1");
    expect(fact("联系人")).toHaveTextContent("2");
  });
});

describe("CompanyDetails – delete", () => {
  const user = userEvent.setup({ skipHover: true });

  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  const job = {
    id: "j1",
    applied: false,
    appliedDate: null,
    matchScore: null,
    createdAt: new Date(),
    JobTitle: { label: "Backend Engineer" },
    Status: { label: "Draft", value: "draft" },
    Location: null,
    JobSource: null,
  };

  it("explains instead of confirming when the company has jobs", async () => {
    render(<CompanyDetails details={makeDetails({ jobs: [job] })} />);

    await user.click(screen.getByRole("button", { name: /^删除$/i }));

    expect(await screen.findByText("存在关联职位！")).toBeInTheDocument();
    expect(deleteCompanyById).not.toHaveBeenCalled();
  });

  it("still blocks when every job was dismissed, and says so", async () => {
    render(<CompanyDetails details={makeDetails({ dismissedJobsCount: 3 })} />);

    await user.click(screen.getByRole("button", { name: /^删除$/i }));

    expect(await screen.findByText("存在关联职位！")).toBeInTheDocument();
    expect(screen.getByText(/其中 3 个被自动化任务忽略/)).toBeInTheDocument();
  });

  it("deletes a company with no jobs and returns to the Library", async () => {
    (deleteCompanyById as any).mockResolvedValue({ success: true });
    searchParams = new URLSearchParams("scope=watchlist");
    render(<CompanyDetails details={makeDetails()} />);

    await user.click(screen.getByRole("button", { name: /^删除$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /删除/i }));

    await waitFor(() => expect(deleteCompanyById).toHaveBeenCalledWith("co1"));
    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/admin?tab=companies&scope=watchlist",
    );
  });

  it("surfaces the server's reason when the delete is refused", async () => {
    (deleteCompanyById as any).mockResolvedValue({
      success: false,
      message: "Company cannot be deleted due to 2 associated contacts! ",
    });
    render(<CompanyDetails details={makeDetails()} />);

    await user.click(screen.getByRole("button", { name: /^删除$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /删除/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Company cannot be deleted due to 2 associated contacts! ",
      ),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("CompanyDetails – Jobs tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  const job = (overrides: Record<string, unknown> = {}) => ({
    id: "j1",
    createdAt: new Date("2026-09-01"),
    applied: true,
    appliedDate: new Date("2026-09-02"),
    matchScore: 82,
    JobTitle: { label: "Backend Engineer" },
    Status: { label: "Applied", value: "applied" },
    Location: { label: "Remote" },
    JobSource: { label: "LinkedIn" },
    ...overrides,
  });

  it("opens on the Jobs tab with a count badge", () => {
    render(<CompanyDetails details={makeDetails({ jobs: [job(), job({ id: "j2" })] })} />);

    const tab = screen.getByRole("tab", { name: /职位/i });
    expect(tab).toHaveAttribute("data-state", "active");
    expect(tab).toHaveTextContent("2");
  });

  it("links each job title to the job's details page", () => {
    render(<CompanyDetails details={makeDetails({ jobs: [job()] })} />);

    expect(
      screen.getByRole("link", { name: "Backend Engineer" }),
    ).toHaveAttribute("href", "/dashboard/myjobs/j1");
  });

  it("shows status, location, source and the match score", () => {
    render(<CompanyDetails details={makeDetails({ jobs: [job()] })} />);

    const row = screen.getByRole("row", { name: /backend engineer/i });
    expect(within(row).getByText("已投递")).toBeInTheDocument();
    expect(within(row).getByText("Remote")).toBeInTheDocument();
    expect(within(row).getByText("LinkedIn")).toBeInTheDocument();
    expect(within(row).getByTestId("circular-score")).toHaveTextContent("82%");
  });

  it("shows Not applied and a dash for an unapplied, unmatched job", () => {
    render(
      <CompanyDetails
        details={makeDetails({
          jobs: [
            job({
              applied: false,
              appliedDate: null,
              matchScore: null,
              JobSource: null,
            }),
          ],
        })}
      />,
    );

    const row = screen.getByRole("row", { name: /backend engineer/i });
    expect(within(row).getByText("未投递")).toBeInTheDocument();
    expect(within(row).queryByTestId("circular-score")).not.toBeInTheDocument();
  });

  it("shows an empty state with no action when there are no jobs", () => {
    render(<CompanyDetails details={makeDetails()} />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("该公司暂无职位")).toBeInTheDocument();
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /职位/i })).toHaveTextContent(/^职位$/);
  });
});

describe("CompanyDetails – Contacts tab", () => {
  const user = userEvent.setup({ skipHover: true });

  const person = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name,
    title: null,
    email: null,
    phone: null,
    linkedinUrl: null,
    companyId: null,
    Company: null,
    locationId: null,
    Location: null,
    relationship: null,
    workedAtCompanyId: null,
    WorkedAtCompany: null,
    workedFrom: null,
    workedTo: null,
    roleId: null,
    Role: null,
    notes: null,
    lastContactedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "u1",
    jobLinks: [],
    _count: { jobLinks: 0 },
    ...overrides,
  });

  const dave = person("c1", "Dave Patel", { companyId: "co1", Company: { id: "co1", label: "Stripe" } });
  const priya = person("c2", "Priya Nair", { workedAtCompanyId: "co1", WorkedAtCompany: { id: "co1", label: "Stripe" } });

  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams("tab=contacts");
    (getAllCompanies as any).mockResolvedValue([
      { id: "co1", label: "Stripe", value: "stripe", createdBy: "u1" },
    ]);
  });

  it("shows only the sections that have people", () => {
    render(<CompanyDetails details={makeDetails({ currentContacts: [dave] })} />);

    expect(screen.getByRole("heading", { name: "在此任职" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "曾与你共事" })).not.toBeInTheDocument();
  });

  it("drops the Company column only in Works here", () => {
    render(
      <CompanyDetails
        details={makeDetails({ currentContacts: [dave], formerContacts: [priya] })}
      />,
    );

    expect(screen.getAllByRole("columnheader", { name: "公司" })).toHaveLength(1);
  });

  it("lists someone in both groups twice but counts them once", () => {
    render(
      <CompanyDetails
        details={makeDetails({ currentContacts: [dave], formerContacts: [dave] })}
      />,
    );

    expect(screen.getAllByText("Dave Patel")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: /联系人/i })).toHaveTextContent("1");
    expect(fact("联系人")).toHaveTextContent("1");
  });

  it("offers Add Contact from the empty state and loads the pickers once", async () => {
    render(<CompanyDetails details={makeDetails()} />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("该公司暂无联系人")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "添加联系人" }));
    expect(
      await screen.findByRole("combobox", { name: /^公司$/i }),
    ).toHaveTextContent("Stripe");

    await user.keyboard("{Escape}");
    await user.click(within(panel).getByRole("button", { name: "添加联系人" }));
    await screen.findByRole("combobox", { name: /^公司$/i });

    expect(getAllCompanies).toHaveBeenCalledTimes(1);
  });

  it("opens the dialog in edit mode from a row", async () => {
    (getContactById as any).mockResolvedValue(dave);
    render(<CompanyDetails details={makeDetails({ currentContacts: [dave] })} />);

    await user.click(screen.getByRole("button", { name: /打开菜单/i }));
    await user.click(await screen.findByRole("menuitem", { name: /编辑联系人/i }));

    expect(getContactById).toHaveBeenCalledWith("c1");
    expect(await screen.findByRole("heading", { name: "编辑联系人" })).toBeInTheDocument();
  });

  it("refreshes the page after deleting a contact", async () => {
    (deleteContactById as any).mockResolvedValue({ success: true });
    render(<CompanyDetails details={makeDetails({ currentContacts: [dave] })} />);

    await user.click(screen.getByRole("button", { name: /打开菜单/i }));
    await user.click(await screen.findByRole("menuitem", { name: /删除/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /删除/i }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});
