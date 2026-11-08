import { prisma, transaction } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { audit } from "./audit.service";
import { assertStrongPassword, hashPassword } from "./auth.service";

export const listUsers = () => prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, active: true, role: { select: { id: true, name: true } }, createdAt: true } });
export const listRoles = () => prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: "asc" } })
  .then((rs) => rs.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions.map((p) => p.permission.key) })));

export async function createUser(i: { name: string; email: string; password: string; roleId: string }, actorId: string, ip?: string) {
  assertStrongPassword(i.password);
  return transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: i.email.toLowerCase() } })) throw conflict("EMAIL_DUPLICADO", "Já existe um usuário com esse e-mail.");
    const u = await tx.user.create({ data: { name: i.name.trim(), email: i.email.toLowerCase().trim(), roleId: i.roleId, passwordHash: await hashPassword(i.password), mustChangePassword: true } });
    await audit(tx, { userId: actorId, action: "USUARIO_CRIADO", entity: "User", entityId: u.id, after: { email: u.email, roleId: i.roleId }, ip });
    return { id: u.id };
  });
}
export async function updateUser(id: string, i: { name?: string; roleId?: string; active?: boolean; password?: string }, actorId: string, ip?: string) {
  if (id === actorId && (i.active === false)) throw badRequest("Você não pode desativar o próprio usuário.");
  return transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id } }); if (!before) throw notFound("Usuário não encontrado.");
    const { password, ...rest } = i;
    if (password) assertStrongPassword(password);
    await tx.user.update({ where: { id }, data: { ...rest, ...(password && { passwordHash: await hashPassword(password), mustChangePassword: true }) } });
    if (i.active === false || password || i.roleId) await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, { userId: actorId, action: "USUARIO_ALTERADO", entity: "User", entityId: id, before: { roleId: before.roleId, active: before.active }, after: { ...rest, senhaRedefinida: !!password }, ip });
  });
}
export async function setRolePermissions(roleId: string, keys: string[], actorId: string, ip?: string) {
  const invalid = keys.filter((k) => !(k in PERMISSIONS)); if (invalid.length) throw badRequest(`Permissões inválidas: ${invalid.join(", ")}`);
  return transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: roleId } }); if (!role) throw notFound("Perfil não encontrado.");
    if (role.name === "Administrador" && !keys.includes("users.manage")) throw badRequest("O perfil Administrador deve manter a permissão de gerenciar usuários.");
    const perms = await tx.permission.findMany({ where: { key: { in: keys } } });
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
    await audit(tx, { userId: actorId, action: "PERMISSOES_ALTERADAS", entity: "Role", entityId: roleId, after: { keys }, ip });
  });
}
