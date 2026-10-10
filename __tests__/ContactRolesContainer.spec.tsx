import ContactRolesContainer from "@/components/admin/ContactRolesContainer";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getContactRoleList,
  deleteContactRoleById,
} from "@/actions/contactRole.actions";
import { toastError } from "@/lib/toast";

vi.mock("@/actions/contactRole.actions", () => ({
  getContactRoleList: vi.fn(),
  createContactRole: vi.fn(),
  deleteContactRoleById: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn(),
}));

const roles = [
  {
    id: "r1",
    label: "Recruiter",
    value: "recruiter",
    createdBy: "u1",
    _count: { jobContacts: 2 },
  },
  {
    id: "r2",
    label: "Reference",
    value: "reference",
    createdBy: "u1",
    _count: { jobContacts: 0 },
  },
];

describe("ContactRolesContainer", () => {
  const user = userEvent.setup({ skipHover: true });

  beforeEach(() => {
    vi.clearAllMocks();
    (getContactRoleList as any).mockResolvedValue({ data: roles, total: 2 });
  });

  it("renders each role with its link count", async () => {
    render(<ContactRolesContainer />);

    await waitFor(() =>
      expect(screen.getByText("招聘人员")).toBeInTheDocument(),
    );
    expect(screen.getByText("推荐证明人")).toBeInTheDocument();
  });

  it("blocks deleting a role that is in use, without calling the action", async () => {
    render(<ContactRolesContainer />);
    await waitFor(() =>
      expect(screen.getByText("招聘人员")).toBeInTheDocument(),
    );

    await user.click(screen.getAllByRole("button", { name: /打开菜单/i })[0]);
    await user.click(await screen.findByText("删除"));

    expect(
      await screen.findByText(/存在关联联系人/i),
    ).toBeInTheDocument();
    expect(deleteContactRoleById).not.toHaveBeenCalled();
  });

  it("surfaces a failed delete as an error toast", async () => {
    (deleteContactRoleById as any).mockResolvedValue({
      success: false,
      message: "Role cannot be deleted",
    });
    render(<ContactRolesContainer />);
    await waitFor(() =>
      expect(screen.getByText("推荐证明人")).toBeInTheDocument(),
    );

    await user.click(screen.getAllByRole("button", { name: /打开菜单/i })[1]);
    await user.click(await screen.findByText("删除"));
    await user.click(await screen.findByRole("button", { name: "删除" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Role cannot be deleted"),
    );
  });

  it("searches roles by label", async () => {
    render(<ContactRolesContainer />);
    await waitFor(() =>
      expect(screen.getByText("招聘人员")).toBeInTheDocument(),
    );

    await user.type(screen.getByPlaceholderText("搜索角色…"), "rec");

    await waitFor(() =>
      expect(getContactRoleList).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        "rec",
      ),
    );
  });
});
