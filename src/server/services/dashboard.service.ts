import { prisma } from "@/lib/db";
import { endOfDay, startOfDay, ymd } from "@/lib/time";
import { compareInventory } from "./inventory.service";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export async function getDashboard() {
  const today = ymd();
  const products = await prisma.product.findMany({ where: { active: true }, include: { client: true, balance: true } });
  const qty = (p: (typeof products)[number]) => p.balance?.quantity ?? 0;
  const sum = (arr: typeof products) => arr.reduce((s, p) => s + qty(p), 0);
  const normal = products.filter((p) => p.classification === "NORMAL"), ng = products.filter((p) => p.classification === "NG");

  const day = { occurredAt: { gte: startOfDay(today), lte: endOfDay(today) }, status: "ATIVA" as const };
  const [inToday, outToday] = await Promise.all([
    prisma.movement.aggregate({ _sum: { quantity: true }, where: { ...day, type: { in: ["ENTRADA", "AJUSTE_POSITIVO"] } } }),
    prisma.movement.aggregate({ _sum: { quantity: true }, where: { ...day, type: { in: ["SAIDA", "AJUSTE_NEGATIVO"] } } }),
  ]);

  const cards = {
    totalProducts: products.length,
    totalPieces: sum(products),
    entriesToday: inToday._sum.quantity ?? 0,
    exitsToday: outToday._sum.quantity ?? 0,
    normalPieces: sum(normal),
    ngPieces: sum(ng),
    warehousePieces: products.reduce((s, p) => s + (p.balance?.warehouseQty ?? 0), 0),
    preAssemblyPieces: products.reduce((s, p) => s + (p.balance?.preAssemblyQty ?? 0), 0),
    belowMin: products.filter((p) => qty(p) > 0 && qty(p) <= p.minStock).length,
    outOfStock: products.filter((p) => qty(p) <= 0).length,
  };

  // Entradas × saídas dos últimos 12 meses (mesmo critério do Aux_Dashboard da planilha)
  const since = new Date(); since.setMonth(since.getMonth() - 11, 1); since.setHours(0, 0, 0, 0);
  const movs = await prisma.movement.findMany({ where: { status: "ATIVA", occurredAt: { gte: since } }, select: { type: true, quantity: true, occurredAt: true, createdBy: { select: { name: true } } } });
  const monthly = new Map<string, { label: string; entradas: number; saidas: number }>();
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i, 1); const k = ymd(d).slice(0, 7);
    monthly.set(k, { label: `${MONTHS[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`, entradas: 0, saidas: 0 }); }
  const daily = new Map<string, { label: string; entradas: number; saidas: number }>();
  const byUser = new Map<string, number>();
  const last30 = Date.now() - 30 * 86400_000;
  for (const m of movs) {
    const isIn = m.type === "ENTRADA" || m.type === "AJUSTE_POSITIVO"; const k = ymd(m.occurredAt).slice(0, 7);
    const b = monthly.get(k); if (b) isIn ? (b.entradas += m.quantity) : (b.saidas += m.quantity);
    if (m.occurredAt.getTime() >= last30) {
      const dk = ymd(m.occurredAt); const d = daily.get(dk) ?? { label: `${dk.slice(8)}/${dk.slice(5, 7)}`, entradas: 0, saidas: 0 };
      isIn ? (d.entradas += m.quantity) : (d.saidas += m.quantity); daily.set(dk, d);
      byUser.set(m.createdBy.name, (byUser.get(m.createdBy.name) ?? 0) + 1);
    }
  }
  const byClient = new Map<string, number>();
  for (const p of products) byClient.set(p.client.name, (byClient.get(p.client.name) ?? 0) + qty(p));
  const recent = await prisma.movement.findMany({ orderBy: { seq: "desc" }, take: 8, include: { product: { select: { code: true } }, createdBy: { select: { name: true } } } });

  return {
    cards,
    charts: {
      entriesVsExits: [...monthly.values()],
      byPeriod: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
      byEmployee: [...byUser.entries()].map(([name, movimentacoes]) => ({ name, movimentacoes })),
      stockByClient: [...byClient.entries()].filter(([, v]) => v > 0).map(([name, saldo]) => ({ name, saldo })),
      topProducts: [...products].sort((a, b) => qty(b) - qty(a)).slice(0, 10).map((p) => ({ code: p.code, description: p.description, saldo: qty(p) })),
    },
    recentMovements: recent.map((m) => ({ id: m.id, number: m.number, type: m.type, code: m.product.code, quantity: m.quantity, user: m.createdBy.name, occurredAt: m.occurredAt })),
    cockpitItems: products.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      model: p.model,
      client: p.client.name,
      classification: p.classification,
      minStock: p.minStock,
      warehouseQty: p.balance?.warehouseQty ?? 0,
      preAssemblyQty: p.balance?.preAssemblyQty ?? 0,
      totalQty: p.balance?.quantity ?? 0,
      status: (p.balance?.quantity ?? 0) <= 0 ? "ZERADO" : (p.balance?.quantity ?? 0) <= p.minStock ? "ABAIXO_MINIMO" : "OK",
    })),
    inventory: await inventoryPanel(),
  };
}

type Tone = "gray" | "yellow" | "red" | "green" | "blue";
async function inventoryPanel() {
  const s = await prisma.inventorySession.findFirst({ orderBy: [{ referenceDate: "desc" }, { startedAt: "desc" }], include: { responsible: { select: { name: true } } } });
  if (!s) return { exists: false as const, alerts: [{ tone: "gray" as Tone, text: "Inventário não iniciado" }] };
  const grouped = await prisma.inventoryCount.groupBy({ by: ["shift"], where: { sessionId: s.id }, _count: { _all: true, physicalQty: true } });
  const shiftState = (shift: "MANHA" | "NOITE") => { const g = grouped.find((x) => x.shift === shift);
    if (!g) return { status: "NAO_INICIADO", counted: 0, total: 0 };
    return { status: g._count.physicalQty >= g._count._all ? "CONCLUIDO" : "EM_ANDAMENTO", counted: g._count.physicalQty, total: g._count._all }; };
  const disc = await prisma.inventoryDiscrepancy.groupBy({ by: ["status"], where: { sessionId: s.id }, _count: true });
  const n = (st: string) => disc.find((d) => d.status === st)?._count ?? 0;
  const total = disc.reduce((a, d) => a + d._count, 0);
  const manha = shiftState("MANHA"), noite = shiftState("NOITE");
  const alerts: { tone: Tone; text: string }[] = [];
  if (s.status === "FECHADO") alerts.push({ tone: "blue", text: "Inventário fechado" });
  else {
    if (manha.status !== "CONCLUIDO" || noite.status !== "CONCLUIDO") alerts.push({ tone: "yellow", text: "Contagem pendente" });
    if (total) alerts.push({ tone: "red", text: "Divergência identificada" });
    if (n("ABERTA") + n("REJEITADA")) alerts.push({ tone: "yellow", text: "Justificativa pendente" });
    if (s.status === "AGUARDANDO_APROVACAO") alerts.push({ tone: "yellow", text: "Inventário aguardando aprovação" });
  }
  // Só compara quando a contagem já foi encerrada (COMPARADO, JUSTIFICATIVAS, AGUARDANDO_APROVACAO, FECHADO)
  // Durante CONTAGEM_MANHA / CONTAGEM_NOITE, compareInventory pode falhar pois ainda não há dados suficientes
  const FINISHED_STATUSES = ["COMPARADO", "JUSTIFICATIVAS", "AGUARDANDO_APROVACAO", "FECHADO"];
  let table: unknown[] = [];
  if (FINISHED_STATUSES.includes(s.status)) {
    try {
      const cmp = await compareInventory(s.id);
      table = cmp.rows.map((r: any) => {
        const last = r.NOITE?.physicalQty !== undefined ? r.NOITE : r.MANHA;
        const diff = last?.difference ?? null;
        return {
          code: r.code, description: r.description,
          system: last?.expectedQty ?? null, physical: last?.physicalQty ?? null, difference: diff,
          situation: diff === null ? "PENDENTE" : diff === 0 ? "CORRETO" : s.status === "FECHADO" ? "TRATADO" : "ANALISE",
        };
      });
    } catch {
      table = [];
    }
  }
  return { exists: true as const, id: s.id, code: s.code, referenceDate: s.referenceDate, status: s.status, responsible: s.responsible.name, morning: manha, night: noite,
    conferred: Math.max(manha.counted, noite.counted), discrepancies: total, justifications: n("JUSTIFICADA") + n("APROVADA"), approved: n("APROVADA"), pendingJustifications: n("ABERTA") + n("REJEITADA"), alerts, table };
}
