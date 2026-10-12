import { signup, authenticate } from "@/actions/auth.actions";
import SignupForm from "@/components/auth/SignupForm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";

// Mock the external dependencies
vi.mock("@/actions/auth.actions", () => ({
  signup: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("SignupForm Component", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    (useRouter as any).mockReturnValue({ push: mockPush });
    render(<SignupForm />);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the SignupForm component correctly", () => {
    expect(screen.getByLabelText("姓名")).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /注册账号/ }),
    ).toBeInTheDocument();
  });

  it("should display invalid name error when name is too short", async () => {
    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "A" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(
        screen.getByText("姓名至少需要 2 个字符。"),
      ).toBeInTheDocument();
    });
  });

  it("should display invalid email error when email format is incorrect", async () => {
    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "invalid-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(
        screen.getByText("请输入有效的邮箱地址。"),
      ).toBeInTheDocument();
    });
  });

  it("should display email minimum length error", async () => {
    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "a@" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(
        screen.getByText("邮箱至少需要 3 个字符。"),
      ).toBeInTheDocument();
    });
  });

  it("should display password minimum length error", async () => {
    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "short" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(
        screen.getByText("密码至少需要 6 个字符。"),
      ).toBeInTheDocument();
    });
  });

  it("should display error message when signup fails", async () => {
    const errorMessage = "An account with this email already exists.";
    (signup as any).mockResolvedValueOnce({ error: errorMessage });

    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(screen.getByText("该邮箱已注册，请直接登录。")).toBeInTheDocument();
    });
    expect(signup).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("should display error message when authentication fails after signup", async () => {
    const authError = "Something went wrong.";
    (signup as any).mockResolvedValueOnce({ success: true });
    (authenticate as any).mockResolvedValueOnce(authError);

    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(screen.getByText("操作失败，请稍后重试。")).toBeInTheDocument();
    });
    expect(signup).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("submits the form successfully and redirects to dashboard", async () => {
    (signup as any).mockResolvedValueOnce({ success: true });
    (authenticate as any).mockResolvedValueOnce(null);

    fireEvent.change(screen.getByLabelText("姓名"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /注册账号/ }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      });
      expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
