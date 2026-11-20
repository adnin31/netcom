import "server-only";
import postgres from "postgres";
import { config } from "./config";

declare global {
  var __netcomSql: postgres.Sql | undefined;
}

/** One connection pool per server process (survives dev hot reloads). */
export function getDatabase(): postgres.Sql {
  globalThis.__netcomSql ??= postgres(config.databaseUrl, {
    max: config.dbPoolMax,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  return globalThis.__netcomSql;
}
