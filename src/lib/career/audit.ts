import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
export async function event(
  tx: Prisma.TransactionClient,
  userId: string,
  type: string,
  payload: Record<string, unknown>,
  operationKey?: string,
  eventKey: string = randomUUID(),
) {
  return tx.careerEvent.create({
    data: {
      userId,
      eventKey,
      operationKey,
      type,
      actor: "user",
      payloadJson: JSON.stringify({ schemaVersion: 1, ...payload }),
    },
  });
}
