import bcrypt from "bcryptjs";
import { z } from "zod";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";

const DUMMY_HASH = bcrypt.hashSync("netcom-dummy-password", 10);

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Email dan password wajib diisi" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const [user] = await sql<{ id: number; name: string; email: string; role: string; password_hash: string }[]>`
    select id, name, email, role, password_hash from app_users where email = ${email}`;

  // Compare even when the user is missing, so timing doesn't reveal valid emails.
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    return Response.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const token = await signSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  const response = Response.json({ ok: true, user: { name: user.name, email: user.email } });
  response.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${SESSION_TTL_SECONDS}`,
      process.env.COOKIE_SECURE === "true" ? "Secure" : "",
    ].filter(Boolean).join("; "),
  );
  return response;
}
