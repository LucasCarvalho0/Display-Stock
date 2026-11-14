import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const molduras = await prisma.product.findMany({
    where: { description: { contains: "Moldura", mode: "insensitive" } },
    include: { balance: true }
  });
  console.log("=== MOLDURAS NO BANCO ===");
  for (const m of molduras) {
    console.log(m.code, "|", m.description, "|", m.classification, "| Qty:", m.balance?.quantity, "| Wh:", m.balance?.warehouseQty, "| Pre:", m.balance?.preAssemblyQty);
  }

  const allProducts = await prisma.product.findMany({
    where: { active: true },
    include: { balance: true },
    orderBy: { code: "asc" }
  });
  console.log("=== TODOS OS PRODUTOS ATIVOS ===");
  for (const p of allProducts) {
    console.log(p.code, "|", p.description, "| Qty:", p.balance?.quantity);
  }

  const invs = await prisma.inventorySession.findMany({
    orderBy: { startedAt: "desc" },
    take: 3,
    include: {
      counts: {
        include: { product: true }
      }
    }
  });
  console.log("=== ULTIMOS INVENTARIOS ===");
  for (const inv of invs) {
    console.log(inv.code, inv.referenceDate, inv.status);
    for (const c of inv.counts) {
      if (c.product.description.includes("Moldura")) {
        console.log("  Count:", c.shift, c.product.code, "refBal:", c.referenceBalance, "whQty:", c.warehouseQty, "preQty:", c.preAssemblyQty, "phyQty:", c.physicalQty);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

