import { getCurrentUser } from "@/utils/user.utils";
import { materialBytes } from "@/lib/career/materials";
import { publicError } from "@/lib/career/errors";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { material, bytes } = await materialBytes(
      user.id,
      (await context.params).id,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "Content-Disposition": `inline; filename="CareerOS-${material.materialKey}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(publicError(error), { status: 404 });
  }
}
