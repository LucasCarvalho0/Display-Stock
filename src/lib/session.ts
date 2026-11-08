import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { env } from "./env";
import { unauthorized } from "./errors";

const COOKIE = "dsc_session";
const TTL_HOURS = 10;
const key = () => new TextEncoder().encode(env().SESSION_SECRET);

export type AuthUser = {
  id: string; name: string; email: string; role: string; permissions: string[]; mustChangePassword: boolean;
};

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000);
  const s = await prisma.session.create({ data: { userId, expiresAt, ip, userAgent: userAgent?.slice(0, 250) } });
  const token = await new SignJWT({ sid: s.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(expiresAt).sign(key());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const sid = await readSid();
  if (sid) await prisma.session.deleteMany({ where: { id: sid } });
  cookies().delete(COOKIE);
}

async function readSid(): Promise<string | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload.sid as string; } catch { return null; }
}

/** Valida a sessão NO BANCO a cada requisição (permite revogar acessos imediatamente). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const sid = await readSid();
  if (!sid) return null;
  const s = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  const u = s.user;
  return { id: u.id, name: u.name, email: u.email, role: u.role.name, mustChangePassword: u.mustChangePassword,
    permissions: u.role.permissions.map((p) => p.permission.key) };
}
export async function requireUser(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}
export const can = (u: AuthUser, perm: string) => u.permissions.includes(perm);
