import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findUnique({
    where: { code: "BRPRT 3110100001" },
    include: {
      balance: true,
      movements: {
        orderBy: { occurredAt: "desc" },
        take: 10
      },
      discrepancies: {
        include: {
          session: true,
          approvals: true,
          adjustment: true
        }
      }
    }
  });

  console.log("=== PRODUTO MOLDURA TRASEIRA ===");
  console.log("Saldo atual:", product?.balance?.quantity);
  console.log("\n=== MOVIMENTACOES RECENTES ===");
  for (const m of product?.movements ?? []) {
    console.log(m.number, m.type, m.quantity, m.occurredAt, m.note, m.source);
  }

  console.log("\n=== DIVERGENCIAS E AJUSTES ===");
  for (const d of product?.discrepancies ?? []) {
    console.log("Session:", d.session.code, "Shift:", d.shift, "Expected:", d.expectedQty, "Physical:", d.physicalQty, "Diff:", d.difference, "Status:", d.status);
    for (const a of d.approvals) {
      console.log("  Approval:", a.decision, a.comment);
    }
    if (d.adjustment) {
      console.log("  Adjustment:", d.adjustment.quantity, d.adjustment.justification);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
