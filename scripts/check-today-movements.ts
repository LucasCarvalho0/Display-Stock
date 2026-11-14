import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const movs = await prisma.movement.findMany({
    where: {
      productId: { in: (await prisma.product.findMany({ where: { active: true } })).map(p => p.id) },
      occurredAt: { gte: new Date("2026-11-13T00:00:00Z") }
    },
    include: { product: true }
  });

  console.log("=== MOVIMENTACOES DE HOJE (13/11/2026) ===");
  for (const m of movs) {
    console.log(m.number, m.product.code, m.type, m.quantity, m.occurredAt, m.note);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

