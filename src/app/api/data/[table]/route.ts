import { requireApiSession } from "@/lib/auth";
import { createRow, deleteRow, errorResponse, listRows, updateRow } from "@/lib/crud";
import { getTable } from "@/lib/tables";

type Ctx = { params: Promise<{ table: string }> };

async function resolve(ctx: Ctx) {
  const session = await requireApiSession();
  if (session instanceof Response) return session;
  const table = getTable((await ctx.params).table);
  if (!table) return Response.json({ error: "Tabel tidak dikenal" }, { status: 404 });
  return table;
}

// GET /api/data/:table?q=&page=&pageSize=&sort=&dir=
export async function GET(request: Request, ctx: Ctx) {
  const table = await resolve(ctx);
  if (table instanceof Response) return table;
  const p = new URL(request.url).searchParams;
  try {
    const result = await listRows(table, {
      q: p.get("q") ?? undefined,
      page: Number(p.get("page")),
      pageSize: Number(p.get("pageSize")),
      sort: p.get("sort") ?? undefined,
      dir: p.get("dir") ?? undefined,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/data/:table  body: { values }
export async function POST(request: Request, ctx: Ctx) {
  const table = await resolve(ctx);
  if (table instanceof Response) return table;
  try {
    const body = await request.json();
    const row = await createRow(table, body.values ?? {});
    return Response.json({ row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/data/:table  body: { key, values }
export async function PUT(request: Request, ctx: Ctx) {
  const table = await resolve(ctx);
  if (table instanceof Response) return table;
  try {
    const body = await request.json();
    const row = await updateRow(table, body.key, body.values ?? {});
    return Response.json({ row });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/data/:table  body: { key }
export async function DELETE(request: Request, ctx: Ctx) {
  const table = await resolve(ctx);
  if (table instanceof Response) return table;
  try {
    const body = await request.json();
    await deleteRow(table, body.key);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
