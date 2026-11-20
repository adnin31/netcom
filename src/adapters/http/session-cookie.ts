// Session cookie format, independent of any web framework.

export const SESSION_COOKIE = "netcom_session";

export function readCookie(request: Request, name = SESSION_COOKIE): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
