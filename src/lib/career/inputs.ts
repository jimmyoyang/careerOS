import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { resumeDetailInclude } from "@/lib/jobs/resumeDetailInclude";
import { RequirementsSchema } from "./contracts";
import { confirmedEvidence, getPreferences } from "./evidence";
import { CareerError } from "./errors";
import { hash } from "./hash";
import { ownedJob } from "./access";

// Database IDs are remapped on restore; only editable content belongs in a digest.
function resumeContent(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value
      .map(resumeContent)
      .sort((a, b) => hash(a).localeCompare(hash(b)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "id",
              "createdBy",
              "createdAt",
              "updatedAt",
              "filePath",
              "fileType",
              "reviewData",
            ].includes(key) && !key.endsWith("Id"),
        )
        .map(([key, item]) => [key, resumeContent(item)]),
    );
  return value;
}
export async function currentInputs(
  userId: string,
  jobId: string,
  tx: Prisma.TransactionClient = db,
) {
  const job = await ownedJob(userId, jobId, tx);
  const context = job.careerContext;
  if (!context) throw new CareerError("NOT_FOUND", "请先将岗位加入求职准备。");
  const evidence = await confirmedEvidence(userId, tx);
  evidence.sort((a, b) => a.evidenceKey.localeCompare(b.evidenceKey));
  const preferences = await getPreferences(userId, tx);
  const resume = job.resumeId
    ? await tx.resume.findFirst({
        where: { id: job.resumeId, profile: { userId } },
        include: {
          ...resumeDetailInclude,
          ResumeSections: {
            include: {
              ...resumeDetailInclude.ResumeSections.include,
              others: true,
            },
          },
        },
      })
    : null;
  const snapshot = {
    schemaVersion: 1 as const,
    rawJd: context.rawJd,
    rawJdHash: context.rawJdHash,
    contextVersion: context.version,
    requirements: RequirementsSchema.parse(
      JSON.parse(context.requirementsJson),
    ),
    evidence,
    preferences,
    company: job.Company.label,
    title: job.JobTitle.label,
    location: job.Location?.label ?? "",
    url: job.jobUrl ?? "",
    dueDate: job.dueDate?.toISOString() ?? null,
    sourceResumeHash: resume ? hash(resumeContent(resume)) : null,
    platform: context.platform,
    recruitmentType: context.recruitmentType,
    cohort: context.cohort,
    postingKey: context.postingKey,
    sources: JSON.parse(context.sourcesJson),
    referral: JSON.parse(
      context.referralJson ?? '{"schemaVersion":1,"value":""}',
    ),
  };
  return { snapshot, inputHash: hash(snapshot) };
}
export type CareerInputs = Awaited<ReturnType<typeof currentInputs>>;
