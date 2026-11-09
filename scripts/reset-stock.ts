import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza e zeramento de estoque para homologação limpa...");

  // 1. Limpar movimentações antigas
  const delMovs = await prisma.movement.deleteMany({});
  console.log("Movimentações removidas:", delMovs.count);

  // 2. Limpar sessões e contagens de inventário
  const delCounts = await prisma.inventoryCount.deleteMany({});
  const delDisc = await prisma.inventoryDiscrepancy.deleteMany({});
  const delSessions = await prisma.inventorySession.deleteMany({});
  console.log(
    `Inventários limpos: sessões=${delSessions.count}, contagens=${delCounts.count}, discrepâncias=${delDisc.count}`
  );

  // 3. Zerar saldos na tabela StockBalance
  const updBalances = await prisma.stockBalance.updateMany({
    data: { quantity: 0 },
  });
  console.log("Saldos físicos zerados:", updBalances.count);

  // 4. Zerar initialBalance nos produtos
  const updProducts = await prisma.product.updateMany({
    data: { initialBalance: 0 },
  });
  console.log("Produtos com initialBalance zerado:", updProducts.count);

  // 5. Conferência final
  const [totalProducts, balancesSum, normalSum, ngSum] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.stockBalance.aggregate({ _sum: { quantity: true } }),
    prisma.stockBalance.aggregate({
      _sum: { quantity: true },
      where: { product: { classification: "NORMAL" } },
    }),
    prisma.stockBalance.aggregate({
      _sum: { quantity: true },
      where: { product: { classification: "NG" } },
    }),
  ]);

  console.log("====================================");
  console.log("RESULTADO FINAL APÓS ZERAMENTO:");
  console.log("Total de Part Numbers ativos:", totalProducts);
  console.log("Total de Peças em Estoque:", balancesSum._sum.quantity ?? 0);
  console.log("Peças Normais:", normalSum._sum.quantity ?? 0);
  console.log("Peças NG (Quarentena):", ngSum._sum.quantity ?? 0);
  console.log("====================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro ao zerar:", err);
  process.exit(1);
});
