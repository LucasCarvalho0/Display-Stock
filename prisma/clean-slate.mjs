import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza e ponto de partida limpo...");

  const rawData = fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8");
  const seedData = JSON.parse(rawData);

  // 1. Remover inventários anteriores/ajustes/revisões/movimentações
  console.log("Limpando movimentações e históricos...");
  const delAdj = await prisma.stockAdjustment.deleteMany();
  console.log(`Ajustes removidos: ${delAdj.count}`);

  const delRev = await prisma.movementRevision.deleteMany();
  console.log(`Revisões removidas: ${delRev.count}`);

  const delMov = await prisma.movement.deleteMany();
  console.log(`Movimentações removidas: ${delMov.count}`);

  // Limpar contagens/divergências se houver sessões de inventário de teste
  const delJust = await prisma.inventoryJustification.deleteMany();
  const delDisc = await prisma.inventoryDiscrepancy.deleteMany();
  const delCount = await prisma.inventoryCount.deleteMany();
  const delSess = await prisma.inventorySession.deleteMany();
  console.log(`Sessões de inventário removidas: ${delSess.count}`);

  // 2. Atualizar cada produto com seu saldo real congelado
  console.log("Atualizando saldos reais dos 25 produtos...");
  let sumNormal = 0;
  let sumNG = 0;

  for (const p of seedData.products) {
    const realBalance = p.expectedBalance;
    if (p.classification === "NORMAL") sumNormal += realBalance;
    else sumNG += realBalance;

    await prisma.product.update({
      where: { code: p.code },
      data: {
        initialBalance: realBalance,
        active: true,
      },
    });

    await prisma.stockBalance.upsert({
      where: { productId: (await prisma.product.findUniqueOrThrow({ where: { code: p.code } })).id },
      create: {
        productId: (await prisma.product.findUniqueOrThrow({ where: { code: p.code } })).id,
        quantity: realBalance,
        version: 1,
      },
      update: {
        quantity: realBalance,
        version: 1,
      },
    });
  }

  // 3. Reiniciar a sequência de numeração do Postgres para MOV-000001
  try {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Movement_seq_seq" RESTART WITH 1;`);
    console.log("Sequência de numeração reiniciada para 1 (próximo MOV-000001).");
  } catch (err) {
    console.warn("Nota sobre sequência:", err.message);
  }

  // 4. Atualizar marco temporal de corte
  await prisma.setting.upsert({
    where: { key: "stock.cutoff" },
    create: { key: "stock.cutoff", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  // 5. Validação final
  const totalMovs = await prisma.movement.count();
  const totalProducts = await prisma.product.count({ where: { active: true } });
  const allBalances = await prisma.stockBalance.findMany({
    include: { product: true },
  });

  let valNormal = 0;
  let valNG = 0;
  for (const b of allBalances) {
    if (b.product.classification === "NORMAL") valNormal += b.quantity;
    else valNG += b.quantity;
  }

  console.log("\n==================================================");
  console.log(`PRODUTOS ATIVOS: ${totalProducts}`);
  console.log(`MOVIMENTAÇÕES NO BANCO: ${totalMovs}`);
  console.log(`SALDO NORMAL OPERACIONAL: ${valNormal} (Esperado: 15008)`);
  console.log(`SALDO NG (QUARENTENA): ${valNG} (Esperado: 646)`);
  console.log(`SALDO FÍSICO TOTAL: ${valNormal + valNG} (Esperado: 15654)`);
  console.log("==================================================");

  if (totalMovs !== 0 || valNormal !== 15008 || valNG !== 646) {
    throw new Error("Divergência nos valores esperados!");
  }

  console.log("Ponto de partida configurado com sucesso e 100% validado!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Erro ao aplicar clean-slate:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

