import AddContact from "@/components/AddContact";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContact, updateContact } from "@/actions/contact.actions";

vi.mock("@/actions/contact.actions", () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastActionResult: vi.fn((res, opts) => res?.success && opts?.onSuccess?.()),
}));

const props = {
  reloadContacts: vi.fn(),
  resetEditContact: vi.fn(),
  dialogOpen: true,
  setDialogOpen: vi.fn(),
  companies: [{ id: "co1", label: "Shopify", value: "shopify", createdBy: "u1" }],
  locations: [{ id: "l1", label: "Toronto, ON", value: "toronto on", createdBy: "u1" }],
  roles: [
    { id: "r1", label: "Reference", value: "reference", createdBy: "u1" },
    { id: "r2", label: "Recruiter", value: "recruiter", createdBy: "u1" },
  ],
} as any;

// jsdom lacks scrollIntoView, which cmdk calls when selecting an item
Element.prototype.scrollIntoView = vi.fn();

describe("AddContact", () => {
  const user = userEvent.setup({ skipHover: true });
  beforeEach(() => vi.clearAllMocks());

  it("saves a contact with just a name", async () => {
    (createContact as any).mockResolvedValue({ success: true, data: { id: "c1" } });

    render(<AddContact {...props} />);
    await user.type(screen.getByLabelText("姓名"), "Dave Patel");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Dave Patel" }),
      ),
    );
  });

  it("blocks a save with no name", async () => {
    render(<AddContact {...props} />);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText(/联系人姓名不能为空/)).toBeInTheDocument();
    expect(createContact).not.toHaveBeenCalled();
  });

  it("prefills the name when asked", () => {
    render(<AddContact {...props} prefillName="Priya" />);
    expect(screen.getByLabelText("姓名")).toHaveValue("Priya");
  });

  it("prefills the company when asked", () => {
    render(<AddContact {...props} prefillCompanyId="co1" />);
    expect(
      screen.getByRole("combobox", { name: "公司" }),
    ).toHaveTextContent("Shopify");
  });

  it("saves the prefilled company with the new contact", async () => {
    (createContact as any).mockResolvedValue({ success: true, data: { id: "c1" } });

    render(<AddContact {...props} prefillCompanyId="co1" />);
    await user.type(screen.getByLabelText("姓名"), "Dave Patel");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(createContact).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Dave Patel", company: "co1" }),
      ),
    );
  });

  it("ignores the company prefill when editing", () => {
    render(
      <AddContact
        {...props}
        prefillCompanyId="co1"
        editContact={{ id: "c1", name: "Dave Patel", companyId: null } as any}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "公司" }),
    ).toHaveTextContent("选择公司");
  });

  it("starts from the prefill again each time the dialog reopens", async () => {
    const { rerender } = render(
      <AddContact {...props} hideTrigger prefillCompanyId="co1" />,
    );
    await user.type(screen.getByLabelText("姓名"), "Half typed");

    rerender(<AddContact {...props} hideTrigger prefillCompanyId="co1" dialogOpen={false} />);
    rerender(<AddContact {...props} hideTrigger prefillCompanyId="co1" dialogOpen />);

    expect(screen.getByLabelText("姓名")).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: "公司" }),
    ).toHaveTextContent("Shopify");
  });

  it("updates instead of creating when editing", async () => {
    (updateContact as any).mockResolvedValue({ success: true, data: { id: "c1" } });

    render(
      <AddContact
        {...props}
        editContact={{ id: "c1", name: "Dave Patel" } as any}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c1", name: "Dave Patel" }),
      ),
    );
    expect(createContact).not.toHaveBeenCalled();
  });

  it("carries the standing role through to the action", async () => {
    (updateContact as any).mockResolvedValue({ success: true, data: { id: "c1" } });

    render(
      <AddContact
        {...props}
        editContact={{ id: "c1", name: "Dave Patel", roleId: "r1" } as any}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactRole: "r1" }),
      ),
    );
  });

  it("hides the shared-history fields until the role is Reference", () => {
    render(<AddContact {...props} />);

    expect(screen.queryByText("联系背景")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("关系")).not.toBeInTheDocument();
    expect(screen.queryByText("共事公司")).not.toBeInTheDocument();
  });

  it("shows the shared-history fields for a Reference contact", () => {
    render(
      <AddContact
        {...props}
        editContact={{ id: "c1", name: "Dave Patel", roleId: "r1" } as any}
      />,
    );

    expect(screen.getByText("联系背景")).toBeInTheDocument();
    expect(screen.getByLabelText("关系")).toBeInTheDocument();
    expect(screen.getByText("共事公司")).toBeInTheDocument();
  });

  it("clears the shared history when the role moves off Reference", async () => {
    (updateContact as any).mockResolvedValue({ success: true, data: { id: "c1" } });

    render(
      <AddContact
        {...props}
        editContact={
          {
            id: "c1",
            name: "Dave Patel",
            roleId: "r1",
            relationship: "my manager",
          } as any
        }
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "角色" }));
    await user.click(await screen.findByRole("option", { name: "招聘人员" }));

    expect(screen.queryByLabelText("关系")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactRole: "r2", relationship: "" }),
      ),
    );
  });

  it("hands the saved contact back to the caller", async () => {
    (createContact as any).mockResolvedValue({ success: true, data: { id: "c9" } });
    const onSaved = vi.fn();

    render(<AddContact {...props} onSaved={onSaved} />);
    await user.type(screen.getByLabelText("姓名"), "Priya Nair");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({
        id: "c9",
        label: "Priya Nair",
        value: "priya nair",
      }),
    );
  });
});
