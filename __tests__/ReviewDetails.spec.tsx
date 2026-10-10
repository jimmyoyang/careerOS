import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { format } from "date-fns";
import { ReviewDetails } from "@/components/profile/ReviewDetails";
import type { ResumeReviewData } from "@/models/ai.schemas";

vi.mock("@/components/TipTapContentViewer", () => ({
  TipTapContentViewer: ({ content }: { content: string }) => (
    <div data-testid="tiptap-content" dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const reviewData: ResumeReviewData = {
  overall: 85,
  impact: 80,
  clarity: 82,
  atsCompatibility: 78,
  body: "## Summary\nGreat resume overall",
  reviewedAt: "2026-07-01T10:30:00.000Z",
  provider: "openai",
  model: "gpt-4o",
};

describe("ReviewDetails", () => {
  it("renders nothing when reviewData is null", () => {
    const { container } = render(<ReviewDetails reviewData={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the compact score summary and metadata line", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    expect(screen.getByText("成果影响力")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("表达清晰度")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("ATS")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    const date = format(
      new Date(reviewData.reviewedAt!),
      "yyyy年M月d日 HH:mm",
    );
    expect(screen.getByText(`评估时间 ${date}`)).toBeInTheDocument();
    expect(screen.getByText("使用 openai / gpt-4o")).toBeInTheDocument();
  });

  it("shows a 'via <agent>' badge for an MCP-sourced review instead of the provider text", () => {
    render(
      <ReviewDetails
        reviewData={{ ...reviewData, provider: "mcp", model: "my-agent-token" }}
      />,
    );
    expect(screen.getByText(/通过 my-agent-token/)).toBeInTheDocument();
    expect(screen.queryByText(/使用/)).not.toBeInTheDocument();
  });

  it("hides the full markdown body by default", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    expect(screen.queryByTestId("tiptap-content")).not.toBeInTheDocument();
    expect(screen.getByText("查看完整评估")).toBeInTheDocument();
  });

  it("expands to reveal the full markdown body when the toggle is clicked", () => {
    render(<ReviewDetails reviewData={reviewData} />);
    fireEvent.click(screen.getByText("查看完整评估"));
    expect(screen.getByTestId("tiptap-content")).toHaveTextContent(
      "Great resume overall",
    );
    expect(screen.getByText("收起完整评估")).toBeInTheDocument();
  });
});
