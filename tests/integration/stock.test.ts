import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { correctMovement, reconcileBalances, registerMovement } from "@/server/services/stock.service";
import { ctx } from "./setup";

afterAll(() => prisma.$disconnect());
const bal = async (id: string) => (await prisma.stockBalance.findUniqueOrThrow({ where: { productId: id } })).quantity;

describe("estoque e movimentações", () => {
  it("entrada e saída atualizam o saldo, numeram e registram o responsável", async () => {
    const { user, product } = await ctx();
    const a = await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 50, userId: user.id });
    const b = await registerMovement({ productId: product.id, type: "SAIDA", quantity: 30, userId: user.id });
    expect(await bal(product.id)).toBe(20); expect(a.movement.number).toMatch(/^MOV-\d{6}$/); expect(b.movement.seq).toBeGreaterThan(a.movement.seq); expect(b.movement.createdById).toBe(user.id);
  });
  it("bloqueia saída maior que o saldo com a mensagem do prompt", async () => {
    const { user, product } = await ctx(); await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 20, userId: user.id });
    await expect(registerMovement({ productId: product.id, type: "SAIDA", quantity: 25, userId: user.id })).rejects.toThrow("Saldo insuficiente. Existem apenas 20 unidades disponíveis.");
    expect(await bal(product.id)).toBe(20);
  });
  it("CONCORRÊNCIA: duas saídas simultâneas das últimas unidades — só uma passa", async () => {
    const { user, product } = await ctx(); await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 10, userId: user.id });
    const r = await Promise.allSettled([registerMovement({ productId: product.id, type: "SAIDA", quantity: 10, userId: user.id }), registerMovement({ productId: product.id, type: "SAIDA", quantity: 10, userId: user.id })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1); expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(await bal(product.id)).toBe(0);
  });
  it("CONCORRÊNCIA: 20 saídas de 1 contra saldo 15 → exatamente 15 passam, saldo 0", async () => {
    const { user, product } = await ctx(); await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 15, userId: user.id });
    const r = await Promise.allSettled(Array.from({ length: 20 }, () => registerMovement({ productId: product.id, type: "SAIDA", quantity: 1, userId: user.id })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(15); expect(await bal(product.id)).toBe(0);
  });
  it("correção preserva número e histórico, recalcula o saldo e exige justificativa", async () => {
    const { user, product } = await ctx(); const m = (await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 50, userId: user.id })).movement;
    await expect(correctMovement(m.id, { quantity: 40 }, "", user.id)).rejects.toThrow("justificativa");
    await correctMovement(m.id, { quantity: 40 }, "Digitei errado", user.id);
    const after = await prisma.movement.findUniqueOrThrow({ where: { id: m.id }, include: { revisions: true } });
    expect(after.number).toBe(m.number); expect(after.quantity).toBe(40); expect(after.revisions[0].previous).toMatchObject({ quantity: 50 }); expect(after.revisions[0].next).toMatchObject({ quantity: 40 }); expect(await bal(product.id)).toBe(40);
  });
  it("correção que deixaria o saldo negativo é recusada", async () => {
    const { user, product } = await ctx(); const m = (await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 10, userId: user.id })).movement;
    await registerMovement({ productId: product.id, type: "SAIDA", quantity: 8, userId: user.id });
    await expect(correctMovement(m.id, { void: true }, "Estorno indevido", user.id)).rejects.toThrow("negativo"); expect(await bal(product.id)).toBe(2);
  });
  it("movimentações não podem ser excluídas fisicamente (trigger)", async () => {
    const { user, product } = await ctx(); const m = (await registerMovement({ productId: product.id, type: "ENTRADA", quantity: 1, userId: user.id })).movement;
    await expect(prisma.movement.delete({ where: { id: m.id } })).rejects.toThrow();
  });
  it("saldo materializado confere com o histórico", async () => { expect(await reconcileBalances()).toEqual([]); });
});
