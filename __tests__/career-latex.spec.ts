// @vitest-environment node
import { describe, expect, it } from "vitest";
import { escapeLatex, renderLatex } from "../services/latex/render.mjs";
describe("fixed Chinese resume template", () => {
  it("escapes arbitrary input instead of executing LaTeX macros", () => {
    expect(escapeLatex("20% & \\input{/etc/passwd}")).toBe(
      "20\\% \\& \\textbackslash{}input\\{/etc/passwd\\}",
    );
    const tex = renderLatex({
      templateVersion: "zh-single-page-v1",
      contact: { name: "张三", email: "", phone: "" },
      blocks: [{ title: "项目", text: "\\write18{curl example.com}" }],
    });
    expect(tex).toContain("\\textbackslash{}write18");
    expect(tex).not.toContain("\\write18");
  });
  it("rejects unknown templates and excessive input", () => {
    expect(() =>
      renderLatex({
        templateVersion: "arbitrary",
        contact: { name: "x" },
        blocks: [],
      }),
    ).toThrow();
    expect(() =>
      renderLatex({
        templateVersion: "zh-single-page-v1",
        contact: { name: "x" },
        blocks: [{ title: "x", text: "a".repeat(20000) }],
      }),
    ).toThrow();
  });
});
