/* Seed: perfis/permissões, usuários iniciais (3 administrativos + 3 líderes + 1 administrador),
   clientes, 25 produtos da planilha PEÇAS DISPLAY.xlsm, saldo inicial congelado e as 16 movimentações históricas. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import data from "./seed-data.json";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/lib/permissions";
import { applyMovement } from "../src/server/services/stock.service";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_TEMP_PASSWORD ?? "Trocar@123456";
  for (const [key, description] of Object.entries(PERMISSIONS)) await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  const perms = await prisma.permission.findMany();
  for (const [name, def] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({ where: { name }, create: { name, description: def.description }, update: {} });
    if ((await prisma.rolePermission.count({ where: { roleId: role.id } })) === 0)
      await prisma.rolePermission.createMany({ data: perms.filter((p) => def.permissions.includes(p.key as never)).map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  const role = (n: string) => prisma.role.findUniqueOrThrow({ where: { name: n } });
  const passwordHash = await bcrypt.hash(password, 12);
  const people: [string, string, string][] = [
    ["Administrador do Sistema", "admin@suaempresa.com.br", "Administrador"],
    ["Administrativo 1", "administrativo1@suaempresa.com.br", "Administrativo"], ["Administrativo 2", "administrativo2@suaempresa.com.br", "Administrativo"], ["Administrativo 3", "administrativo3@suaempresa.com.br", "Administrativo"],
    ["Líder 1", "lider1@suaempresa.com.br", "Líder"], ["Líder 2", "lider2@suaempresa.com.br", "Líder"], ["Líder 3", "lider3@suaempresa.com.br", "Líder"],
  ];
  for (const [name, email, r] of people) await prisma.user.upsert({ where: { email }, create: { name, email, passwordHash, roleId: (await role(r)).id }, update: {} });
  const importer = await prisma.user.upsert({ where: { email: "importacao@sistema.local" }, create: { name: "Importação da planilha", email: "importacao@sistema.local", passwordHash: await bcrypt.hash(Math.random().toString(36), 10), active: false, roleId: (await role("Administrativo")).id }, update: {} });

  if (await prisma.product.count()) { console.log("Produtos já existem — seed de dados da planilha ignorado."); return; }

  await prisma.setting.upsert({ where: { key: "stock.cutoff" }, create: { key: "stock.cutoff", value: new Date(data.cutoff).toISOString() }, update: {} });
  for (const name of new Set([...data.clients, ...data.products.map((p) => p.client)])) await prisma.client.upsert({ where: { name }, create: { name }, update: {} });
  const clients = new Map((await prisma.client.findMany()).map((c) => [c.name, c.id]));

  for (const p of data.products) {
    const startBalance = p.expectedBalance ?? p.initialBalance;
    await prisma.product.create({ data: {
      code: p.code, baseCode: p.baseCode, description: p.description, model: p.model, clientId: clients.get(p.client)!, classification: p.classification as "NORMAL" | "NG",
      minStock: p.minStock, initialBalance: startBalance, sortOrder: p.sortOrder, sortNissan: p.sortNissan, sortGeral: p.sortGeral,
      balance: { create: { quantity: startBalance } },
    } });
  }
  const byCode = new Map((await prisma.product.findMany()).map((p) => [p.code, p.id]));

  // Conferência com a planilha original
  const bad: string[] = [];
  for (const p of data.products) { const b = await prisma.stockBalance.findUnique({ where: { productId: byCode.get(p.code)! } }); if (b?.quantity !== p.expectedBalance) bad.push(`${p.code}: sistema=${b?.quantity} planilha=${p.expectedBalance}`); }
  if (bad.length) throw new Error("Saldos divergem da planilha:\n" + bad.join("\n"));
  console.log(`Seed OK: ${data.products.length} produtos cadastrados com seus saldos reais da planilha (sem histórico prévio).`);
  console.log(`Usuários criados com a senha temporária de SEED_TEMP_PASSWORD (troca obrigatória no 1º acesso).`);
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
