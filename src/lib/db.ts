import "server-only";
import postgres from "postgres";

declare global {
  var __netcomSql: postgres.Sql | undefined;
}

function createClient() {
  // postgres() connects lazily, so a missing URL only fails on the first query
  // (keeps `next build` working without a database).
  const url = process.env.DATABASE_URL ?? "postgres://missing:DATABASE_URL@127.0.0.1:1/not_configured";
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

/** One pool per server process (survives dev hot reloads). */
export const sql: postgres.Sql = globalThis.__netcomSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__netcomSql = sql;
