import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Dados exatos enviados pelo líder operacional da Sesé
const FACTORY_ITEMS: {
  code: string;
  name: string;
  warehouse: number;
  preAssembly: number;
}[] = [
  { code: "99098xA0A", name: "Adesivo Pillar L/D", warehouse: 1520, preAssembly: 34 },
  { code: "99099xA0A", name: "Adesivo Pillar L/E", warehouse: 1320, preAssembly: 36 },
  { code: "BRPRT 11605", name: "Kit chicote c/ botão", warehouse: 0, preAssembly: 0 },
  { code: "BRPRT 11604", name: "Kit chicote s/ botão", warehouse: 1446, preAssembly: 0 },
  { code: "BRPRT 11749", name: "Kit chicote L1", warehouse: 9, preAssembly: 0 },
  { code: "BRPRT 3110100001", name: "Moldura Traseira", warehouse: 1861, preAssembly: 408 },
  { code: "BRPRT 11607", name: "Moldura COM Botão", warehouse: 862, preAssembly: 0 },
  { code: "BRPRT 11608", name: "Moldura SEM Botão", warehouse: 780, preAssembly: 0 },
  { code: "BRPRT 11603", name: "Multimidia Pioneer", warehouse: 880, preAssembly: 408 },
  { code: "BRPRT11609", name: "Tampa USB", warehouse: 2784, preAssembly: 217 },
  { code: "BRPRT 11632", name: "Tampa Cega P/ Moldura Multimidia PCD", warehouse: 288, preAssembly: 56 },
];

async function main() {
  console.log("Aplicando saldos de Estoque Fechado e Pré-Montagem da fábrica...");

  for (const item of FACTORY_ITEMS) {
    const product = await prisma.product.findUnique({
      where: { code: item.code },
    });

    if (!product) {
      console.warn(`Produto com código ${item.code} não encontrado no banco.`);
      continue;
    }

    const total = item.warehouse + item.preAssembly;

    await prisma.stockBalance.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        warehouseQty: item.warehouse,
        preAssemblyQty: item.preAssembly,
        quantity: total,
      },
      update: {
        warehouseQty: item.warehouse,
        preAssemblyQty: item.preAssembly,
        quantity: total,
      },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        initialWarehouse: item.warehouse,
        initialPreAssembly: item.preAssembly,
        initialBalance: total,
      },
    });

    console.log(
      `✓ ${item.name} (${item.code}): Estoque=${item.warehouse} + Pré-Montagem=${item.preAssembly} = Total=${total}`
    );
  }

  const balances = await prisma.stockBalance.aggregate({
    _sum: { quantity: true, warehouseQty: true, preAssemblyQty: true },
  });

  console.log("-----------------------------------------");
  console.log("TOTAL CONSOLIDADO NO BANCO DE DADOS:");
  console.log("Total Pallets Fechados (Estoque):", balances._sum.warehouseQty);
  console.log("Total Pré-Montagem:", balances._sum.preAssemblyQty);
  console.log("Total Físico Geral:", balances._sum.quantity);
  console.log("-----------------------------------------");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});

