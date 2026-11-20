import { UnauthorizedError } from "../../domain/errors";
import type { SessionUser } from "../../domain/user";
import type { TokenService } from "../ports";

/** Resolve the signed-in user from a session token. */
export class Authenticate {
  constructor(private readonly tokens: TokenService) {}

  /** Returns null when not signed in. */
  async current(token: string | undefined): Promise<SessionUser | null> {
    return this.tokens.verify(token);
  }

  /** Throws UnauthorizedError when not signed in. */
  async require(token: string | undefined): Promise<SessionUser> {
    const user = await this.tokens.verify(token);
    if (!user) throw new UnauthorizedError("Unauthorized");
    return user;
  }
}
