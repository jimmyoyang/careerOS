import { screen, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTabsContainer from "@/components/admin/AdminTabsContainer";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard/admin",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/actions/company.actions", () => ({
  getCompanyList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getCompanyById: vi.fn(),
  getAllCompanies: vi.fn().mockResolvedValue([]),
  addCompany: vi.fn(),
}));

vi.mock("@/actions/jobtitle.actions", () => ({
  getJobTitleList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}));

vi.mock("@/actions/jobLocation.actions", () => ({
  getJobLocationsList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAllJobLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/actions/contact.actions", () => ({
  getContactList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getContactById: vi.fn(),
  deleteContactById: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/actions/activity.actions", () => ({
  getActivityTypeList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createActivityType: vi.fn(),
}));

vi.mock("@/actions/contactRole.actions", () => ({
  getContactRoleList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAllContactRoles: vi.fn().mockResolvedValue([]),
  createContactRole: vi.fn(),
  deleteContactRoleById: vi.fn(),
}));

vi.mock("@/actions/jobStageType.actions", () => ({
  getJobStageTypeList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createJobStageType: vi.fn(),
  updateJobStageType: vi.fn(),
  deleteJobStageTypeById: vi.fn(),
}));

describe("AdminTabsContainer", () => {
  const user = userEvent.setup({ skipHover: true });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all tabs", () => {
    render(<AdminTabsContainer />);

    expect(screen.getByRole("tab", { name: "公司" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "职位名称" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "地点" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "活动类型" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "联系人" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "角色" })).toBeInTheDocument();
  });

  it("offers a Stages tab", () => {
    render(<AdminTabsContainer />);

    expect(screen.getByRole("tab", { name: "阶段" })).toBeInTheDocument();
  });

  it("should default to companies tab", () => {
    render(<AdminTabsContainer />);

    const companiesTab = screen.getByRole("tab", { name: "公司" });
    expect(companiesTab).toHaveAttribute("data-state", "active");
  });

  it("should switch tabs and update URL", async () => {
    render(<AdminTabsContainer />);

    const jobTitlesTab = screen.getByRole("tab", { name: "职位名称" });
    await user.click(jobTitlesTab);

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/admin?tab=job-titles"
    );
  });

  it("should switch to locations tab and update URL", async () => {
    render(<AdminTabsContainer />);

    const locationsTab = screen.getByRole("tab", { name: "地点" });
    await user.click(locationsTab);

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/admin?tab=locations"
    );
  });

  it("should switch to activity types tab and update URL", async () => {
    render(<AdminTabsContainer />);

    const activityTypesTab = screen.getByRole("tab", {
      name: "活动类型",
    });
    await user.click(activityTypesTab);

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/admin?tab=activity-types"
    );
  });

  it("should render companies tab panel content by default", async () => {
    render(<AdminTabsContainer />);

    await waitFor(() => {
      expect(screen.getByTestId("add-company-btn")).toBeInTheDocument();
    });
  });
});
