import { getWorkspaceAction } from "@/actions/career";
import { CareerWorkbench } from "@/components/career/CareerWorkbench";

export default async function CareerPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const [result, params] = await Promise.all([
    getWorkspaceAction(),
    searchParams,
  ]);
  return (
    <CareerWorkbench
      initialWorkspace={result.ok ? result.data : null}
      initialError={
        result.ok ? "" : `${result.error.message}（${result.error.code}）`
      }
      initialJobId={params.jobId}
    />
  );
}
