import { UnauthorizedError, ValidationError } from "../../domain/errors";
import { normalizeEmail, toSessionUser, type SessionUser } from "../../domain/user";
import type { PasswordHasher, TokenService, UserRepository } from "../ports";

export type LoginInput = { email: string; password: string };
export type LoginOutput = { token: string; expiresIn: number; user: SessionUser };

export class Login {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = normalizeEmail(input.email ?? "");
    if (!/^[^@\s]+@[^@\s]+$/.test(email) || !input.password || input.password.length > 200) {
      throw new ValidationError("Email dan password wajib diisi");
    }
    const user = await this.users.findByEmail(email);
    // Always verify (against a dummy hash when the user is missing) so the
    // response time does not reveal which emails exist.
    const ok = await this.hasher.verify(input.password, user?.passwordHash ?? null);
    if (!user || !ok) throw new UnauthorizedError("Email atau password salah");

    const session = toSessionUser(user);
    return { token: await this.tokens.sign(session), expiresIn: this.tokens.ttlSeconds, user: session };
  }
}
