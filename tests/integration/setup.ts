// Integração: usa um PostgreSQL REAL (DATABASE_URL de teste). Rode: npx prisma migrate deploy && psql -f prisma/sql/constraints.sql && npm run db:seed
import { prisma } from "@/lib/db";
export async function ctx() {
  const user = await prisma.user.findFirstOrThrow({ where: { email: "lider1@suaempresa.com.br" } });
  const client = await prisma.client.upsert({ where: { name: "TESTE" }, create: { name: "TESTE" }, update: {} });
  const code = `T-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const product = await prisma.product.create({ data: { code, baseCode: code, description: "Peça de teste", model: "X", clientId: client.id, balance: { create: { quantity: 0 } } } });
  return { user, product };
}
