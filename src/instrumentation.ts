export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncSchedulerState } = await import("@/lib/scheduler");
    await syncSchedulerState();
    if (process.env.CAREER_ENABLED === "true") {
      const { startCareerWorker } = await import("@/lib/career/worker");
      startCareerWorker();
    }
  }
}
