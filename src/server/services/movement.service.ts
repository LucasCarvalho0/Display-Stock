import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { endOfDay, startOfDay } from "@/lib/time";

export type MovementQuery = { from?: string; to?: string; code?: string; product?: string; client?: string; userId?: string; type?: string; classification?: "NORMAL" | "NG"; page: number; pageSize: number };

export async function listMovements(f: MovementQuery) {
  const where: Prisma.MovementWhereInput = {
    ...((f.from || f.to) && { occurredAt: { ...(f.from && { gte: startOfDay(f.from) }), ...(f.to && { lte: endOfDay(f.to) }) } }),
    ...(f.type && { type: f.type as never }), ...(f.userId && { createdById: f.userId }),
    product: {
      ...(f.code && { code: { contains: f.code, mode: "insensitive" } }), ...(f.product && { description: { contains: f.product, mode: "insensitive" } }),
      ...(f.client && { client: { name: { contains: f.client, mode: "insensitive" } } }), ...(f.classification && { classification: f.classification }),
    },
  };
  const [total, rows] = await Promise.all([
    prisma.movement.count({ where }),
    prisma.movement.findMany({ where, orderBy: { seq: "desc" }, skip: (f.page - 1) * f.pageSize, take: f.pageSize,
      include: { product: { select: { code: true, description: true, classification: true, client: { select: { name: true } } } }, createdBy: { select: { name: true } } } }),
  ]);
  return { total, page: f.page, pageSize: f.pageSize, rows };
}

export async function getMovement(id: string) {
  const m = await prisma.movement.findFirst({ where: { OR: [{ id }, { number: id }] },
    include: { product: { include: { client: true } }, createdBy: { select: { name: true } }, adjustment: true,
      revisions: { orderBy: { revisionNo: "asc" }, include: { revisedBy: { select: { name: true } } } } } });
  if (!m) throw notFound("Movimentação não encontrada.");
  return m;
}
