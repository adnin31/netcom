import type { Sql } from "postgres";
import type { UserRepository } from "@/core/application/ports";
import type { User } from "@/core/domain/user";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: Sql) {}

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.sql<User[]>`
      select id, name, email, role, password_hash as "passwordHash"
      from app_users where email = ${email}`;
    return row ?? null;
  }
}
