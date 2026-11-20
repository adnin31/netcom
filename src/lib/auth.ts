import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** For route handlers: returns the user or a 401 response. */
export async function requireApiSession(): Promise<SessionUser | Response> {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return user;
}
