// Next.js glue: read the session cookie in Server Components.
import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/adapters/http/session-cookie";
import { container } from "./container";

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return container().useCases.authenticate.current(token);
}
