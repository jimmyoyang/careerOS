import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const run = await db.careerRun.findFirst({
    where: {
      id: (await context.params).id,
      userId: user.id,
      kind: { not: "maintenance" },
    },
    select: {
      id: true,
      status: true,
      kind: true,
      step: true,
      errorCode: true,
      updatedAt: true,
    },
  });
  return Response.json(run ?? { code: "NOT_FOUND" }, {
    status: run ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
