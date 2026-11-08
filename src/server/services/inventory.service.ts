import { DiscrepancyReason, Shift } from "@prisma/client";
import { prisma, transaction, Tx } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { AuthUser, can } from "@/lib/session";
import { dateOnly } from "@/lib/time";
import { audit } from "./audit.service";
import { applyMovement } from "./stock.service";
import { LedgerMovement, closeBlockers, computeExpected, crossShift, difference, isJustificationValid } from "./inventory-calc";

const CLASSIFICATION_V1 = "NORMAL" as const; // v1: só normais. Para NG, basta aceitar "NG" no start (estrutura já é independente).

async function nextCode(tx: Tx, year: number) {
  const n = await tx.inventorySession.count({ where: { code: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(n + 1).padStart(4, "0")}`;
}

async function snapshotShift(tx: Tx, sessionId: string, shift: Shift, classification: "NORMAL" | "NG") {
  const products = await tx.product.findMany({
    where: { classification, active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], include: { balance: true },
  });
  const now = new Date();
  await tx.inventoryCount.createMany({ data: products.map((p, i) => ({
    sessionId, productId: p.id, shift, position: i + 1, referenceBalance: p.balance?.quantity ?? 0, referenceAt: now,
  })) });
  return products.length;
}

export async function startInventory(i: { referenceDate: string; shift: Shift; responsibleId: string }, user: AuthUser, ip?: string) {
  return transaction(async (tx) => {
    const resp = await tx.user.findFirst({ where: { id: i.responsibleId, active: true } });
    if (!resp) throw badRequest("Responsável inválido.");
    const open = await tx.inventorySession.findFirst({ where: { referenceDate: dateOnly(i.referenceDate), classification: CLASSIFICATION_V1, status: { not: "FECHADO" } } });
    if (open) throw conflict("INVENTARIO_ABERTO", `Já existe o inventário ${open.code} em andamento para esta data.`, { id: open.id });
    const code = await nextCode(tx, Number(i.referenceDate.slice(0, 4)));
    const s = await tx.inventorySession.create({ data: {
      code, referenceDate: dateOnly(i.referenceDate), startShift: i.shift, classification: CLASSIFICATION_V1,
      responsibleId: i.responsibleId, status: i.shift === "MANHA" ? "CONTAGEM_MANHA" : "CONTAGEM_NOITE",
    } });
    const total = await snapshotShift(tx, s.id, i.shift, CLASSIFICATION_V1);
    if (total === 0) throw badRequest("Não há produtos normais ativos para inventariar.");
    await audit(tx, { userId: user.id, action: "INVENTARIO_INICIADO", entity: "InventorySession", entityId: s.id, ip, after: { code, shift: i.shift, total } });
    return s;
  });
}

/** Abre o outro turno com um NOVO snapshot de saldo (contagem independente; nada é copiado do turno anterior). */
export async function startShift(sessionId: string, shift: Shift, user: AuthUser, ip?: string) {
  return transaction(async (tx) => {
    const s = await tx.inventorySession.findUnique({ where: { id: sessionId } });
    if (!s) throw notFound("Inventário não encontrado.");
    if (s.status === "FECHADO") throw conflict("INVENTARIO_FECHADO", "Inventário já fechado.");
    if (["COMPARADO", "JUSTIFICATIVAS", "AGUARDANDO_APROVACAO"].includes(s.status)) throw conflict("CONTAGEM_ENCERRADA", "A contagem já foi encerrada.");
    if (await tx.inventoryCount.count({ where: { sessionId, shift } })) throw conflict("TURNO_JA_INICIADO", "Este turno já foi iniciado.");
    await snapshotShift(tx, sessionId, shift, s.classification);
    await tx.inventorySession.update({ where: { id: sessionId }, data: { status: shift === "MANHA" ? "CONTAGEM_MANHA" : "CONTAGEM_NOITE" } });
    await audit(tx, { userId: user.id, action: "INVENTARIO_TURNO_INICIADO", entity: "InventorySession", entityId: sessionId, ip, after: { shift } });
  });
}

export async function saveCount(sessionId: string, i: { productId: string; shift: Shift; physicalQty: number }, user: AuthUser, ip?: string) {
  return transaction(async (tx) => {
    const s = await tx.inventorySession.findUnique({ where: { id: sessionId } });
    if (!s) throw notFound("Inventário não encontrado.");
    if (["COMPARADO", "JUSTIFICATIVAS", "AGUARDANDO_APROVACAO", "FECHADO"].includes(s.status))
      throw conflict("CONTAGEM_ENCERRADA", "A contagem deste inventário já foi encerrada.");
    const row = await tx.inventoryCount.findUnique({ where: { sessionId_productId_shift: { sessionId, productId: i.productId, shift: i.shift } }, include: { product: true } });
    if (!row) throw notFound("Produto não faz parte deste turno do inventário.");
    if (row.product.classification !== s.classification) throw badRequest("Produto de classificação diferente do inventário.");
    const upd = await tx.inventoryCount.update({ where: { id: row.id }, data: { physicalQty: i.physicalQty, countedAt: new Date(), countedById: user.id } });
    await audit(tx, { userId: user.id, action: "CONTAGEM_REGISTRADA", entity: "InventoryCount", entityId: row.id, ip,
      before: { physicalQty: row.physicalQty }, after: { physicalQty: i.physicalQty, produto: row.product.code, turno: i.shift } });
    return upd;
  });
}

// ───────── Comparação ─────────
async function loadLedger(sessionId: string) {
  const counts = await prisma.inventoryCount.findMany({ where: { sessionId }, include: { product: { include: { client: true } } }, orderBy: [{ shift: "asc" }, { position: "asc" }] });
  const ids = [...new Set(counts.map((c) => c.productId))];
  const times = counts.flatMap((c) => [c.referenceAt, c.countedAt]).filter(Boolean) as Date[];
  const movs = ids.length ? await prisma.movement.findMany({
    where: { productId: { in: ids }, status: "ATIVA", occurredAt: { gt: new Date(Math.min(...times.map((t) => t.getTime()))), lte: new Date(Math.max(...times.map((t) => t.getTime()))) } },
    include: { createdBy: { select: { name: true } } }, orderBy: { occurredAt: "asc" },
  }) : [];
  const byProduct = new Map<string, LedgerMovement[]>();
  for (const m of movs) {
    const arr = byProduct.get(m.productId) ?? [];
    arr.push({ id: m.id, number: m.number, type: m.type, quantity: m.quantity, occurredAt: m.occurredAt, userName: m.createdBy.name });
    byProduct.set(m.productId, arr);
  }
  return { counts, byProduct };
}

export async function compareInventory(sessionId: string) {
  const session = await prisma.inventorySession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound("Inventário não encontrado.");
  const { counts, byProduct } = await loadLedger(sessionId);
  const products = new Map<string, any>();
  for (const c of counts) {
    const p = products.get(c.productId) ?? { productId: c.productId, code: c.product.code, description: c.product.description, model: c.product.model, position: c.position, MANHA: null, NOITE: null };
    const movements = byProduct.get(c.productId) ?? [];
    if (c.physicalQty !== null && c.countedAt) {
      const e = computeExpected({ referenceBalance: c.referenceBalance, referenceAt: c.referenceAt, countedAt: c.countedAt, movements });
      p[c.shift] = { referenceBalance: c.referenceBalance, referenceAt: c.referenceAt, countedAt: c.countedAt, physicalQty: c.physicalQty,
        expectedQty: e.expected, netMovements: e.netMovements, difference: difference(c.physicalQty, e.expected), movements: e.related };
    } else p[c.shift] = { pending: true, referenceBalance: c.referenceBalance };
    products.set(c.productId, p);
  }
  const rows = [...products.values()].sort((a, b) => a.position - b.position).map((p) => {
    let between = null;
    if (p.MANHA?.physicalQty !== undefined && p.NOITE?.physicalQty !== undefined) {
      between = crossShift({ morningPhysical: p.MANHA.physicalQty, morningCountedAt: p.MANHA.countedAt, nightPhysical: p.NOITE.physicalQty, nightCountedAt: p.NOITE.countedAt, movements: byProduct.get(p.productId) ?? [] });
    }
    const hasDiff = (p.MANHA?.difference ?? 0) !== 0 || (p.NOITE?.difference ?? 0) !== 0 || (between?.unexplainedDiff ?? 0) !== 0;
    return { ...p, betweenShifts: between, hasDiscrepancy: hasDiff };
  });
  return { session, rows };
}

/** Encerra a contagem: exige os dois turnos completos, gera as ocorrências de divergência e avança o fluxo. */
export async function finishCounting(sessionId: string, user: AuthUser, ip?: string) {
  const cmp = await compareInventory(sessionId);
  return transaction(async (tx) => {
    const s = cmp.session;
    if (!["CONTAGEM_MANHA", "CONTAGEM_NOITE", "INICIADO"].includes(s.status)) throw conflict("FLUXO_INVALIDO", "A contagem já foi encerrada.");
    const totals = await tx.inventoryCount.groupBy({ by: ["shift"], where: { sessionId }, _count: { _all: true, physicalQty: true } });
    if (totals.length < 2) throw conflict("TURNO_FALTANDO", "Conte os dois turnos (manhã e noite) antes de comparar.");
    for (const t of totals) if (t._count.physicalQty < t._count._all) throw conflict("CONTAGEM_INCOMPLETA", `Contagem do turno ${t.shift === "MANHA" ? "da manhã" : "da noite"} incompleta (${t._count.physicalQty}/${t._count._all}).`);
    let created = 0;
    for (const r of cmp.rows) for (const shift of ["MANHA", "NOITE"] as const) {
      const d = r[shift];
      if (!d || d.difference === 0) continue;
      await tx.inventoryDiscrepancy.upsert({
        where: { sessionId_productId_shift: { sessionId, productId: r.productId, shift } },
        create: { sessionId, productId: r.productId, shift, expectedQty: d.expectedQty, physicalQty: d.physicalQty, difference: d.difference },
        update: {},
      });
      created++;
    }
    const status = created > 0 ? "COMPARADO" : "AGUARDANDO_APROVACAO";
    await tx.inventorySession.update({ where: { id: sessionId }, data: { status } });
    await audit(tx, { userId: user.id, action: "INVENTARIO_COMPARADO", entity: "InventorySession", entityId: sessionId, ip, after: { divergencias: created } });
    return { status, discrepancies: created };
  });
}

export async function justify(sessionId: string, i: { discrepancyId: string; reason: DiscrepancyReason; text: string }, user: AuthUser, ip?: string) {
  if (!isJustificationValid(i.text)) throw badRequest("A justificativa não pode ser vazia (mínimo 5 caracteres).");
  return transaction(async (tx) => {
    const d = await tx.inventoryDiscrepancy.findFirst({ where: { id: i.discrepancyId, sessionId }, include: { session: true } });
    if (!d) throw notFound("Divergência não encontrada.");
    if (d.session.status === "FECHADO") throw conflict("INVENTARIO_FECHADO", "Inventário já fechado.");
    if (d.status === "APROVADA") throw conflict("JA_APROVADA", "Divergência já aprovada.");
    await tx.inventoryJustification.create({ data: { discrepancyId: d.id, reason: i.reason, text: i.text.trim(), userId: user.id } });
    await tx.inventoryDiscrepancy.update({ where: { id: d.id }, data: { status: "JUSTIFICADA" } });
    const pending = await tx.inventoryDiscrepancy.count({ where: { sessionId, status: { in: ["ABERTA", "REJEITADA"] } } });
    await tx.inventorySession.update({ where: { id: sessionId }, data: { status: pending ? "JUSTIFICATIVAS" : "AGUARDANDO_APROVACAO" } });
    await audit(tx, { userId: user.id, action: "DIVERGENCIA_JUSTIFICADA", entity: "InventoryDiscrepancy", entityId: d.id, ip, after: { reason: i.reason, text: i.text.trim() } });
  });
}

export async function approve(sessionId: string, i: { discrepancyId?: string; decision: "APROVADO" | "REJEITADO"; comment?: string; adjust?: boolean; adjustJustification?: string }, user: AuthUser, ip?: string) {
  return transaction(async (tx) => {
    const s = await tx.inventorySession.findUnique({ where: { id: sessionId } });
    if (!s) throw notFound("Inventário não encontrado.");
    if (s.status === "FECHADO") throw conflict("INVENTARIO_FECHADO", "Inventário já fechado.");
    if (!["COMPARADO", "JUSTIFICATIVAS", "AGUARDANDO_APROVACAO"].includes(s.status)) throw conflict("FLUXO_INVALIDO", "Encerre a contagem antes de aprovar.");

    if (!i.discrepancyId) { // aprovação do inventário como um todo
      if (i.decision !== "APROVADO") throw badRequest("Para recusar, trate as divergências individualmente.");
      const open = await tx.inventoryDiscrepancy.count({ where: { sessionId, status: { not: "APROVADA" } } });
      if (open) throw conflict("DIVERGENCIAS_PENDENTES", `Ainda existem ${open} divergência(s) não aprovadas.`);
      await tx.inventoryApproval.create({ data: { sessionId, decision: "APROVADO", comment: i.comment, approverId: user.id } });
      await audit(tx, { userId: user.id, action: "INVENTARIO_APROVADO", entity: "InventorySession", entityId: sessionId, ip });
      return { scope: "INVENTARIO" };
    }

    const d = await tx.inventoryDiscrepancy.findFirst({ where: { id: i.discrepancyId, sessionId }, include: { product: true } });
    if (!d) throw notFound("Divergência não encontrada.");
    if (d.status !== "JUSTIFICADA") throw conflict("SEM_JUSTIFICATIVA", "A divergência precisa estar justificada para ser analisada.");
    if (i.decision === "REJEITADO" && !i.comment?.trim()) throw badRequest("Informe o motivo da rejeição.");

    await tx.inventoryApproval.create({ data: { sessionId, discrepancyId: d.id, decision: i.decision, comment: i.comment, approverId: user.id } });
    await tx.inventoryDiscrepancy.update({ where: { id: d.id }, data: { status: i.decision === "APROVADO" ? "APROVADA" : "REJEITADA" } });

    if (i.decision === "APROVADO" && i.adjust) {
      if (!can(user, "adjustments.authorize")) throw forbidden("Você não pode autorizar ajustes de estoque.");
      if (!isJustificationValid(i.adjustJustification)) throw badRequest("Informe a justificativa do ajuste.");
      const { movement } = await applyMovement(tx, { productId: d.productId, type: d.difference > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        quantity: Math.abs(d.difference), note: `Ajuste do inventário ${s.code}: ${i.adjustJustification!.trim()}`, userId: user.id, source: "AJUSTE_INVENTARIO", ip });
      await tx.stockAdjustment.create({ data: { sessionId, discrepancyId: d.id, movementId: movement.id, quantity: d.difference, justification: i.adjustJustification!.trim(), authorizedById: user.id } });
    }
    const pending = await tx.inventoryDiscrepancy.count({ where: { sessionId, status: { in: ["ABERTA", "REJEITADA"] } } });
    await tx.inventorySession.update({ where: { id: sessionId }, data: { status: pending ? "JUSTIFICATIVAS" : "AGUARDANDO_APROVACAO" } });
    await audit(tx, { userId: user.id, action: i.decision === "APROVADO" ? "DIVERGENCIA_APROVADA" : "DIVERGENCIA_REJEITADA", entity: "InventoryDiscrepancy", entityId: d.id, ip, after: { comment: i.comment, ajuste: !!i.adjust } });
    return { scope: "DIVERGENCIA" };
  });
}

export async function closeCheck(sessionId: string, client: Tx = prisma as unknown as Tx) {
  const s = await client.inventorySession.findUnique({ where: { id: sessionId } });
  if (!s) throw notFound("Inventário não encontrado.");
  const grouped = await client.inventoryCount.groupBy({ by: ["shift"], where: { sessionId }, _count: { _all: true, physicalQty: true } });
  const discrepancies = await client.inventoryDiscrepancy.findMany({ where: { sessionId }, select: { status: true } });
  const approval = await client.inventoryApproval.findFirst({ where: { sessionId, discrepancyId: null, decision: "APROVADO" } });
  const finished = ["COMPARADO", "JUSTIFICATIVAS", "AGUARDANDO_APROVACAO", "FECHADO"].includes(s.status);
  return closeBlockers({ counts: grouped.map((g) => ({ shift: g.shift, total: g._count._all, counted: g._count.physicalQty })),
    discrepancies, hasSessionApproval: !!approval, countingFinished: finished });
}

export async function closeInventory(sessionId: string, user: AuthUser, ip?: string) {
  return transaction(async (tx) => {
    const s = await tx.inventorySession.findUnique({ where: { id: sessionId } });
    if (!s) throw notFound("Inventário não encontrado.");
    if (s.status === "FECHADO") throw conflict("INVENTARIO_FECHADO", "Inventário já fechado.");
    const blockers = await closeCheck(sessionId, tx);
    if (blockers.length) throw conflict("FECHAMENTO_BLOQUEADO", "Não é possível fechar o inventário.", { blockers });
    const closed = await tx.inventorySession.update({ where: { id: sessionId }, data: { status: "FECHADO", closedAt: new Date(), closedById: user.id } });
    await audit(tx, { userId: user.id, action: "INVENTARIO_FECHADO", entity: "InventorySession", entityId: sessionId, ip });
    return closed;
  });
}

export async function getInventory(sessionId: string) {
  const s = await prisma.inventorySession.findUnique({ where: { id: sessionId }, include: { responsible: { select: { name: true } } } });
  if (!s) throw notFound("Inventário não encontrado.");
  const grouped = await prisma.inventoryCount.groupBy({ by: ["shift"], where: { sessionId }, _count: { _all: true, physicalQty: true } });
  const progress = Object.fromEntries(grouped.map((g) => [g.shift, { total: g._count._all, counted: g._count.physicalQty }]));
  const discrepancies = await prisma.inventoryDiscrepancy.findMany({ where: { sessionId }, include: { product: true, justifications: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }, approvals: { include: { approver: { select: { name: true } } } } }, orderBy: { detectedAt: "asc" } });
  const blockers = s.status === "FECHADO" ? [] : await closeCheck(sessionId);
  return { ...s, progress, discrepancies, blockers };
}

export async function getCountItems(sessionId: string, shift: Shift) {
  const items = await prisma.inventoryCount.findMany({ where: { sessionId, shift }, include: { product: true }, orderBy: { position: "asc" } });
  return items.map((c) => ({ id: c.id, productId: c.productId, position: c.position, code: c.product.code, description: c.product.description, model: c.product.model,
    systemBalance: c.referenceBalance, physicalQty: c.physicalQty, countedAt: c.countedAt }));
}

export async function listInventories() {
  return prisma.inventorySession.findMany({ orderBy: [{ referenceDate: "desc" }, { startedAt: "desc" }], take: 100, include: { responsible: { select: { name: true } }, _count: { select: { discrepancies: true } } } });
}
