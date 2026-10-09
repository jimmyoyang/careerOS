import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { log } from "@/lib/telemetry";

const LEASE_MS = 5 * 60_000;

export class MaintenanceError extends Error {
  readonly code = "MAINTENANCE_CONFLICT";

  constructor(
    message = "Account maintenance is in progress. Retry after the restore finishes.",
  ) {
    super(message);
    this.name = "MaintenanceError";
  }
}

// Run inside the same transaction as enqueue/claim. Expiring stale rows is a
// write, so SQLite serializes the check with maintenance acquisition.
export async function assertNoMaintenance(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const now = new Date();
  await tx.careerRun.updateMany({
    where: {
      userId,
      kind: "maintenance",
      status: "running",
      OR: [{ leaseUntil: { lte: now } }, { leaseUntil: null }],
    },
    data: {
      status: "interrupted",
      leaseOwner: null,
      leaseUntil: null,
      errorCode: "LEASE_EXPIRED",
    },
  });
  const active = await tx.careerRun.findFirst({
    where: { userId, kind: "maintenance", status: "running" },
    select: { id: true },
  });
  if (active) throw new MaintenanceError();
}

async function shortTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, { timeout: 10_000, maxWait: 5_000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        attempt >= 2 ||
        (!["P1008", "P2034"].includes(code ?? "") &&
          !/SQLITE_BUSY|database is locked/i.test(String(error)))
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}

export type MaintenanceLeaseGuard = (
  tx: Prisma.TransactionClient,
) => Promise<void>;

export async function withMaintenanceLease<T>(
  userId: string,
  fn: (assertLease: MaintenanceLeaseGuard) => Promise<T>,
): Promise<T> {
  const operationKey = randomUUID();
  const leaseOwner = randomUUID();
  const lease = await shortTransaction(async (tx) => {
    await assertNoMaintenance(tx, userId);
    const activeCareer = await tx.careerRun.findFirst({
      where: { userId, kind: { not: "maintenance" }, status: "running" },
      select: { id: true },
    });
    const activeAutomation = await tx.automationRun.findFirst({
      where: {
        automation: { userId },
        status: { in: ["running", "cancelling"] },
      },
      select: { id: true },
    });
    if (activeCareer || activeAutomation) {
      throw new MaintenanceError(
        "A task is running. Wait for it to finish before restoring this account.",
      );
    }
    return tx.careerRun.create({
      data: {
        userId,
        operationKey,
        idempotencyKey: operationKey,
        kind: "maintenance",
        step: "restore",
        status: "running",
        requestHash: operationKey,
        inputJson: JSON.stringify({ schemaVersion: 1 }),
        leaseOwner,
        leaseUntil: new Date(Date.now() + LEASE_MS),
      },
    });
  });

  // Restore may spend time streaming a safety snapshot before its DB transaction.
  const heartbeat = setInterval(() => {
    void db.careerRun
      .updateMany({
        where: {
          id: lease.id,
          userId,
          status: "running",
          leaseOwner,
          leaseUntil: { gt: new Date() },
        },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
      })
      .catch((error) =>
        log.warn("[Career] Maintenance lease renewal failed", {
          error: String(error),
        }),
      );
  }, 60_000);
  heartbeat.unref();
  let succeeded = false;
  try {
    const result = await fn(async (tx) => {
      const active = await tx.careerRun.findFirst({
        where: {
          id: lease.id,
          userId,
          status: "running",
          leaseOwner,
          leaseUntil: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!active)
        throw new MaintenanceError(
          "The maintenance lease expired. Retry the restore.",
        );
    });
    succeeded = true;
    return result;
  } finally {
    clearInterval(heartbeat);
    await shortTransaction(async (tx) => {
      const released = await tx.careerRun.updateMany({
        where: { id: lease.id, userId, leaseOwner },
        data: {
          status: succeeded ? "succeeded" : "failed",
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      if (released.count) {
        await tx.careerEvent.create({
          data: {
            userId,
            operationKey,
            eventKey: `maintenance:${operationKey}`,
            type: succeeded ? "backup.restored" : "backup.restore_failed",
            actor: "system",
            payloadJson: JSON.stringify({
              schemaVersion: 1,
              outcome: succeeded ? "succeeded" : "failed",
            }),
          },
        });
      }
    });
  }
}
