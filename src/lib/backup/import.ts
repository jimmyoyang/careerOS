import fs from "fs/promises";
import path from "path";
import type JSZip from "jszip";
import db from "@/lib/db";
import { MaintenanceError, withMaintenanceLease, type MaintenanceLeaseGuard } from "@/lib/career/maintenance";
import { APP_CONSTANTS, CONTACT_ROLES, JOB_STAGES } from "@/lib/constants";
import { IdMap, buildCreateData } from "./idmap";
import { BackupError, openBackupZip, readManifest } from "./manifest";
import {
  checkImportedFile,
  importedFilePath,
  normalizeAutomation,
  normalizeAutomationRun,
  safeEntryName,
} from "./normalize";
import {
  DELETE_ORDER,
  EMPTINESS_MODELS,
  INSERT_ORDER,
  LOOKUP_MODELS,
  MODEL_SPECS,
  type BackupModel,
} from "./ordering";
import { writeSnapshot } from "./snapshot";
import { log } from "@/lib/telemetry";
import { isResumeFilePath } from "@/lib/resumeFiles";
import { BackupDataSchema, type BackupData, type BackupManifest } from "./schema";

export interface PreflightResult {
  manifest: BackupManifest;
  emailMatches: boolean;
  targetIsEmpty: boolean;
  targetCounts: Record<string, number>;
}

// Counts read from the target database, not from the file — the manifest is
// self-reported and cannot be allowed to size the destructive confirmation.
export async function countTargetContent(
  userId: string,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    EMPTINESS_MODELS.map(async (model) => {
      const spec = MODEL_SPECS[model];
      const delegate = (db as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[
        spec.delegate
      ];
      return [model, await delegate.count({ where: spec.scope(userId) })] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// Reads manifest.json only, writes nothing to the database and nothing to disk.
export async function preflightBackup(
  bytes: Buffer,
  userId: string,
  userEmail: string,
): Promise<PreflightResult> {
  const zip = await openBackupZip(bytes);
  const manifest = await readManifest(zip);

  if (!zip.file("data.json")) {
    throw new BackupError("Backup is missing data.json.");
  }

  const targetCounts = await countTargetContent(userId);
  const targetIsEmpty = Object.values(targetCounts).every((n) => n === 0);

  return {
    manifest,
    emailMatches: manifest.sourceEmail === userEmail,
    targetIsEmpty,
    targetCounts,
  };
}

export interface ImportResult {
  counts: Record<string, number>;
  filesWritten: number;
  // Where the previous state went, so the UI can tell the user it exists.
  snapshotPath: string | null;
}

type Tx = Record<string, Record<string, (a: unknown) => Promise<unknown>>>;

async function readData(zip: JSZip): Promise<BackupData> {
  const entry = zip.file("data.json");
  if (!entry) throw new BackupError("Backup is missing data.json.");
  let raw: unknown;
  try {
    raw = JSON.parse(await entry.async("string"));
  } catch {
    throw new BackupError("data.json is not valid JSON.");
  }
  const parsed = BackupDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackupError(
      `Backup data failed validation: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
    );
  }
  validateCareerReferences(parsed.data);
  return parsed.data;
}

function validateCareerReferences(data: BackupData): void {
  const owners = new Map<string, BackupModel>();
  for (const model of INSERT_ORDER) {
    for (const row of rowsFor(data, model)) {
      const id = row.id as string;
      if (owners.has(id)) throw new BackupError(`Duplicate backup id in ${model}.`);
      owners.set(id, model);
    }
  }
  for (const model of ["CareerJobContext", "CareerMaterial", "CareerRun"] as const) {
    for (const row of rowsFor(data, model)) {
      for (const [field, target] of Object.entries(MODEL_SPECS[model].fks)) {
        const value = row[field] as string | null;
        if (value === null) continue;
        const actual = owners.get(value);
        const optional = (model === "CareerMaterial" && field === "sourceResumeId") || model === "CareerRun";
        if (actual !== target && (actual !== undefined || !optional)) {
          throw new BackupError(`${model}.${field} does not reference a ${target} row in this backup.`);
        }
      }
    }
  }
}

// Resolved against the target's global JobStatus table, creating any the target
// lacks from the carried label/value. Runs before the transaction: it is the
// only write outside the user's own data and it is idempotent.
async function resolveJobStatuses(
  data: BackupData,
): Promise<Map<string, string>> {
  const byValue = new Map<string, string>();
  const existing = await db.jobStatus.findMany({ select: { id: true, value: true } });
  for (const row of existing) byValue.set(row.value, row.id);

  for (const status of data.jobStatuses) {
    if (byValue.has(status.value)) continue;
    const created = await db.jobStatus.create({
      data: { label: status.label, value: status.value },
    });
    byValue.set(created.value, created.id);
  }
  return byValue;
}

// Straight inserts, no upsert. The wipe on the line above deleted every lookup
// row this user owned, so there is nothing left to resolve against — an
// "existing row" check here can never match. Replace-not-merge is the point:
// post-import counts equal the manifest for every table.
async function insertLookups(
  tx: Tx,
  data: BackupData,
  idMap: IdMap,
  userId: string,
  statusByValue: Map<string, string>,
): Promise<void> {
  for (const model of LOOKUP_MODELS) {
    const spec = MODEL_SPECS[model];
    for (const row of (data as unknown as Record<string, { id: string; value: string }[]>)[model]) {
      const newId = idMap.mint(row.id);
      const { id: _old, ...rest } = row;

      // The only lookup model with a foreign key. JobStatus is global and its
      // ids differ between installs, so the file carries the value (D3).
      if (model === "JobStageType") {
        const { statusValue, ...typeRest } = rest as typeof rest & { statusValue: string };
        const statusId = statusByValue.get(statusValue);
        // Refusing beats defaulting: a wrong parent status would put the
        // derived-status invariant permanently out of step on every job.
        if (!statusId) {
          throw new BackupError(
            `Stage type "${row.value}" names status "${statusValue}", which is not in the backup.`,
          );
        }
        await tx[spec.delegate].create({
          data: { ...typeRest, id: newId, statusId, createdBy: userId },
        });
        continue;
      }

      await tx[spec.delegate].create({
        data: { ...rest, id: newId, createdBy: userId },
      });
    }
  }
}

async function wipe(tx: Tx, userId: string): Promise<void> {
  // Ownership traverses relations that the wipe itself removes. Capture IDs
  // while those relations still exist, then delete only this owner's files.
  const files = await tx.file.findMany({
    where: MODEL_SPECS.File.scope(userId), select: { id: true },
  }) as { id: string }[];
  // Null the back-reference first: User.defaultResumeId is a foreign key into
  // a table the wipe is about to empty.
  await tx.user.update({
    where: { id: userId },
    data: { defaultResumeId: null },
  });

  // Not restorable, but a conversation about deleted jobs is worse than a
  // clean panel. ApiKey and McpAccessToken are deliberately absent.
  await tx.chatConversation.deleteMany({ where: { userId } });

  for (const model of DELETE_ORDER) {
    const spec = MODEL_SPECS[model];
    const where = model === "File" ? { id: { in: files.map((file) => file.id) } } : spec.scope(userId);
    await tx[spec.delegate].deleteMany({ where });
  }
}

function rowsFor(data: BackupData, model: BackupModel): Record<string, unknown>[] {
  return (data as unknown as Record<string, Record<string, unknown>[]>)[model];
}

async function restoreBackup(
  zip: JSZip,
  manifest: BackupManifest,
  data: BackupData,
  userId: string,
  userEmail: string,
  confirmWipe: boolean,
  assertLease: MaintenanceLeaseGuard,
): Promise<ImportResult> {
  const targetCounts = await countTargetContent(userId);
  const targetIsEmpty = Object.values(targetCounts).every((n) => n === 0);
  if (!targetIsEmpty && !confirmWipe) {
    throw new BackupError(
      "This account already holds data. Confirm that you want it replaced before importing.",
    );
  }

  // The safety net, and the last thing that happens before this function is
  // able to destroy anything. The transaction below protects against a crash;
  // nothing except this protects against importing the wrong file. Skipped on
  // an empty target because there is nothing to snapshot.
  let snapshotPath: string | null = null;
  if (!targetIsEmpty) {
    snapshotPath = await writeSnapshot(userId, userEmail);
  }

  const statusByValue = await resolveJobStatuses(data);

  // Mint every non-lookup id up front so the file writes below can name their
  // targets, and so a forward reference in the FK rewrite never misses.
  const idMap = new IdMap();
  for (const model of INSERT_ORDER) {
    if (MODEL_SPECS[model].lookup) continue;
    for (const row of rowsFor(data, model)) idMap.mint(row.id as string);
  }

  // Files are written before the transaction: a failed import leaves orphaned
  // bytes (unlinked below) rather than committed rows pointing at nothing.
  const writtenPaths: string[] = [];
  const uploadDir = path.join(APP_CONSTANTS.UPLOADS_DIR, "files", "resumes");
  await fs.mkdir(uploadDir, { recursive: true });

  // filePath and fileType are both rebuilt here; neither is taken from the
  // payload. A row whose bytes are absent, oversized or not really a resume
  // keeps its row and loses its file — the same end state as an export whose
  // bytes had already gone missing, which the schema already models.
  const newFilePaths = new Map<string, string>();
  const newFileTypes = new Map<string, string>();
  const rejectedFiles: string[] = [];

  for (const file of data.File) {
    const newId = idMap.get(file.id)!;
    const prefix = `files/${file.id}/`;
    // A prefix scan, not `new RegExp(prefix)`: file.id comes out of the
    // payload, and interpolating it into a pattern hands an untrusted string
    // to the regex engine for no gain over startsWith.
    const entry =
      zip.file(`${prefix}${safeEntryName(file.filePath)}`) ??
      Object.keys(zip.files)
        .filter((name) => name.startsWith(prefix) && !zip.files[name].dir)
        .map((name) => zip.files[name])[0] ??
      null;

    if (!entry || file.fileMissing) {
      newFilePaths.set(file.id, importedFilePath(newId, file.filePath, "pdf"));
      continue;
    }

    const bytes = await entry.async("nodebuffer");
    const checked = checkImportedFile(bytes);
    if (!checked) {
      rejectedFiles.push(file.fileName);
      newFilePaths.set(file.id, importedFilePath(newId, file.filePath, "pdf"));
      continue;
    }

    const target = importedFilePath(newId, entry.name, checked.kind);
    newFilePaths.set(file.id, target);
    newFileTypes.set(file.id, checked.mimeType);
    await fs.writeFile(target, bytes);
    writtenPaths.push(target);
  }

  if (rejectedFiles.length > 0) {
    log.warn("[Backup] Dropped file entries that are not resumes", {
      "backup.rejected_file_count": rejectedFiles.length,
      "backup.rejected_file_names": rejectedFiles.join(", "),
    });
  }

  // Captured before the wipe so the old bytes can be unlinked after it commits.
  const oldFilePaths = (
    await db.file.findMany({
      where: MODEL_SPECS.File.scope(userId),
      select: { filePath: true },
    })
  ).map((f) => f.filePath);

  const counts: Record<string, number> = {};

  try {
    await db.$transaction(
      async (transaction) => {
        const tx = transaction as unknown as Tx;

        await assertLease(transaction);
        await wipe(tx, userId);
        await insertLookups(tx, data, idMap, userId, statusByValue);

        // A backup from before contacts carries no roles, and the wipe above
        // just deleted the seeded ones — reseed rather than leave none.
        if (manifest.counts.ContactRole === undefined && data.ContactRole.length === 0) {
          await tx.contactRole.createMany({
            data: CONTACT_ROLES.map((role) => ({
              label: role.label,
              value: role.value,
              createdBy: userId,
            })),
          });
        }

        // A backup from before stages carries no stage types, and the wipe
        // above just deleted the seeded ones — reseed rather than leave none,
        // or Add Stage and every status dropdown has nothing to resolve.
        if (manifest.counts.JobStageType === undefined && data.JobStageType.length === 0) {
          const stageStatuses = (await tx.jobStatus.findMany({
            select: { id: true, value: true },
          })) as unknown as { id: string; value: string }[];
          const stageStatusIds = new Map(stageStatuses.map((s) => [s.value, s.id]));
          await tx.jobStageType.createMany({
            data: JOB_STAGES.map((stage) => ({
              label: stage.label,
              value: stage.value,
              statusId: stageStatusIds.get(stage.status)!,
              sortOrder: stage.sortOrder,
              createdBy: userId,
            })),
          });
        }

        for (const model of INSERT_ORDER) {
          if (MODEL_SPECS[model].lookup) continue;
          const spec = MODEL_SPECS[model];
          const rows = rowsFor(data, model);
          counts[model] = rows.length;

          for (const row of rows) {
            let payload = buildCreateData(model, row, idMap, userId);

            if (model === "File") {
              const { fileMissing: _marker, ...rest } = payload;
              payload = {
                ...rest,
                filePath: newFilePaths.get(row.id as string)!,
                // From the sniff, never the payload. The fallback only reaches
                // rows whose bytes were absent or rejected, where the column
                // describes a file that is not on disk either way.
                fileType: newFileTypes.get(row.id as string) ?? "application/pdf",
              };
            }
            if (model === "Job") {
              const { statusValue, ...rest } = payload as { statusValue: string };
              payload = { ...rest, statusId: statusByValue.get(statusValue)! };
            }
            if (model === "Automation") {
              payload = normalizeAutomation(payload as never);
            }
            if (model === "CareerRun") {
              const terminal = ["succeeded", "failed", "cancelled", "interrupted"].includes(payload.status as string);
              payload = {
                ...payload,
                status: terminal ? payload.status : payload.kind === "application" ? "needs_verification" : "interrupted",
                leaseOwner: null, leaseUntil: null,
                version: (payload.version as number) + 1,
                errorCode: terminal ? payload.errorCode : "RESTORED_REQUIRES_REVIEW",
              };
            }
            if (model === "AutomationRun") {
              payload = normalizeAutomationRun(payload as never);
            }

            await tx[spec.delegate].create({ data: payload });
          }
        }

        // Join tables last: both endpoints have to exist first.
        for (const link of data._JobToTag) {
          await tx.job.update({
            where: { id: idMap.get(link.jobId)! },
            data: { tags: { connect: { id: idMap.get(link.tagId)! } } },
          });
        }
        for (const link of data._QuestionToTag) {
          await tx.question.update({
            where: { id: idMap.get(link.questionId)! },
            data: { tags: { connect: { id: idMap.get(link.tagId)! } } },
          });
        }
        counts._JobToTag = data._JobToTag.length;
        counts._QuestionToTag = data._QuestionToTag.length;

        // A back-reference from a row the import never inserts.
        const defaultResumeId = data.user.defaultResumeId
          ? (idMap.get(data.user.defaultResumeId) ?? null)
          : null;
        await tx.user.update({ where: { id: userId }, data: { defaultResumeId } });
        await assertLease(transaction);
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  } catch (error) {
    await Promise.all(
      writtenPaths.map((p) => fs.unlink(p).catch(() => undefined)),
    );
    if (error instanceof BackupError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/database is locked|SQLITE_BUSY/i.test(message)) {
      throw new BackupError("The database is busy. Please try the import again.");
    }
    log.error("[Backup] Import transaction failed", { error: String(error) });
    throw new BackupError("Import failed and nothing was changed.");
  }

  // Without this every restore-over-existing leaves the previous account's
  // resume files in UPLOADS_DIR forever with no row pointing at them.
  for (const filePath of oldFilePaths) {
    if (writtenPaths.includes(filePath)) continue;
    if (!isResumeFilePath(filePath)) {
      log.warn("[Backup] Skipped removing a file outside the resumes directory", {
        "file.path": filePath,
      });
      continue;
    }
    await fs.unlink(filePath).catch((error) => {
      log.warn("[Backup] Could not remove replaced file", {
        "file.path": filePath,
        error: String(error),
      });
    });
  }

  // Nothing else would: syncSchedulerState runs at boot and in the automation
  // actions, and an import goes through neither. Imported dynamically so
  // node-cron and the whole scraper graph stay out of this module's imports.
  const { syncSchedulerState } = await import("@/lib/scheduler");
  await syncSchedulerState();

  return { counts, filesWritten: writtenPaths.length, snapshotPath };
}


export async function importBackup(
  bytes: Buffer,
  userId: string,
  userEmail: string,
  confirmWipe: boolean,
): Promise<ImportResult> {
  // Validate identity before creating the owner-scoped lease so stale sessions
  // retain the existing helpful error instead of a foreign-key failure.
  const owner = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!owner) throw new BackupError("Your sign-in is out of date. Sign out, sign in again, then retry the import.");
  const zip = await openBackupZip(bytes);
  const manifest = await readManifest(zip);
  const data = await readData(zip);
  try {
    return await withMaintenanceLease(userId, (assertLease) => restoreBackup(zip, manifest, data, userId, userEmail, confirmWipe, assertLease));
  } catch (error) {
    if (error instanceof MaintenanceError) throw new BackupError(error.message);
    throw error;
  }
}
