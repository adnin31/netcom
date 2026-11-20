// Environment configuration, read in one place.
export const config = {
  // postgres() connects lazily, so a missing URL only fails on the first query
  // (keeps `next build` working without a database).
  databaseUrl: process.env.DATABASE_URL ?? "postgres://missing:DATABASE_URL@127.0.0.1:1/not_configured",
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 10),
  authSecret: process.env.AUTH_SECRET ?? "",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  sessionTtlSeconds: 60 * 60 * 8,
};
