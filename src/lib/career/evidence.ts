import { randomUUID } from "node:crypto";
import { z } from "zod";
import db from "@/lib/db";
import {
  FactsSchema,
  type EvidenceSnapshot,
  PreferencesSchema,
  type Preferences,
} from "./contracts";
import { hash } from "./hash";
import { CareerError } from "./errors";
import { transaction } from "./transaction";
import { assertNoMaintenance } from "./maintenance";
import { event } from "./audit";

const RevisionSchema = z.object({
  evidenceKey: z.string().optional(),
  expectedRevision: z.number().int().nonnegative().default(0),
  kind: z.enum(["education", "experience", "project", "skill", "other"]),
  title: z.string().trim().min(1).max(200),
  facts: FactsSchema,
  status: z.enum(["draft", "confirmed", "withdrawn"]),
  source: z.string().max(2000).default(""),
});
export async function reviseEvidence(
  userId: string,
  input: z.input<typeof RevisionSchema>,
) {
  const data = RevisionSchema.parse(input);
  return transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const latest = data.evidenceKey
      ? await tx.careerEvidence.findFirst({
          where: { userId, evidenceKey: data.evidenceKey },
          orderBy: { revision: "desc" },
        })
      : null;
    if (data.evidenceKey && !latest)
      throw new CareerError("NOT_FOUND", "找不到该事实。");
    if ((latest?.revision ?? 0) !== data.expectedRevision)
      throw new CareerError("STALE_INPUT", "事实已更新，请刷新后重新确认。");
    const evidenceKey = latest?.evidenceKey ?? randomUUID();
    const contentHash = hash({
      kind: data.kind,
      title: data.title,
      facts: data.facts,
    });
    const row = await tx.careerEvidence.create({
      data: {
        userId,
        evidenceKey,
        revision: data.expectedRevision + 1,
        kind: data.kind,
        title: data.title,
        factsJson: JSON.stringify(data.facts),
        protectedPathsJson: JSON.stringify({
          schemaVersion: 1,
          values: data.facts.protectedValues,
        }),
        sourceJson: JSON.stringify({ schemaVersion: 1, text: data.source }),
        status: data.status,
        contentHash,
        confirmedAt: data.status === "confirmed" ? new Date() : null,
      },
    });
    await event(tx, userId, `evidence_${data.status}`, {
      evidenceKey,
      revision: row.revision,
      contentHash,
    });
    return row;
  });
}
export async function latestEvidence(userId: string, client = db) {
  const rows = await client.careerEvidence.findMany({
    where: { userId },
    orderBy: { revision: "desc" },
  });
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.evidenceKey)) return false;
    seen.add(row.evidenceKey);
    return true;
  });
}
export async function confirmedEvidence(
  userId: string,
): Promise<EvidenceSnapshot[]> {
  return (await latestEvidence(userId))
    .filter((row) => row.status === "confirmed")
    .map((row) => ({
      evidenceKey: row.evidenceKey,
      revision: row.revision,
      contentHash: row.contentHash,
      kind: row.kind,
      title: row.title,
      facts: FactsSchema.parse(JSON.parse(row.factsJson)),
    }));
}
export async function getPreferences(userId: string) {
  const settings = await db.userSettings.findUnique({ where: { userId } });
  return PreferencesSchema.parse(
    JSON.parse(settings?.settings ?? "{}").career ?? {},
  );
}
export async function savePreferences(userId: string, input: Preferences) {
  const preferences = PreferencesSchema.parse(input);
  await transaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const existing = await tx.userSettings.findUnique({ where: { userId } });
    const settings = JSON.stringify({
      ...JSON.parse(existing?.settings ?? "{}"),
      career: preferences,
    });
    await tx.userSettings.upsert({
      where: { userId },
      update: { settings },
      create: { userId, settings },
    });
  });
  return preferences;
}
export async function resumeCandidates(userId: string, resumeId: string) {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, profile: { userId } },
    include: {
      ResumeSections: {
        include: {
          workExperiences: { include: { Company: true, jobTitle: true } },
          educations: true,
          skills: { include: { Tag: true } },
          others: true,
          summary: true,
        },
      },
    },
  });
  if (!resume) throw new CareerError("NOT_FOUND", "找不到该简历。");
  const clean = (s: string) =>
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const candidates: Array<{
    kind: "education" | "experience" | "project" | "skill" | "other";
    title: string;
    facts: z.infer<typeof FactsSchema>;
    source: string;
  }> = [];
  for (const section of resume.ResumeSections) {
    for (const row of section.workExperiences) {
      const dates = `${row.startDate.toISOString().slice(0, 10)} — ${row.endDate?.toISOString().slice(0, 10) ?? "至今"}`;
      candidates.push({
        kind: "experience",
        title: `${row.Company.label} · ${row.jobTitle.label}`,
        facts: {
          schemaVersion: 1,
          text: `${row.Company.label}，${row.jobTitle.label}，${dates}。${clean(row.description)}`,
          tags: [],
          protectedValues: [
            row.Company.label,
            row.jobTitle.label,
            ...dates.split(" — "),
          ],
        },
        source: resume.title,
      });
    }
    for (const row of section.educations)
      candidates.push({
        kind: "education",
        title: row.institution,
        facts: {
          schemaVersion: 1,
          text: `${row.institution}，${row.degree}，${row.fieldOfStudy}。${row.startDate.toISOString().slice(0, 10)} — ${row.endDate?.toISOString().slice(0, 10) ?? "至今"}。${clean(row.description ?? "")}`,
          tags: [],
          protectedValues: [
            row.institution,
            row.degree,
            row.fieldOfStudy,
          ].filter(Boolean),
        },
        source: resume.title,
      });
    for (const row of section.skills)
      candidates.push({
        kind: "skill",
        title: row.Tag.label,
        facts: {
          schemaVersion: 1,
          text: row.Tag.label,
          tags: [row.Tag.label],
          protectedValues: [],
        },
        source: resume.title,
      });
    for (const row of section.others)
      candidates.push({
        kind: "project",
        title: row.title,
        facts: {
          schemaVersion: 1,
          text: `${row.title}。${clean(row.content)}`,
          tags: [],
          protectedValues: [row.title],
        },
        source: resume.title,
      });
  }
  return candidates;
}
