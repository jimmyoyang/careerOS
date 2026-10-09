import { randomUUID } from "node:crypto";
import db from "@/lib/db";
import { claimRun, finishRun } from "./runs";
import { analyzeMatch } from "./matching";
import { enrichMatch } from "./matching-ai";
import { tailor } from "./tailoring";
import { compileMaterial } from "./materials";
import { publicError } from "./errors";
import type { CareerInputs } from "./inputs";
import { parseJd } from "./parsing";

export async function processNextRun(workerId: string = randomUUID()) {
  const run = await claimRun(workerId);
  if (!run) return false;
  try {
    const input = JSON.parse(run.inputJson) as CareerInputs & {
      options: Record<string, unknown>;
    };
    if (run.kind === "compile") await compileMaterial(run);
    else if (run.kind === "tailor") {
      const draft = await tailor(run.userId, input, input.options);
      await finishRun(run, draft, "awaiting_review", async (tx) => {
        await tx.careerJobContext.update({
          where: { jobId: run.jobId!, userId: run.userId },
          data: { preparationStatus: "draft_ready" },
        });
      });
    } else if (run.kind === "match") {
      let result = {
        ...analyzeMatch(
          input.snapshot.requirements,
          input.snapshot.evidence,
          input.snapshot.preferences,
        ),
        inputHash: input.inputHash,
      };
      if (input.options.ai)
        result = await enrichMatch(run.userId, input, result, input.options.ai);
      await finishRun(run, result, "succeeded", async (tx) => {
        await tx.careerJobContext.update({
          where: { jobId: run.jobId!, userId: run.userId },
          data: {
            analysisJson: JSON.stringify(result),
            preparationStatus: "analyzed",
          },
        });
      });
    } else {
      const result = parseJd(input.snapshot.rawJd);
      await finishRun(run, result, "succeeded", async (tx) => {
        await tx.careerJobContext.update({
          where: { jobId: run.jobId!, userId: run.userId },
          data: {
            requirementsJson: JSON.stringify(result),
            preparationStatus: "parsed",
          },
        });
      });
    }
  } catch (error) {
    const failure = publicError(error);
    await db.careerRun.updateMany({
      where: {
        id: run.id,
        status: "running",
        leaseOwner: run.leaseOwner,
        version: run.version,
        leaseUntil: { gt: new Date() },
      },
      data: {
        status: "failed",
        errorCode: failure.code,
        resultJson: JSON.stringify({ schemaVersion: 1, error: failure }),
        leaseOwner: null,
        leaseUntil: null,
        version: { increment: 1 },
      },
    });
  }
  return true;
}
const globalWorker = globalThis as typeof globalThis & {
  careerWorker?: ReturnType<typeof setInterval>;
};
export function startCareerWorker() {
  if (globalWorker.careerWorker || process.env.CAREER_ENABLED === "false")
    return;
  const workerId = randomUUID();
  let ticking = false;
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await processNextRun(workerId);
    } catch {
      console.error("[Career] worker database unavailable; retrying");
    } finally {
      ticking = false;
    }
  };
  globalWorker.careerWorker = setInterval(() => void tick(), 2000);
  globalWorker.careerWorker.unref();
  void tick();
}
