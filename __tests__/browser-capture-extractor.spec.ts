import { describe, expect, it } from "vitest";
import { extractJobDraft } from "@/../companions/browser-extension/src/extractor";

type FakeDocument = Parameters<typeof extractJobDraft>[0];

function page(overrides: Partial<FakeDocument> = {}): FakeDocument {
  return {
    title: "软件工程师 - 示例科技",
    url: "https://jobs.example.test/detail/123",
    meta: {
      "og:title": "软件工程师 - 示例科技",
      "og:site_name": "示例科技",
      description: "负责服务端开发与技术协作",
    },
    headings: ["软件工程师 - 示例科技"],
    text: "软件工程师\n示例科技\n北京\n负责服务端开发与技术协作\n任职要求：熟悉 TypeScript",
    ...overrides,
  };
}

describe("browser job capture extractor", () => {
  it("prefers page metadata and splits a common title into company and role", () => {
    expect(extractJobDraft(page())).toMatchObject({
      title: "软件工程师",
      company: "示例科技",
      description: "负责服务端开发与技术协作",
      location: "北京",
      sourceUrl: "https://jobs.example.test/detail/123",
    });
  });

  it("uses heading and visible text when metadata is absent", () => {
    expect(extractJobDraft(page({
      title: "后端开发工程师 | 上海云厂",
      meta: {},
      headings: ["后端开发工程师 | 上海云厂"],
      text: "后端开发工程师 | 上海云厂\n工作地点：上海\n参与支付系统建设。",
    }))).toMatchObject({
      title: "后端开发工程师",
      company: "上海云厂",
      location: "上海",
      description: "参与支付系统建设。",
    });
  });

  it("reports missing fields and caps noisy body text", () => {
    const result = extractJobDraft(page({
      title: "职位详情",
      meta: {},
      headings: [],
      text: "职位详情\n" + "x".repeat(20000),
    }));
    expect(result.title).toBe("职位详情");
    expect(result.company).toBe("");
    expect(result.location).toBe("");
    expect(result.description.length).toBeLessThanOrEqual(12000);
    expect(result.missing).toEqual(["company", "location"]);
  });
});
