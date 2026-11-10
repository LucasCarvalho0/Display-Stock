/**
 * Script: update-vpc-balances.ts
 * Atualiza os saldos de estoque VPC conforme tabela recebida do usuário.
 * - Cria produtos novos se não existirem
 * - Atualiza saldo dos existentes
 * - Desativa produtos que não estão na lista
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tabela VPC enviada pelo usuário
const VPC_DATA = [
  { code: "99098xA0A NG",         description: "Adesivo L/D C PILLAR",                  model: "Protopico", client: "NISSAN", balance: 23,   classification: "NG" as const },
  { code: "99099xA0A NG",         description: "Adesivo L/E C PILLAR",                  model: "Protopico", client: "NISSAN", balance: 19,   classification: "NG" as const },
  { code: "BRPRT 11605 NG",       description: "KIT Chicote Multimidia c/ botão",        model: "Kait",      client: "NISSAN", balance: 68,   classification: "NG" as const },
  { code: "BRPRT 11604 NG",       description: "KIT Chicote Multimidia s/ botão",        model: "Kait",      client: "NISSAN", balance: 77,   classification: "NG" as const },
  { code: "BRPRT 11607 NG",       description: "Moldura Multimidia c/ botão",            model: "Kait",      client: "NISSAN", balance: 70,   classification: "NG" as const },
  { code: "BRPRT 11608 NG",       description: "Moldura Multimidia s/ botão",            model: "Kait",      client: "NISSAN", balance: 179,  classification: "NG" as const },
  { code: "BRPRT 3110100001 NG",  description: "Moldura Traseira",                       model: "Kait",      client: "NISSAN", balance: 236,  classification: "NG" as const },
  { code: "BRPRT 11603 NG",       description: "Multimidia Pionner",                     model: "Kait",      client: "NISSAN", balance: 4,    classification: "NG" as const },
  { code: "BRPRT 11749 NG",       description: "KIT Chicote Multimidia L1",              model: "Kait",      client: "NISSAN", balance: 0,    classification: "NG" as const },
  { code: "BRPRT11609 NG",        description: "Tampa USB",                              model: "Kait",      client: "NISSAN", balance: 1,    classification: "NG" as const },
  { code: "99098xA0A",            description: "Adesivo L/D C PILLAR",                  model: "Kait",      client: "Nissan", balance: 1270, classification: "NORMAL" as const },
  { code: "99099xA0A",            description: "Adesivo L/E C PILLAR",                  model: "Kait",      client: "Nissan", balance: 1100, classification: "NORMAL" as const },
  { code: "BRPRT 11605",          description: "KIT Chicote Multimidia c/ botão",        model: "Kait",      client: "NISSAN", balance: 140,  classification: "NORMAL" as const },
  { code: "BRPRT 11604",          description: "KIT Chicote Multimidia s/ botão",        model: "Kait",      client: "NISSAN", balance: 1399, classification: "NORMAL" as const },
  { code: "BRPRT 11607",          description: "Moldura Multimidia c/ botão",            model: "Kait",      client: "NISSAN", balance: 720,  classification: "NORMAL" as const },
  { code: "BRPRT 11608",          description: "Moldura Multimidia s/ botão",            model: "Kait",      client: "NISSAN", balance: 120,  classification: "NORMAL" as const },
  { code: "BRPRT 3110100001",     description: "Moldura Traseira",                       model: "Kait",      client: "NISSAN", balance: 927,  classification: "NORMAL" as const },
  { code: "BRPRT 11603",          description: "Multimidia Pionner",                     model: "Kait",      client: "NISSAN", balance: 1320, classification: "NORMAL" as const },
  { code: "BRPRT11609",           description: "Tampa USB",                              model: "Kait",      client: "NISSAN", balance: 2768, classification: "NORMAL" as const },
  { code: "BRPRT 11632",          description: "Tampa Cega P/ Moldura Multimidia PCD",   model: "Kait",      client: "Nissan", balance: 1200, classification: "NORMAL" as const },
  { code: "BRPRT 11633",          description: "Tampa Cega P USB",                       model: "Kait",      client: "Nissan", balance: 1200, classification: "NORMAL" as const },
];

const VPC_CODES = new Set(VPC_DATA.map((p) => p.code));

async function main() {
  console.log("🚀 Iniciando atualização de saldos VPC...\n");

  // Garantir que o cliente NISSAN existe
  let clientNissan = await prisma.client.findFirst({ where: { name: "NISSAN" } });
  if (!clientNissan) {
    clientNissan = await prisma.client.create({ data: { name: "NISSAN" } });
    console.log("✅ Cliente NISSAN criado");
  }

  let created = 0;
  let updated = 0;
  let deactivated = 0;

  // 1) Atualizar ou criar cada produto da lista VPC
  for (let i = 0; i < VPC_DATA.length; i++) {
    const item = VPC_DATA[i];
    const sortOrder = i + 1;

    const existing = await prisma.product.findUnique({ where: { code: item.code } });

    if (existing) {
      // Atualiza produto
      await prisma.product.update({
        where: { code: item.code },
        data: {
          description: item.description,
          model: item.model,
          classification: item.classification,
          active: true,
          sortOrder,
          initialBalance: item.balance,
          initialWarehouse: item.balance,
          initialPreAssembly: 0,
        },
      });
      // Atualiza saldo
      await prisma.stockBalance.upsert({
        where: { productId: existing.id },
        update: { quantity: item.balance, warehouseQty: item.balance, preAssemblyQty: 0 },
        create: { productId: existing.id, quantity: item.balance, warehouseQty: item.balance, preAssemblyQty: 0 },
      });
      console.log(`✏️  [${item.code}] atualizado → saldo: ${item.balance}`);
      updated++;
    } else {
      // Cria produto novo
      const created_prod = await prisma.product.create({
        data: {
          code: item.code,
          baseCode: item.code.replace(" NG", "").trim(),
          description: item.description,
          model: item.model,
          clientId: clientNissan.id,
          classification: item.classification,
          active: true,
          sortOrder,
          initialBalance: item.balance,
          initialWarehouse: item.balance,
          initialPreAssembly: 0,
        },
      });
      await prisma.stockBalance.create({
        data: { productId: created_prod.id, quantity: item.balance, warehouseQty: item.balance, preAssemblyQty: 0 },
      });
      console.log(`➕ [${item.code}] criado → saldo: ${item.balance}`);
      created++;
    }
  }

  // 2) Desativar produtos que NÃO estão na lista VPC
  const allProducts = await prisma.product.findMany({ where: { active: true } });
  for (const p of allProducts) {
    if (!VPC_CODES.has(p.code)) {
      await prisma.product.update({ where: { id: p.id }, data: { active: false } });
      console.log(`🚫 [${p.code}] desativado (não está na lista VPC)`);
      deactivated++;
    }
  }

  console.log(`\n✅ Concluído!`);
  console.log(`   Criados:    ${created}`);
  console.log(`   Atualizados: ${updated}`);
  console.log(`   Desativados: ${deactivated}`);

  const total = VPC_DATA.reduce((s, p) => s + p.balance, 0);
  const normalTotal = VPC_DATA.filter((p) => p.classification === "NORMAL").reduce((s, p) => s + p.balance, 0);
  const ngTotal = VPC_DATA.filter((p) => p.classification === "NG").reduce((s, p) => s + p.balance, 0);
  console.log(`\n📊 Totais no sistema:`);
  console.log(`   Normal: ${normalTotal.toLocaleString("pt-BR")} unidades`);
  console.log(`   NG:     ${ngTotal.toLocaleString("pt-BR")} unidades`);
  console.log(`   Total:  ${total.toLocaleString("pt-BR")} unidades`);
}

main()
  .catch((e) => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

