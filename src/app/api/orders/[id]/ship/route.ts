import { requireApiSession } from "@/lib/auth";
import { markShipped } from "@/lib/analytics";
import { errorResponse } from "@/lib/crud";

// POST /api/orders/:id/ship  -> status 'shipped', carrier date = now()
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiSession();
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  try {
    const ok = await markShipped(id);
    if (!ok) return Response.json({ error: "Order tidak ditemukan atau sudah dikirim" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
