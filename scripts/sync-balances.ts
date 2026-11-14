import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Ajusta 99098xA0A para 1070
  await prisma.stockBalance.update({
    where: { productId: (await prisma.product.findFirst({ where: { code: "99098xA0A", classification: "NORMAL" } }))!.id },
    data: { quantity: 1070, warehouseQty: 1070, preAssemblyQty: 0 }
  });

  // Alinha warehouseQty = quantity para todos onde warehouseQty < 0 ou dessincronizado
  const allBalances = await prisma.stockBalance.findMany({ include: { product: true } });
  for (const b of allBalances) {
    if (b.warehouseQty !== b.quantity) {
      await prisma.stockBalance.update({
        where: { productId: b.productId },
        data: { warehouseQty: b.quantity, preAssemblyQty: 0 }
      });
      console.log(`Sincronizado ${b.product.code}: ${b.quantity}`);
    }
  }

  console.log("Verificação final:");
  const finalBalances = await prisma.stockBalance.findMany({
    include: { product: true },
    orderBy: [{ product: { classification: "asc" } }, { product: { code: "asc" } }]
  });
  for (const b of finalBalances) {
    console.log(`${b.product.code.padEnd(20)} ${b.product.classification.padEnd(7)} Saldo: ${b.quantity}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

