// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseJd, parseImportTable, postingKey } from "@/lib/career/parsing";
import { analyzeMatch, validateTailoring } from "@/lib/career/matching";
import { hash } from "@/lib/career/hash";

const evidence = [
  {
    evidenceKey: "project",
    revision: 1,
    contentHash: "abc",
    kind: "project",
    title: "搜索项目",
    facts: {
      schemaVersion: 1 as const,
      text: "使用 Python 完成检索，延迟降低 20%。",
      tags: ["Python"],
      protectedValues: ["20%"],
    },
  },
];
describe("Career evidence and source boundaries", () => {
  it("retains exact UTF-16 source offsets for Chinese JD", () => {
    const raw = "🚀 招聘\n要求本科及以上学历\n熟悉 Python\n每周至少出勤4天";
    const parsed = parseJd(raw);
    expect(parsed.items.length).toBeGreaterThan(2);
    for (const item of parsed.items) {
      expect(raw.slice(item.source.start, item.source.end)).toBe(
        item.source.quote,
      );
      expect(item.source.rawJdHash).toBe(hash(raw));
    }
  });
  it("does not interpret absent eligibility data as passed", () => {
    const match = analyzeMatch(
      parseJd("本科及以上学历\n2027届毕业生\n每周至少4天"),
      evidence,
      {},
    );
    expect(
      match.requirements
        .filter((r) => r.mandatory)
        .every((r) => r.eligibility === "unknown"),
    ).toBe(true);
    expect(match.recommendation).toBe("review");
  });
  it("fails a confirmed attendance gate without inventing a score", () => {
    const match = analyzeMatch(parseJd("每周至少4天"), evidence, {
      daysPerWeek: 3,
    });
    expect(match.requirements[0].eligibility).toBe("fail");
    expect(match.recommendation).toBe("not_recommended");
    expect(match).not.toHaveProperty("score");
  });
  it("rejects invented numbers and evidence references", () => {
    const bullet = {
      bulletKey: "a",
      original: evidence[0].facts.text,
      proposed: "使用 Python 将延迟降低 50%。",
      reason: "简洁",
      requirementKeys: [],
      evidence: [{ evidenceKey: "project", revision: 1, contentHash: "abc" }],
      verification: "needs_review" as const,
    };
    expect(() => validateTailoring([bullet], evidence)).toThrow();
    expect(() =>
      validateTailoring(
        [
          {
            ...bullet,
            proposed: bullet.original,
            evidence: [
              { evidenceKey: "foreign", revision: 1, contentHash: "abc" },
            ],
          },
        ],
        evidence,
      ),
    ).toThrow();
  });
  it("keeps unknown batches separate and includes known cohort in identities", () => {
    expect(
      postingKey({
        platform: "huawei",
        recruitmentType: "campus",
        cohort: "",
        postingId: "123",
      }),
    ).toBeNull();
    expect(
      postingKey({
        platform: "huawei",
        recruitmentType: "campus",
        cohort: "2027",
        postingId: "123",
      }),
    ).not.toBe(
      postingKey({
        platform: "huawei",
        recruitmentType: "campus",
        cohort: "2026",
        postingId: "123",
      }),
    );
  });
  it("parses quoted CSV and TSV without guessing missing deadlines", () => {
    const rows = parseImportTable('公司,岗位,JD\n示例,工程师,"第一行\n第二行"');
    expect(rows[0]).toMatchObject({
      company: "示例",
      title: "工程师",
      rawJd: "第一行\n第二行",
      dueDate: "",
    });
    expect(
      parseImportTable("company\ttitle\tjd\nExample\tEngineer\tPython")[0]
        .title,
    ).toBe("Engineer");
  });
});

it("never lets semantic suggestions override unknown hard gates or cite foreign evidence", async () => {
  const { applySemanticAssessments } = await import("@/lib/career/matching");
  const requirements = parseJd("本科及以上学历\n熟悉 Python");
  const baseline = analyzeMatch(requirements, evidence, {});
  const suggestion = {
    direction: "high" as const,
    assessments: [
      {
        requirementKey: "r1",
        reason: "具备学历",
        eligibility: "pass" as const,
        evidence: [evidence[0]],
      },
    ],
  };
  expect(
    applySemanticAssessments(baseline, requirements, evidence, suggestion)
      .requirements[0].eligibility,
  ).toBe("unknown");
  expect(() =>
    applySemanticAssessments(baseline, requirements, evidence, {
      ...suggestion,
      assessments: [
        {
          ...suggestion.assessments[0],
          evidence: [
            { evidenceKey: "foreign", revision: 1, contentHash: "abc" },
          ],
        },
      ],
    }),
  ).toThrow();
});
