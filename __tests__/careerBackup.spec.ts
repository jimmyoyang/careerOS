// @vitest-environment node
import { BACKUP_FORMAT_VERSION, BackupDataSchema, ManifestSchema } from "@/lib/backup/schema";
import { EMPTINESS_MODELS, INSERT_ORDER, MODEL_SPECS } from "@/lib/backup/ordering";
import { buildCreateData, IdMap } from "@/lib/backup/idmap";

const groups = ["CareerEvidence", "CareerJobContext", "CareerMaterial", "CareerRun", "CareerEvent"] as const;

describe("Career backup contract", () => {
  it("exports format 3 while accepting formats 1 and 2 and defaulting absent Career groups", () => {
    expect(BACKUP_FORMAT_VERSION).toBe(3);
    for (const formatVersion of [1, 2, 3]) {
      expect(ManifestSchema.safeParse({ formatVersion, appVersion: "1", exportedAt: "now", sourceEmail: "a@b.c", counts: {} }).success).toBe(true);
    }
    const data = BackupDataSchema.parse({});
    for (const group of groups) expect(data[group]).toEqual([]);
  });

  it("registers Career ownership, dependency order and emptiness", () => {
    for (const group of groups) {
      expect(EMPTINESS_MODELS).toContain(group);
      expect(MODEL_SPECS[group].owner).toBe("userId");
    }
    expect(INSERT_ORDER.indexOf("CareerMaterial")).toBeGreaterThan(INSERT_ORDER.indexOf("Job"));
    expect(INSERT_ORDER.indexOf("CareerRun")).toBeGreaterThan(INSERT_ORDER.indexOf("CareerMaterial"));
    expect(MODEL_SPECS.File.scope("owner")).toEqual({ OR: [{ Resume: { profile: { userId: "owner" } } }, { careerMaterials: { some: { userId: "owner" } } }] });
    expect(MODEL_SPECS.CareerRun.scope("owner")).toEqual({ userId: "owner", kind: { not: "maintenance" } });
  });

  it("remaps material references and nulls a missing source resume", () => {
    const ids = new IdMap();
    ids.set("material", "new-material");
    ids.set("job", "new-job");
    ids.set("pdf", "new-pdf");
    expect(buildCreateData("CareerMaterial", { id: "material", jobId: "job", fileId: "pdf", sourceResumeId: "deleted", userId: "attacker" }, ids, "owner")).toEqual({ id: "new-material", jobId: "new-job", fileId: "new-pdf", sourceResumeId: null, userId: "owner" });
  });

  it("rejects unversioned Career JSON and maintenance records from uploaded backups", () => {
    const event = { id: "event", eventKey: "event-key", operationKey: null, type: "evidence.confirmed", actor: "user", payloadJson: '{"schemaVersion":1}', createdAt: new Date() };
    expect(BackupDataSchema.safeParse({ CareerEvent: [event] }).success).toBe(true);
    expect(BackupDataSchema.safeParse({ CareerEvent: [{ ...event, payloadJson: "{}" }] }).success).toBe(false);
    const run = { id: "run", operationKey: "operation", idempotencyKey: "idem", jobId: null, materialId: null, kind: "maintenance", step: "restore", status: "running", accountLockKey: null, requestHash: "hash", inputJson: '{"schemaVersion":1}', resultJson: null, attempts: 0, leaseOwner: null, leaseUntil: null, version: 0, errorCode: null, createdAt: new Date(), updatedAt: new Date() };
    expect(BackupDataSchema.safeParse({ CareerRun: [run] }).success).toBe(false);
  });
});
