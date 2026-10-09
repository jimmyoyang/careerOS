import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DraftReview } from "@/components/career/DraftReview";

const bullet = {
  bulletKey: "b1",
  original: "完成 3 个接口",
  proposed: "完成 3 个接口",
  reason: "保留已确认事实",
  requirementKeys: [],
  evidence: [{ evidenceKey: "e1", revision: 1, contentHash: "hash" }],
  verification: "needs_review" as const,
};

describe("CareerOS draft review", () => {
  it("requires review of every bullet and a name before allowing PDF compilation", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <DraftReview
        draft={{
          schemaVersion: 1,
          inputHash: "hash",
          model: "verbatim",
          bullets: [bullet],
        }}
        busy={false}
        onCompile={submit}
        onUpload={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "生成 PDF" })).toBeDisabled();
    await user.type(screen.getByLabelText("姓名"), "张三");
    await user.click(screen.getByRole("button", { name: "采纳此条" }));
    await user.click(screen.getByRole("button", { name: "生成 PDF" }));
    expect(submit).toHaveBeenCalledWith(
      [expect.objectContaining({ verification: "accepted" })],
      { name: "张三", email: "", phone: "" },
    );
  });
});

it("requires fresh review after editing an accepted statement", async () => {
  const user = userEvent.setup();
  render(
    <DraftReview
      draft={{
        schemaVersion: 1,
        inputHash: "hash",
        model: "verbatim",
        bullets: [{ ...bullet, verification: "accepted" }],
      }}
      busy={false}
      onCompile={vi.fn()}
      onUpload={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("姓名"), "张三");
  expect(screen.getByRole("button", { name: "生成 PDF" })).toBeEnabled();
  await user.type(screen.getByLabelText("建议表述 1"), "，完成测试");
  expect(screen.getByRole("button", { name: "生成 PDF" })).toBeDisabled();
  expect(screen.getByText("待复核", { exact: true })).toBeVisible();
});
