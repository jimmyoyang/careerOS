import type { Prisma } from "@prisma/client";
import db from "@/lib/db";

// Retry the whole short transaction after SQLite contention, never its last write.
export async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { maxWait: 5000, timeout: 10000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 3 || !["P1008", "P2034", "P2028"].includes(code ?? ""))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}
