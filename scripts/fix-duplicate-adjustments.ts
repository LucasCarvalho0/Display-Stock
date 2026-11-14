import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== CORRIGINDO AJUSTES DUPLICADOS DE HOJE ===");

  const dupNumbers = [
    "MOV-000059",
    "MOV-000061",
    "MOV-000064",
    "MOV-000066",
    "MOV-000068",
    "MOV-000070",
    "MOV-000072",
    "MOV-000074",
    "MOV-000076",
    "MOV-000078"
  ];

  for (const num of dupNumbers) {
    const mov = await prisma.movement.findUnique({
      where: { number: num },
      include: { product: true, adjustment: true }
    });

    if (!mov) {
      console.log(`Movimentação ${num} não encontrada ou já tratada.`);
      continue;
    }

    if (mov.status === "ESTORNADA") {
      console.log(`Movimentação ${num} já está ESTORNADA.`);
      continue;
    }

    console.log(`Revertendo duplicata ${num}: ${mov.product.code} (${mov.type} ${mov.quantity})`);

    // Remove o StockAdjustment associado, se houver
    if (mov.adjustment) {
      await prisma.stockAdjustment.delete({ where: { id: mov.adjustment.id } });
    }

    // Marca a movimentação como ESTORNADA
    await prisma.movement.update({
      where: { id: mov.id },
      data: { status: "ESTORNADA", note: `${mov.note || ""} [ESTORNADO POR DUPLICIDADE DE INVENTARIO]` }
    });

    // Se era AJUSTE_POSITIVO, reduz do saldo. Se era AJUSTE_NEGATIVO, devolve ao saldo.
    const delta = mov.type === "AJUSTE_POSITIVO" ? -mov.quantity : mov.quantity;

    await prisma.stockBalance.upsert({
      where: { productId: mov.productId },
      update: {
        quantity: { increment: delta },
        warehouseQty: { increment: delta },
        version: { increment: 1 }
      },
      create: {
        productId: mov.productId,
        quantity: delta,
        warehouseQty: delta,
        preAssemblyQty: 0
      }
    });
  }

  console.log("\n=== VERIFICANDO SALDOS APÓS CORREÇÃO ===");
  const balances = await prisma.stockBalance.findMany({
    include: { product: true },
    orderBy: [{ product: { classification: "asc" } }, { product: { code: "asc" } }]
  });

  for (const b of balances) {
    console.log(`${b.product.code.padEnd(20)} ${b.product.classification.padEnd(7)} Saldo: ${b.quantity} (Wh: ${b.warehouseQty}, Pre: ${b.preAssemblyQty})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
