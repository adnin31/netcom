import bcrypt from "bcryptjs";
import type { PasswordHasher } from "@/core/application/ports";

export class BcryptPasswordHasher implements PasswordHasher {
  // Real hash of a throwaway value, used when the user does not exist so
  // both paths cost one bcrypt comparison.
  private readonly dummy = bcrypt.hashSync("netcom-dummy-password", 10);

  async verify(password: string, hash: string | null): Promise<boolean> {
    const ok = await bcrypt.compare(password, hash ?? this.dummy);
    return hash !== null && ok;
  }
}
