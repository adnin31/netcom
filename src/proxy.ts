import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/adapters/http/session-cookie";
import { JoseTokenService } from "@/adapters/security/jose-token-service";
import { config as appConfig } from "@/infrastructure/config";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
let tokens: JoseTokenService | undefined;

/**
 * Optimistic auth check before routing. Route handlers verify the session
 * again through the Authenticate use case.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  tokens ??= new JoseTokenService(appConfig.authSecret, appConfig.sessionTtlSeconds);
  const user = await tokens.verify(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|svg|ico|jpg)$).*)"],
};
