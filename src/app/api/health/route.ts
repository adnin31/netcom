import { sql } from "@/lib/db";

/** Liveness/readiness probe for Docker and load balancers. */
export async function GET() {
  try {
    await sql`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}
