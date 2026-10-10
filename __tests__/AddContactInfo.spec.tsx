import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddContactInfo from "@/components/profile/AddContactInfo";
import { addContactInfo, updateContactInfo } from "@/actions/profile.actions";
import { toastActionResult } from "@/lib/toast";

vi.mock("@/actions/profile.actions", () => ({
  addContactInfo: vi.fn(),
  updateContactInfo: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastActionResult: vi.fn((result, opts) => {
    if (result?.success) opts.onSuccess?.(result.data);
  }),
}));

const contactInfoToEdit = {
  id: "contact-1",
  resumeId: "resume-123",
  firstName: "Ada",
  lastName: "Lovelace",
  headline: "Software Engineer",
  email: "ada@example.com",
  phone: "555-0100",
  address: "London",
  url1: "https://linkedin.com/in/ada",
  url1Label: "LinkedIn",
  url2: null,
  url2Label: null,
};

describe("AddContactInfo Component", () => {
  const user = userEvent.setup();
  const mockResumeId = "resume-123";
  const mockSetDialogOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderNew = () =>
    render(
      <AddContactInfo
        resumeId={mockResumeId}
        dialogOpen={true}
        setDialogOpen={mockSetDialogOpen}
      />,
    );

  const renderEdit = (overrides: Record<string, unknown> = {}) =>
    render(
      <AddContactInfo
        resumeId={mockResumeId}
        dialogOpen={true}
        setDialogOpen={mockSetDialogOpen}
        contactInfoToEdit={{ ...contactInfoToEdit, ...overrides } as any}
      />,
    );

  const fillRequiredFields = async () => {
    await user.type(screen.getByLabelText("名"), "Grace");
    await user.type(screen.getByLabelText("姓"), "Hopper");
    await user.type(screen.getByLabelText("个人简介标题"), "Rear Admiral");
    await user.type(screen.getByLabelText("邮箱"), "grace@example.com");
    await user.type(screen.getByLabelText("电话"), "555-0199");
  };

  it("renders the Add title and all contact fields", async () => {
    renderNew();

    await waitFor(() => {
      expect(screen.getByText("添加联系方式")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("名")).toBeInTheDocument();
    expect(screen.getByLabelText("姓")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介标题")).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("电话")).toBeInTheDocument();
    expect(screen.getByLabelText("地址")).toBeInTheDocument();
  });

  it("renders the Edit title and populates the fields", async () => {
    renderEdit();

    await waitFor(() => {
      expect(screen.getByText("编辑联系方式")).toBeInTheDocument();
    });
    expect((screen.getByLabelText("名") as HTMLInputElement).value).toBe(
      "Ada",
    );
    expect((screen.getByLabelText("姓") as HTMLInputElement).value).toBe(
      "Lovelace",
    );
    expect((screen.getByLabelText("邮箱") as HTMLInputElement).value).toBe(
      "ada@example.com",
    );
    expect((screen.getByLabelText("电话") as HTMLInputElement).value).toBe(
      "555-0100",
    );
  });

  it("does not render the dialog when closed", () => {
    const { container } = render(
      <AddContactInfo
        resumeId={mockResumeId}
        dialogOpen={false}
        setDialogOpen={mockSetDialogOpen}
      />,
    );

    expect(screen.queryByText("添加联系方式")).not.toBeInTheDocument();
    expect(container.querySelector("form")).not.toBeInTheDocument();
  });

  it("keeps Save disabled until the form is edited", async () => {
    renderNew();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存/i })).toBeDisabled();
    });

    await user.type(screen.getByLabelText("名"), "G");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /保存/i })).not.toBeDisabled();
    });
  });

  it("closes the dialog when Cancel is clicked", async () => {
    renderNew();

    await waitFor(() => {
      expect(screen.getByText("添加联系方式")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /取消/i }));

    expect(mockSetDialogOpen).toHaveBeenCalledWith(false);
  });

  describe("second link", () => {
    it("is collapsed behind a toggle for a new contact", async () => {
      renderNew();

      await waitFor(() => {
        expect(screen.getByText("链接 1")).toBeInTheDocument();
      });
      expect(screen.queryByText("链接 2")).not.toBeInTheDocument();
      expect(screen.getByText("+ 添加另一个链接")).toBeInTheDocument();
    });

    it("expands when the toggle is clicked", async () => {
      renderNew();

      await user.click(await screen.findByText("+ 添加另一个链接"));

      await waitFor(() => {
        expect(screen.getByText("链接 2")).toBeInTheDocument();
      });
      expect(screen.queryByText("+ 添加另一个链接")).not.toBeInTheDocument();
    });

    it("starts expanded when the contact already has a second link", async () => {
      renderEdit({ url2: "https://github.com/ada", url2Label: "GitHub" });

      await waitFor(() => {
        expect(screen.getByText("链接 2")).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("https://github.com/ada")).toBeInTheDocument();
    });

    it("clears the second link values when removed", async () => {
      renderEdit({ url2: "https://github.com/ada", url2Label: "GitHub" });

      await waitFor(() => {
        expect(screen.getByText("链接 2")).toBeInTheDocument();
      });
      const removeButton = screen
        .getByText("链接 2")
        .parentElement!.querySelector("button")!;
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText("链接 2")).not.toBeInTheDocument();
      });
      expect(
        screen.queryByDisplayValue("https://github.com/ada"),
      ).not.toBeInTheDocument();
    });
  });

  describe("submission", () => {
    it("saves single-character Chinese given and family names", async () => {
      (addContactInfo as any).mockResolvedValue({ success: true });
      renderNew();
      await fillRequiredFields();
      await user.clear(screen.getByLabelText("名"));
      await user.type(screen.getByLabelText("名"), "伟");
      await user.clear(screen.getByLabelText("姓"));
      await user.type(screen.getByLabelText("姓"), "张");
      await user.click(screen.getByRole("button", { name: /保存/i }));
      await waitFor(() => expect(addContactInfo).toHaveBeenCalledWith(expect.objectContaining({ firstName: "伟", lastName: "张" })));
    });
    it("calls addContactInfo with the resume id for a new contact", async () => {
      (addContactInfo as any).mockResolvedValue({ success: true });

      renderNew();
      await fillRequiredFields();
      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(addContactInfo).toHaveBeenCalledTimes(1);
      });
      expect(addContactInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeId: mockResumeId,
          firstName: "Grace",
          lastName: "Hopper",
          headline: "Rear Admiral",
          email: "grace@example.com",
          phone: "555-0199",
        }),
      );
      expect(updateContactInfo).not.toHaveBeenCalled();
    });

    it("calls updateContactInfo with the contact id when editing", async () => {
      (updateContactInfo as any).mockResolvedValue({ success: true });

      renderEdit();
      await waitFor(() => {
        expect(
          (screen.getByLabelText("个人简介标题") as HTMLInputElement).value,
        ).toBe("Software Engineer");
      });

      const headline = screen.getByLabelText("个人简介标题");
      await user.clear(headline);
      await user.type(headline, "Principal Engineer");
      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(updateContactInfo).toHaveBeenCalledTimes(1);
      });
      expect(updateContactInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "contact-1",
          headline: "Principal Engineer",
        }),
      );
      expect(addContactInfo).not.toHaveBeenCalled();
    });

    it("closes the dialog and shows a success toast when the action succeeds", async () => {
      (addContactInfo as any).mockResolvedValue({ success: true });

      renderNew();
      await fillRequiredFields();
      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(mockSetDialogOpen).toHaveBeenCalledWith(false);
      });
      expect(toastActionResult).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ success: "联系方式已添加" }),
      );
    });

    it("shows an updated success message when editing", async () => {
      (updateContactInfo as any).mockResolvedValue({ success: true });

      renderEdit();
      const headline = await screen.findByLabelText("个人简介标题");
      await user.clear(headline);
      await user.type(headline, "Principal Engineer");
      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(toastActionResult).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ success: "联系方式已更新" }),
        );
      });
    });

    it("keeps the dialog open and shows an error toast when the action fails", async () => {
      (addContactInfo as any).mockResolvedValue({
        success: false,
        message: "Failed to create contact info.",
      });

      renderNew();
      await fillRequiredFields();
      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(toastActionResult).toHaveBeenCalledWith(
          expect.objectContaining({ success: false, message: "Failed to create contact info." }),
          expect.objectContaining({ success: "联系方式已添加" }),
        );
      });
      expect(mockSetDialogOpen).not.toHaveBeenCalledWith(false);
    });
  });

  describe("validation", () => {
    it("blocks submission and reports a malformed email", async () => {
      renderNew();
      await user.type(screen.getByLabelText("名"), "Grace");
      await user.type(screen.getByLabelText("姓"), "Hopper");
      await user.type(screen.getByLabelText("个人简介标题"), "Rear Admiral");
      await user.type(screen.getByLabelText("邮箱"), "not-an-email");
      await user.type(screen.getByLabelText("电话"), "555-0199");

      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(
          screen.getByText("请输入有效的邮箱地址。"),
        ).toBeInTheDocument();
      });
      expect(addContactInfo).not.toHaveBeenCalled();
    });

    it("blocks submission of a link without a scheme", async () => {
      renderNew();
      await fillRequiredFields();
      await user.type(
        screen.getByPlaceholderText("https://"),
        "linkedin.com/in/grace",
      );

      await user.click(screen.getByRole("button", { name: /保存/i }));

      await waitFor(() => {
        expect(
          screen.getByText("链接必须以 http:// 或 https:// 开头。"),
        ).toBeInTheDocument();
      });
      expect(addContactInfo).not.toHaveBeenCalled();
    });
  });
});
