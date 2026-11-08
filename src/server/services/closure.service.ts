import { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { AuthUser } from "@/lib/session";
import { audit } from "./audit.service";
import { getCutoff } from "./stock.service";

export type ClosureItem = {
  id: string;
  code: string;
  description: string;
  classification: "NORMAL" | "NG";
  initialBalance: number;
  entradas: number;
  saidas: number;
  finalBalance: number;
};

export type HistoricalClosure = {
  id: string;
  year: number;
  closedAt: string;
  closedBy: { name: string; email: string };
  cutoffDate: string;
  totalProducts: number;
  totalInitialBalance: number;
  totalEntradas: number;
  totalSaidas: number;
  totalFinalBalance: number;
  items: ClosureItem[];
};

export async function getClosureData() {
  const cutoff = await getCutoff();

  // Buscar produtos com saldo materializado e movimentações no período pós-corte
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      balance: true,
      movements: {
        where: { status: "ATIVA", occurredAt: { gt: cutoff } },
        select: { type: true, quantity: true },
      },
    },
  });

  const items: ClosureItem[] = products.map((p) => {
    let entradas = 0;
    let saidas = 0;

    for (const m of p.movements) {
      if (m.type === "ENTRADA" || m.type === "AJUSTE_POSITIVO") {
        entradas += m.quantity;
      } else {
        saidas += m.quantity;
      }
    }

    return {
      id: p.id,
      code: p.code,
      description: p.description,
      classification: p.classification,
      initialBalance: p.initialBalance,
      entradas,
      saidas,
      finalBalance: p.balance?.quantity ?? p.initialBalance + entradas - saidas,
    };
  });

  const totals = {
    totalProducts: items.length,
    totalInitialBalance: items.reduce((acc, i) => acc + i.initialBalance, 0),
    totalEntradas: items.reduce((acc, i) => acc + i.entradas, 0),
    totalSaidas: items.reduce((acc, i) => acc + i.saidas, 0),
    totalFinalBalance: items.reduce((acc, i) => acc + i.finalBalance, 0),
  };

  // Carregar histórico de fechamentos salvos nas configurações
  const closureSetting = await prisma.setting.findUnique({ where: { key: "stock.closures" } });
  let history: HistoricalClosure[] = [];
  if (closureSetting?.value) {
    try {
      history = JSON.parse(closureSetting.value);
    } catch {}
  }

  return {
    cutoffDate: cutoff.toISOString(),
    totals,
    items,
    history,
  };
}

export async function closeFiscalYear(user: AuthUser, ip?: string, customDate?: Date) {
  if (user.role !== "Administrador") {
    throw forbidden("Apenas o Administrador Geral possui permissão para executar o fechamento de exercício.");
  }

  const closureDate = customDate ?? new Date();
  const year = closureDate.getFullYear();

  return transaction(async (tx) => {
    const currentCutoff = await getCutoff(tx);
    const data = await getClosureData();

    // 1. Atualizar o initialBalance de cada produto com o saldo real atual
    for (const item of data.items) {
      await tx.product.update({
        where: { id: item.id },
        data: { initialBalance: item.finalBalance },
      });
    }

    // 2. Atualizar a data de corte oficial para o momento do fechamento
    await tx.setting.upsert({
      where: { key: "stock.cutoff" },
      create: { key: "stock.cutoff", value: closureDate.toISOString() },
      update: { value: closureDate.toISOString() },
    });

    // 3. Registrar o fechamento histórico consolidado
    const closureRecord: HistoricalClosure = {
      id: `CLOSURE-${year}-${Date.now()}`,
      year,
      closedAt: new Date().toISOString(),
      closedBy: { name: user.name, email: user.email },
      cutoffDate: closureDate.toISOString(),
      totalProducts: data.totals.totalProducts,
      totalInitialBalance: data.totals.totalInitialBalance,
      totalEntradas: data.totals.totalEntradas,
      totalSaidas: data.totals.totalSaidas,
      totalFinalBalance: data.totals.totalFinalBalance,
      items: data.items,
    };

    const existingClosuresSetting = await tx.setting.findUnique({ where: { key: "stock.closures" } });
    let existingList: HistoricalClosure[] = [];
    if (existingClosuresSetting?.value) {
      try {
        existingList = JSON.parse(existingClosuresSetting.value);
      } catch {}
    }
    existingList.unshift(closureRecord);

    await tx.setting.upsert({
      where: { key: "stock.closures" },
      create: { key: "stock.closures", value: JSON.stringify(existingList) },
      update: { value: JSON.stringify(existingList) },
    });

    // 4. Auditoria criptográfica permanente
    await audit(tx, {
      userId: user.id,
      action: "EXERCICIO_CONGELADO",
      entity: "Setting",
      entityId: "stock.cutoff",
      ip,
      before: { cutoffAnterior: currentCutoff.toISOString() },
      after: {
        novoCutoff: closureDate.toISOString(),
        anoFechado: year,
        totalProdutos: data.totals.totalProducts,
        saldoCongelado: data.totals.totalFinalBalance,
      },
    });

    return closureRecord;
  });
}

