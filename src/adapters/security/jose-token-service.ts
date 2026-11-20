import { SignJWT, jwtVerify } from "jose";
import type { TokenService } from "@/core/application/ports";
import type { SessionUser } from "@/core/domain/user";

/** HS256 JWT session tokens. */
export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string, readonly ttlSeconds = 60 * 60 * 8) {
    if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be set (min. 16 characters)");
    this.key = new TextEncoder().encode(secret);
  }

  sign(user: SessionUser): Promise<string> {
    return new SignJWT({ name: user.name, email: user.email, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);
  }

  async verify(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] });
      return { id: Number(payload.sub), name: String(payload.name), email: String(payload.email), role: String(payload.role) };
    } catch {
      return null;
    }
  }
}
