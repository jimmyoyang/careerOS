// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { Font } from "@react-pdf/renderer";
import { extractText, extractTextItems } from "unpdf";
import { generateResumePdfBlob } from "@/components/profile/resume-pdf/generateResumePdf";
import { generateCoverLetterPdfBlob } from "@/components/profile/cover-letter-pdf/generateCoverLetterPdf";
import { defaultResumeExportSettings } from "@/models/resumeExport.model";
import { defaultCoverLetterExportSettings } from "@/models/coverLetterExport.model";
import { SectionType, type ContactInfo, type Resume } from "@/models/profile.model";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new () => { window: { DOMParser: typeof DOMParser; close: () => void } };
};
const dom = new JSDOM();
const contact = {
  firstName: "小明",
  lastName: "张",
  headline: "软件工程师",
  email: "zhang@example.com",
} as ContactInfo;
const resume: Resume = {
  title: "中文简历",
  ContactInfo: contact,
  ResumeSections: [{
    resumeId: "resume-1",
    sectionType: SectionType.SUMMARY,
    sectionTitle: "个人简介",
    summary: { content: "<p>熟悉系统设计与团队协作，保留 English 内容。</p>" },
  }],
};

beforeAll(() => {
  vi.stubGlobal("DOMParser", dom.window.DOMParser);
  const register = Font.register.bind(Font);
  // Resolve the bundled browser URL to the same file for the Node renderer.
  vi.spyOn(Font, "register").mockImplementation((source) => register({
    ...source,
    src: path.resolve("public/fonts/NotoSansSC-Regular.ttf"),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  dom.window.close();
});

async function pdfText(blob: Blob) {
  const result = await extractText(new Uint8Array(await blob.arrayBuffer()), {
    mergePages: true,
  });
  return result.text.replace(/\s+/g, "");
}

describe("Chinese PDF export with the bundled font", () => {
  it.each(["simple", "professional"] as const)(
    "preserves Chinese and English text in the %s resume template",
    async (template) => {
      const { blob } = await generateResumePdfBlob(resume, {
        ...defaultResumeExportSettings,
        template,
      });
      const text = await pdfText(blob);
      expect(text).toContain("小明张");
      if (template === "simple") expect(text).toContain("个人简介");
      expect(text).toContain("熟悉系统设计与团队协作，保留English内容。");
    },
  );

  it.each(["simple", "professional"] as const)("omits legacy and localized empty locations in %s", async (template) => {
    const withExperience = { ...resume, ResumeSections: [{ resumeId: "resume-1", sectionType: SectionType.EXPERIENCE, sectionTitle: "工作经历", workExperiences: ["Not specified", "未填写", "上海"].map((label) => ({ jobTitle: { label: "工程师" }, Company: { label: "测试公司" }, location: { label }, startDate: new Date("2024-01-01"), description: "<p>开发业务系统</p>" })) }] } as Resume;
    const { blob } = await generateResumePdfBlob(withExperience, { ...defaultResumeExportSettings, template });
    const text = await pdfText(blob);
    expect(text).not.toContain("Notspecified");
    expect(text).not.toContain("未填写");
    expect(text).toContain("上海");
  });

  it("preserves Chinese in the cover letter and its generated date", async () => {
    const { blob } = await generateCoverLetterPdfBlob(
      { title: "中文求职信", content: "<p>您好，希望应聘软件工程师岗位。</p>" },
      contact,
      defaultCoverLetterExportSettings,
    );
    const text = await pdfText(blob);
    expect(text).toContain("软件工程师");
    expect(text).toContain("您好，希望应聘软件工程师岗位。");
    expect(text).toMatch(/\d{4}年\d{1,2}月\d{1,2}日/);
  });

  it("wraps long Chinese paragraphs within the PDF page", async () => {
    const content = "熟悉系统设计与团队协作，能够独立完成需求分析和软件开发。".repeat(12);
    const { blob } = await generateCoverLetterPdfBlob(
      { title: "中文求职信", content: `<p>${content}</p>` },
      null,
      defaultCoverLetterExportSettings,
    );
    const { items } = await extractTextItems(new Uint8Array(await blob.arrayBuffer()));
    const text = items.flat();
    expect(text.map((item) => item.str).join("").replace(/\s+/g, "")).toContain(content);
    expect(text.every((item) => item.x + item.width <= 595.28)).toBe(true);
  });
});
