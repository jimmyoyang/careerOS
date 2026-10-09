import {
  type Bullet,
  type EvidenceSnapshot,
  type Match,
  type Preferences,
  type Requirements,
  PreferencesSchema,
} from "./contracts";
import { CareerError } from "./errors";
import { hash } from "./hash";

export function analyzeMatch(
  requirements: Requirements,
  evidence: EvidenceSnapshot[],
  input: Preferences,
): Match {
  const prefs = PreferencesSchema.parse(input);
  const ranks = { associate: 1, bachelor: 2, master: 3, doctor: 4 };
  const assessments: Match["requirements"] = requirements.items.map((r) => {
    let eligibility: "pass" | "fail" | "unknown" = "unknown";
    let reason = "没有足够的已确认信息，请核对原文。";
    const refs = evidence
      .filter((e) =>
        e.facts.tags.some((tag) =>
          r.text.toLowerCase().includes(tag.toLowerCase()),
        ),
      )
      .map(({ evidenceKey, revision, contentHash }) => ({
        evidenceKey,
        revision,
        contentHash,
      }));
    if (r.field === "degree" && prefs.degree) {
      eligibility =
        ranks[prefs.degree] >= ranks[r.value as keyof typeof ranks]
          ? "pass"
          : "fail";
      reason = "按已确认学历与原文学历要求比较。";
    } else if (["graduationYear", "daysPerWeek", "months"].includes(r.field)) {
      const actual =
        prefs[r.field as "graduationYear" | "daysPerWeek" | "months"];
      if (actual !== undefined && typeof r.value === "number") {
        eligibility = (
          r.field === "graduationYear" ? actual === r.value : actual >= r.value
        )
          ? "pass"
          : "fail";
        reason = `已确认值 ${actual}；原文要求 ${r.value}。`;
      }
    }
    if (refs.length && eligibility === "unknown")
      reason =
        "找到相关事实，能力程度与全部要求仍需核对；关键词命中不代表满足要求。";
    return {
      requirementKey: r.key,
      mandatory: r.mandatory,
      eligibility,
      reason,
      source: r.source,
      evidence: refs,
    };
  });
  const unknown = assessments.filter((r) => r.eligibility === "unknown");
  const failed = assessments.some(
    (r) => r.mandatory && r.eligibility === "fail",
  );
  const hasRelated = assessments.some((r) => r.evidence.length);
  return {
    schemaVersion: 1,
    inputHash: hash({ requirements, evidence, prefs }),
    direction: hasRelated ? "medium" : "unknown",
    recommendation: failed
      ? "not_recommended"
      : unknown.length
        ? "review"
        : "recommended",
    requirements: assessments,
    informationQuality:
      unknown.length === assessments.length
        ? "insufficient"
        : unknown.length
          ? "partial"
          : "complete",
    unresolvedFields: unknown.map((r) => r.requirementKey),
  };
}

export function validateTailoring(
  bullets: Bullet[],
  evidence: EvidenceSnapshot[],
): void {
  for (const bullet of bullets) {
    const sources = bullet.evidence.map((ref) =>
      evidence.find(
        (e) =>
          e.evidenceKey === ref.evidenceKey &&
          e.revision === ref.revision &&
          e.contentHash === ref.contentHash,
      ),
    );
    if (sources.some((e) => !e) || !sources.length)
      throw new CareerError(
        "EVIDENCE_UNCONFIRMED",
        "改写引用了无效或过期的事实。",
      );
    const original = sources.map((e) => e!.facts.text).join("\n");
    if (bullet.original !== original)
      throw new CareerError(
        "MODEL_OUTPUT_INVALID",
        "改写原文与所引用事实不一致。",
      );
    const numbers = new Set(original.match(/\d+(?:\.\d+)?\s*%?/g) ?? []);
    if (
      (bullet.proposed.match(/\d+(?:\.\d+)?\s*%?/g) ?? []).some(
        (n) => !numbers.has(n),
      )
    )
      throw new CareerError(
        "MODEL_OUTPUT_INVALID",
        "改写新增了事实中不存在的数字。",
      );
    for (const source of sources) {
      if (
        source!.facts.protectedValues.some(
          (value) =>
            original.includes(value) && !bullet.proposed.includes(value),
        )
      )
        throw new CareerError(
          "MODEL_OUTPUT_INVALID",
          "改写改变或删除了受保护的日期、名称或数值。",
        );
    }
  }
}

export function applySemanticAssessments(
  baseline: Match,
  requirements: Requirements,
  evidence: EvidenceSnapshot[],
  semantic: {
    direction: Match["direction"];
    assessments: Array<{
      requirementKey: string;
      reason: string;
      eligibility: "pass" | "unknown";
      evidence: Match["requirements"][number]["evidence"];
    }>;
  },
): Match {
  const seen = new Set<string>();
  for (const assessment of semantic.assessments) {
    if (
      seen.has(assessment.requirementKey) ||
      !requirements.items.some((r) => r.key === assessment.requirementKey)
    )
      throw new CareerError(
        "MODEL_OUTPUT_INVALID",
        "模型引用了重复或未知要求。",
      );
    seen.add(assessment.requirementKey);
    if (
      assessment.evidence.some(
        (ref) =>
          !evidence.some(
            (e) =>
              e.evidenceKey === ref.evidenceKey &&
              e.revision === ref.revision &&
              e.contentHash === ref.contentHash,
          ),
      )
    )
      throw new CareerError("EVIDENCE_UNCONFIRMED", "模型引用了无效事实。");
    if (assessment.eligibility === "pass" && !assessment.evidence.length)
      throw new CareerError(
        "MODEL_OUTPUT_INVALID",
        "满足能力要求的结论必须引用事实。",
      );
  }
  const assessed = baseline.requirements.map((original) => {
    const source = requirements.items.find(
      (r) => r.key === original.requirementKey,
    )!;
    const suggestion = semantic.assessments.find(
      (r) => r.requirementKey === original.requirementKey,
    );
    if (source.field !== "skill" || !suggestion) return original;
    return {
      ...original,
      ...suggestion,
      reason: `模型建议，仍需人工核对：${suggestion.reason}`,
    };
  });
  const unknown = assessed.filter((r) => r.eligibility === "unknown");
  return {
    ...baseline,
    direction: semantic.direction,
    requirements: assessed,
    recommendation: assessed.some(
      (r) => r.mandatory && r.eligibility === "fail",
    )
      ? "not_recommended"
      : unknown.length
        ? "review"
        : "recommended",
    informationQuality:
      unknown.length === assessed.length
        ? "insufficient"
        : unknown.length
          ? "partial"
          : "complete",
    unresolvedFields: unknown.map((r) => r.requirementKey),
  };
}
