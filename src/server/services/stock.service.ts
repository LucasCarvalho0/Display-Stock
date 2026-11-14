import { MovementType, Prisma, Shift } from "@prisma/client";
import { prisma, Tx, transaction } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "./audit.service";

export const signedQty = (type: MovementType, qty: number) =>
  type === "ENTRADA" || type === "AJUSTE_POSITIVO" ? qty : -qty;

export const movementNumber = (seq: number) => `MOV-${String(seq).padStart(6, "0")}`;

/** Bloqueia a linha do saldo (SELECT ... FOR UPDATE) e devolve o valor atual. Serializa saídas simultâneas. */
export async function lockBalance(tx: Tx, productId: string): Promise<number> {
  await tx.stockBalance.upsert({ where: { productId }, create: { productId, quantity: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ quantity: number }[]>`SELECT "quantity" FROM "StockBalance" WHERE "productId" = ${productId} FOR UPDATE`;
  return rows[0].quantity;
}

const insufficient = (available: number) =>
  conflict("SALDO_INSUFICIENTE", `Saldo insuficiente. Existem apenas ${available} unidades disponíveis.`, { available });

export type NewMovement = {
  productId: string; type: MovementType; quantity: number; note?: string | null;
  userId: string; occurredAt?: Date; source?: string; importBatchId?: string; ip?: string;
  shift?: Shift;
};

/** Registra a movimentação, atualiza o saldo e a auditoria. Deve ser chamada dentro de uma transação. */
export async function applyMovement(tx: Tx, m: NewMovement) {
  if (!Number.isInteger(m.quantity) || m.quantity <= 0) throw badRequest("A quantidade deve ser um número inteiro maior que zero.");
  const product = await tx.product.findUnique({ where: { id: m.productId } });
  if (!product) throw notFound("Produto não encontrado.");
  if (!product.active) throw badRequest("Produto inativo. Reative o cadastro para movimentar.");

  let shiftToRecord: Shift = m.shift ?? "GERAL";
  if (!m.shift) {
    const user = await tx.user.findUnique({ where: { id: m.userId }, select: { shift: true } });
    if (user?.shift && user.shift !== "GERAL") {
      shiftToRecord = user.shift;
    } else {
      const hour = (m.occurredAt ?? new Date()).getHours();
      shiftToRecord = hour >= 6 && hour < 16 ? "MANHA" : "NOITE";
    }
  }

  const current = await lockBalance(tx, m.productId);
  const next = current + signedQty(m.type, m.quantity);
  if (next < 0) throw insufficient(current);

  const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval(pg_get_serial_sequence('"Movement"','seq'))`;
  const seq = Number(nextval);
  const mov = await tx.movement.create({ data: {
    seq, number: movementNumber(seq), type: m.type, productId: m.productId, quantity: m.quantity,
    note: m.note?.trim() || null, createdById: m.userId, occurredAt: m.occurredAt ?? new Date(),
    source: m.source ?? "MANUAL", importBatchId: m.importBatchId, shift: shiftToRecord,
  } });
  await tx.stockBalance.update({ where: { productId: m.productId }, data: { quantity: next, version: { increment: 1 } } });
  await audit(tx, { userId: m.userId, action: "MOVIMENTACAO_CRIADA", entity: "Movement", entityId: mov.id, ip: m.ip,
    after: { number: mov.number, type: m.type, productCode: product.code, quantity: m.quantity, saldoAnterior: current, saldoNovo: next } });
  return { movement: mov, previousBalance: current, newBalance: next, product };
}

export const registerMovement = (m: NewMovement) => transaction((tx) => applyMovement(tx, m));

export type Correction = { quantity?: number; type?: "ENTRADA" | "SAIDA"; note?: string | null; void?: boolean };

/** Corrige uma movimentação preservando número, valores anteriores, justificativa e responsável. */
export async function correctMovement(movementId: string, c: Correction, justification: string, userId: string, ip?: string) {
  if (justification.trim().length < 5) throw badRequest("Informe uma justificativa (mínimo 5 caracteres).");
  return transaction(async (tx) => {
    const found = await tx.movement.findUnique({ where: { id: movementId } });
    if (!found) throw notFound("Movimentação não encontrada.");
    await lockBalance(tx, found.productId);
    const mov = await tx.movement.findUniqueOrThrow({ where: { id: movementId } }); // releitura sob bloqueio
    if (mov.status === "ESTORNADA") throw conflict("JA_ESTORNADA", "Esta movimentação já foi estornada.");

    // Regra de Espelhamento de Turnos: 1T não modifica o que 2T fez e vice-versa
    const actor = await tx.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (actor && actor.role.name !== "Administrador" && actor.shift !== "GERAL") {
      if (mov.shift !== actor.shift) {
        const shiftMap: Record<string, string> = {
          MANHA: "1º Turno (Manhã)",
          NOITE: "2º Turno (Noite)",
          GERAL: "Geral",
        };
        const movShiftName = shiftMap[mov.shift] || mov.shift;
        const userShiftName = shiftMap[actor.shift] || actor.shift;
        throw forbidden(
          `Espelhamento de Turno (Apenas Leitura): Usuários do ${userShiftName} não possuem permissão para modificar lançamentos registrados pelo ${movShiftName}. Solicite a um operador do respectivo turno ou ao Administrador Geral.`
        );
      }
    }
    if ((mov.type === "AJUSTE_POSITIVO" || mov.type === "AJUSTE_NEGATIVO") && (c.type || c.quantity !== undefined))
      throw badRequest("Ajustes de inventário não podem ser alterados; registre um novo ajuste autorizado.");
    if (mov.source === "AJUSTE_INVENTARIO" && c.void) throw badRequest("Ajustes de inventário não podem ser estornados.");

    const prev = { type: mov.type, quantity: mov.quantity, note: mov.note, status: mov.status };
    const nextState = {
      type: (c.type ?? mov.type) as MovementType, quantity: c.quantity ?? mov.quantity,
      note: c.note === undefined ? mov.note : c.note?.trim() || null, status: c.void ? ("ESTORNADA" as const) : mov.status,
    };
    if (!Number.isInteger(nextState.quantity) || nextState.quantity <= 0) throw badRequest("Quantidade inválida.");
    if (JSON.stringify(prev) === JSON.stringify(nextState)) throw badRequest("Nenhuma alteração informada.");

    const oldEffect = signedQty(prev.type, prev.quantity);
    const newEffect = nextState.status === "ESTORNADA" ? 0 : signedQty(nextState.type, nextState.quantity);
    const rows = await tx.$queryRaw<{ quantity: number }[]>`SELECT "quantity" FROM "StockBalance" WHERE "productId" = ${mov.productId}`;
    const balance = rows[0].quantity;
    const newBalance = balance - oldEffect + newEffect;
    if (newBalance < 0) throw conflict("SALDO_NEGATIVO", `A correção deixaria o saldo negativo (${newBalance}). Saldo atual: ${balance}.`, { balance });

    const updated = await tx.movement.update({ where: { id: mov.id }, data: nextState });
    await tx.stockBalance.update({ where: { productId: mov.productId }, data: { quantity: newBalance, version: { increment: 1 } } });
    const revisionNo = (await tx.movementRevision.count({ where: { movementId: mov.id } })) + 1;
    await tx.movementRevision.create({ data: { movementId: mov.id, revisionNo, previous: prev, next: nextState, justification: justification.trim(), revisedById: userId } });
    await audit(tx, { userId, action: c.void ? "MOVIMENTACAO_ESTORNADA" : "MOVIMENTACAO_CORRIGIDA", entity: "Movement", entityId: mov.id, ip,
      before: { ...prev, saldo: balance }, after: { ...nextState, saldo: newBalance, justificativa: justification.trim() } });
    return updated;
  });
}

// ───────── Consultas ─────────
export async function getCutoff(client: Tx = prisma as unknown as Tx): Promise<Date> {
  const s = await client.setting.findUnique({ where: { key: "stock.cutoff" } });
  return s ? new Date(s.value) : new Date(0);
}

/** Saldo de cada produto em um instante: saldo inicial congelado + movimentações ATIVAS após a data de corte até `asOf`. */
export async function balancesAsOf(asOf: Date, client: Tx = prisma as unknown as Tx): Promise<Map<string, number>> {
  const cutoff = await getCutoff(client);
  const rows = await client.$queryRaw<{ id: string; balance: bigint }[]>(Prisma.sql`
    SELECT p.id, p."initialBalance" + COALESCE(SUM(CASE WHEN m.type IN ('ENTRADA','AJUSTE_POSITIVO') THEN m.quantity ELSE -m.quantity END), 0) AS balance
    FROM "Product" p
    LEFT JOIN "Movement" m ON m."productId" = p.id AND m.status = 'ATIVA' AND m."occurredAt" > ${cutoff} AND m."occurredAt" <= ${asOf}
    GROUP BY p.id`);
  return new Map(rows.map((r) => [r.id, Number(r.balance)]));
}

/** Conferência: saldo materializado × recalculado pelo histórico. Retorna apenas divergências. */
export async function reconcileBalances() {
  const ledger = await balancesAsOf(new Date());
  const stored = await prisma.stockBalance.findMany({ include: { product: { select: { code: true } } } });
  return stored.filter((s) => ledger.get(s.productId) !== s.quantity)
    .map((s) => ({ code: s.product.code, stored: s.quantity, ledger: ledger.get(s.productId) ?? 0 }));
}

export { AppError };
