import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileContainer from "@/components/profile/ProfileContainer";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock("@/actions/profile.actions", () => ({
  getResumeList: vi.fn(() =>
    Promise.resolve({
      data: [],
      total: 0,
      success: true,
      message: "",
    }),
  ),
  getDefaultResumeId: vi.fn(() => Promise.resolve(null)),
  getDefaultContactInfo: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/actions/coverLetter.actions", () => ({
  getCoverLetterList: vi.fn(() =>
    Promise.resolve({
      data: [],
      total: 0,
      success: true,
      message: "",
    }),
  ),
}));

describe("ProfileContainer Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await act(async () => {
      render(<ProfileContainer />);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it("should render the profile container component", () => {
    expect(screen.getByRole("heading", { name: "简历中心" })).toBeInTheDocument();
  });
  it("opens resume creation directly from the empty state", async () => {
    await userEvent.click(screen.getByRole("button", { name: "创建或导入简历" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should open the create resume dialog upon clicking create resume button", async () => {
    const user = userEvent.setup();

    const newButton = screen.getByRole("button", {
      name: /新建/i,
    });
    await user.click(newButton);

    const addResumeItem = await screen.findByRole("menuitem", { name: "新建简历" });
    await user.click(addResumeItem);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /创建简历/i }),
    ).toBeInTheDocument();
  });
});
