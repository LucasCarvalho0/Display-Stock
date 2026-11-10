import { PrismaClient } from "@prisma/client";
import seedData from "../prisma/seed-data.json";

const prisma = new PrismaClient();

async function main() {
  console.log("Restaurando saldos oficiais da fábrica a partir da planilha Excel...");

  const products = await prisma.product.findMany();
  const byCode = new Map(products.map((p) => [p.code, p.id]));

  let restoredCount = 0;
  for (const item of seedData.products) {
    const productId = byCode.get(item.code);
    if (!productId) {
      console.warn(`Produto não encontrado no banco: ${item.code}`);
      continue;
    }

    const qty = item.expectedBalance ?? item.initialBalance ?? 0;

    await prisma.stockBalance.upsert({
      where: { productId },
      create: { productId, quantity: qty },
      update: { quantity: qty },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { initialBalance: qty },
    });

    restoredCount++;
  }

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
  console.log("SALDOS RESTAURADOS COM SUCESSO:");
  console.log("Produtos atualizados:", restoredCount);
  console.log("Total de Part Numbers ativos:", totalProducts);
  console.log("Total em Saldo Físico:", balancesSum._sum.quantity ?? 0);
  console.log("Estoque Normal Operacional:", normalSum._sum.quantity ?? 0);
  console.log("Quarentena / Saldo NG:", ngSum._sum.quantity ?? 0);
  console.log("====================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro ao restaurar estoque:", err);
  process.exit(1);
});

