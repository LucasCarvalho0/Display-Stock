import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.inventoryCount.findMany({
    where: { session: { code: "INV-2026-0003" } },
    include: { product: true },
    orderBy: [{ productId: "asc" }, { shift: "asc" }]
  });

  console.log("=== INVENTARIO INV-2026-0003 CONTAGENS ===");
  for (const c of counts) {
    console.log(`${c.product.code.padEnd(20)} ${c.shift.padEnd(7)} Pallet/Wh: ${String(c.warehouseQty).padStart(5)}  Pre: ${String(c.preAssemblyQty).padStart(5)}  Total Fisico: ${String(c.physicalQty).padStart(5)}  Ref: ${String(c.referenceBalance).padStart(5)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
