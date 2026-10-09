import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { CareerError } from "./errors";
export async function ownedJob(
  userId: string,
  jobId: string,
  tx: Prisma.TransactionClient = db,
) {
  const job = await tx.job.findFirst({
    where: { id: jobId, userId },
    include: {
      careerContext: true,
      Company: true,
      JobTitle: true,
      Location: true,
    },
  });
  if (!job) throw new CareerError("NOT_FOUND", "找不到该岗位。");
  return job;
}
