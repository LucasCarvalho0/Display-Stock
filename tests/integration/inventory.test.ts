import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approve, closeInventory, compareInventory, finishCounting, justify, saveCount, startInventory, startShift } from "@/server/services/inventory.service";
import { registerMovement } from "@/server/services/stock.service";
import { ctx } from "./setup";
afterAll(() => prisma.$disconnect());

async function actor(email: string) { const u = await prisma.user.findFirstOrThrow({ where: { email }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  return { id: u.id, name: u.name, email: u.email, role: u.role.name, mustChangePassword: false, permissions: u.role.permissions.map((p) => p.permission.key) }; }

describe("fluxo completo de inventário (apenas peças normais)", () => {
  it("inicia → conta manhã/noite → compara → bloqueia fechamento → justifica → aprova → fecha", async () => {
    const lider = await actor("lider1@suaempresa.com.br"); const { product } = await ctx();
    await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 100, userId: lider.id });
    const date = "2031-03-07"; // data isolada
    const s = await startInventory({ referenceDate: date, shift: "MANHA", responsibleId: lider.id }, lider);
    expect(await prisma.inventoryCount.count({ where: { sessionId: s.id, product: { classification: "NG" } } })).toBe(0); // NG fora da v1
    const mine = (shift: "MANHA" | "NOITE") => prisma.inventoryCount.findMany({ where: { sessionId: s.id, shift } });
    for (const c of await mine("MANHA")) await saveCount(s.id, { productId: c.productId, shift: "MANHA", physicalQty: c.productId === product.id ? 100 : c.referenceBalance }, lider);
    await startShift(s.id, "NOITE", lider);
    await registerMovement({ productId: product.id, type: "SAIDA", quantity: 30, userId: lider.id }); // saída legítima no intervalo
    for (const c of await mine("NOITE")) await saveCount(s.id, { productId: c.productId, shift: "NOITE", physicalQty: c.productId === product.id ? 65 : c.referenceBalance }, lider); // 5 a menos que o esperado (70)
    const cmp = await compareInventory(s.id); const row = cmp.rows.find((r: any) => r.productId === product.id)!;
    expect(row.NOITE.expectedQty).toBe(70); expect(row.NOITE.difference).toBe(-5);
    await finishCounting(s.id, lider);
    await expect(closeInventory(s.id, lider)).rejects.toThrow("Não é possível fechar");
    const d = await prisma.inventoryDiscrepancy.findFirstOrThrow({ where: { sessionId: s.id, productId: product.id } });
    await expect(justify(s.id, { discrepancyId: d.id, reason: "OUTROS", text: "  " }, lider)).rejects.toThrow();
    await justify(s.id, { discrepancyId: d.id, reason: "SAIDA_NAO_REGISTRADA", text: "Saída sem lançamento" }, lider);
    await expect(closeInventory(s.id, lider)).rejects.toThrow();
    await approve(s.id, { discrepancyId: d.id, decision: "APROVADO", adjust: true, adjustJustification: "Acerto autorizado" }, lider);
    expect((await prisma.stockBalance.findUniqueOrThrow({ where: { productId: product.id } })).quantity).toBe(65); // ajuste aplicou -5
    await approve(s.id, { decision: "APROVADO" }, lider);
    expect((await closeInventory(s.id, lider)).status).toBe("FECHADO");
  });
});
