// Dashboard user entity.

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  passwordHash: string;
};

/** What is known about the signed-in user; safe to put in a token or a page. */
export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export function toSessionUser(u: User): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
