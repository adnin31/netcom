import { getDatabase } from "@/infrastructure/database";

/** Liveness/readiness probe for Docker and load balancers. */
export async function GET() {
  try {
    await getDatabase()`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}
