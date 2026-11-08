import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma, transaction } from "@/lib/db";
import { AppError, badRequest } from "@/lib/errors";
import { env } from "@/lib/env";
import { audit } from "./audit.service";

const MAX_FAILS = 5, LOCK_MIN = 15;
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function assertStrongPassword(p: string) {
  if (p.length < 10 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) throw badRequest("A senha precisa ter no mínimo 10 caracteres, com letras maiúsculas, minúsculas e números.");
}

export async function verifyLogin(email: string, password: string, ip?: string) {
  const generic = new AppError(401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos.");
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u || !u.active) { await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi"); throw generic; }
  if (u.lockedUntil && u.lockedUntil > new Date()) throw new AppError(423, "CONTA_BLOQUEADA", "Conta temporariamente bloqueada por tentativas inválidas. Tente novamente mais tarde.");
  if (!(await bcrypt.compare(password, u.passwordHash))) {
    const fails = u.failedLogins + 1;
    await prisma.user.update({ where: { id: u.id }, data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null } });
    await audit(prisma, { userId: u.id, action: "LOGIN_FALHOU", entity: "User", entityId: u.id, ip });
    throw generic;
  }
  await prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null } });
  await audit(prisma, { userId: u.id, action: "LOGIN", entity: "User", entityId: u.id, ip });
  return u;
}

export async function changePassword(userId: string, current: string, next: string) {
  assertStrongPassword(next);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new AppError(400, "SENHA_ATUAL_INVALIDA", "Senha atual incorreta.");
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
    await audit(tx, { userId, action: "SENHA_ALTERADA", entity: "User", entityId: userId });
  });
}

/** Resposta idêntica exista o e-mail ou não (evita enumeração de usuários). */
export async function requestPasswordReset(email: string) {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u || !u.active) return;
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
  const link = `${env().APP_URL}/redefinir-senha?token=${token}`;
  if (env().SMTP_URL) {
    const nodemailer = await import("nodemailer" as string).catch(() => null);
    if (nodemailer) { await nodemailer.createTransport(env().SMTP_URL).sendMail({ from: env().SMTP_FROM, to: u.email, subject: "Redefinição de senha — Display Stock Control", text: `Use o link (válido por 1 hora): ${link}` }); return; }
  }
  console.log(`[recuperação de senha] ${u.email}: ${link}`); // sem SMTP configurado
}

export async function resetPassword(token: string, password: string) {
  assertStrongPassword(password);
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new AppError(400, "TOKEN_INVALIDO", "Link inválido ou expirado. Solicite um novo.");
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: false, failedLogins: 0, lockedUntil: null } });
    await tx.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: t.userId } });
    await audit(tx, { userId: t.userId, action: "SENHA_REDEFINIDA", entity: "User", entityId: t.userId });
  });
}
