import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import SidebarToggle from "@/components/SidebarToggle";
import NavLink from "@/components/NavLink";
import { SidebarProvider } from "@/context/SidebarContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONSTANTS } from "@/lib/constants";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dashboard"),
}));

const testUser = { id: "1", name: "Test User", email: "test@example.com" };

const renderSidebar = () =>
  render(
    <SidebarProvider initialExpanded>
      <Sidebar user={testUser} signOutAction={() => {}} />
      <SidebarToggle />
    </SidebarProvider>
  );

describe("NavLink - active state", () => {
  const renderNavLink = (route: string, pathname: string) =>
    render(
      <TooltipProvider>
        <NavLink
          label="职位管理"
          Icon={Briefcase}
          route={route}
          pathname={pathname}
          expanded
        />
      </TooltipProvider>
    );

  it("marks the link active on an exact route match", () => {
    renderNavLink("/dashboard/myjobs", "/dashboard/myjobs");

    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  it("marks the link active on a nested route", () => {
    renderNavLink("/dashboard/myjobs", "/dashboard/myjobs/job-123");

    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  // "/dashboard" is a prefix of every other route, so it must not match them.
  it("does not mark the dashboard link active on other pages", () => {
    renderNavLink("/dashboard", "/dashboard/myjobs");

    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });

  it("does not match a route that is only a string prefix", () => {
    renderNavLink("/dashboard/job", "/dashboard/jobs");

    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });
});

describe("NavLink - label rendering", () => {
  const renderNavLink = (expanded: boolean) =>
    render(
      <TooltipProvider>
        <NavLink
          label="职位管理"
          Icon={Briefcase}
          route="/dashboard/myjobs"
          pathname="/dashboard"
          expanded={expanded}
        />
      </TooltipProvider>
    );

  it("shows a visible label when expanded", () => {
    renderNavLink(true);

    expect(screen.getByText("职位管理")).not.toHaveClass("sr-only");
  });

  // The icon sits in a fixed-width lead box, so the label can stay in
  // flow and just fade out instead of needing sr-only positioning.
  it("fades the label out visually when collapsed", () => {
    renderNavLink(false);

    expect(screen.getByText("职位管理")).toHaveClass("opacity-0");
  });

  it("keeps an accessible name in both states", () => {
    const { unmount } = renderNavLink(false);
    expect(screen.getByRole("link", { name: "职位管理" })).toBeInTheDocument();
    unmount();

    renderNavLink(true);
    expect(screen.getByRole("link", { name: "职位管理" })).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    document.cookie = `${APP_CONSTANTS.SIDEBAR_STORAGE_KEY}=; path=/; max-age=0`;
    (usePathname as any).mockReturnValue("/dashboard");
  });

  it("renders a link for each nav item", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: "职位管理" })).toHaveAttribute(
      "href",
      "/dashboard/myjobs"
    );
  });

  it("shows the user's email and a settings link via the account menu", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText(testUser.email)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "用户菜单" }));

    // Radix gives the menu item role="menuitem" rather than "link".
    expect(
      await screen.findByRole("menuitem", { name: "设置" })
    ).toHaveAttribute("href", "/dashboard/settings");
  });

  it("marks the current page with aria-current", () => {
    (usePathname as any).mockReturnValue("/dashboard/tasks");

    renderSidebar();

    expect(screen.getByRole("link", { name: "待办事项" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "工作台" })
    ).not.toHaveAttribute("aria-current");
  });

  it("does not render a collapse control inside the sidebar", () => {
    renderSidebar();

    // The collapse toggle lives in the header, not the rail; the only
    // button inside the sidebar is the account menu trigger.
    const sidebar = within(screen.getByRole("complementary"));
    expect(
      sidebar.queryByRole("button", { name: "收起侧栏" })
    ).toBeNull();
    expect(sidebar.getByRole("button", { name: "用户菜单" })).toBeInTheDocument();
  });
});

describe("SidebarToggle", () => {
  beforeEach(() => {
    document.cookie = `${APP_CONSTANTS.SIDEBAR_STORAGE_KEY}=; path=/; max-age=0`;
    (usePathname as any).mockReturnValue("/dashboard");
  });

  it("collapses and expands the sidebar", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const toggle = screen.getByRole("button", { name: "收起侧栏" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    const expandToggle = screen.getByRole("button", {
      name: "展开侧栏",
    });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");

    await user.click(expandToggle);

    expect(
      screen.getByRole("button", { name: "收起侧栏" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("hides nav labels visually when collapsed", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText("职位管理")).not.toHaveClass("opacity-0");

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));

    expect(screen.getByText("职位管理")).toHaveClass("opacity-0");
  });

  it("persists the collapsed state as a cookie", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));

    expect(document.cookie).toContain(
      `${APP_CONSTANTS.SIDEBAR_STORAGE_KEY}=false`
    );
  });

  it("points aria-controls at the sidebar element", () => {
    renderSidebar();

    const toggle = screen.getByRole("button", { name: "收起侧栏" });
    const target = toggle.getAttribute("aria-controls");

    expect(document.getElementById(target!)).toBe(
      screen.getByRole("complementary")
    );
  });
});
