import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { balance: true },
    orderBy: { sortOrder: "asc" }
  });

  console.log("=== SALDO ATUAL DE TODOS OS PRODUTOS ATIVOS ===");
  for (const p of products) {
    console.log(
      p.code.padEnd(20),
      p.description.padEnd(40),
      p.classification.padEnd(8),
      "Saldo:", String(p.balance?.quantity).padEnd(6),
      "Wh:", String(p.balance?.warehouseQty).padEnd(6),
      "Pre:", String(p.balance?.preAssemblyQty).padEnd(6)
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

