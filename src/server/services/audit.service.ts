import { Prisma } from "@prisma/client";
import { prisma, Tx } from "@/lib/db";
export type AuditInput = {
  userId?: string | null; action: string; entity: string; entityId?: string | null;
  before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue; ip?: string;
};
export async function audit(client: Tx | typeof prisma, a: AuditInput) {
  const db = client as Tx;
  await db.auditLog.create({ data: {
    userId: a.userId ?? null, action: a.action, entity: a.entity, entityId: a.entityId ?? null,
    before: a.before ?? Prisma.JsonNull, after: a.after ?? Prisma.JsonNull, ip: a.ip,
  } });
}
