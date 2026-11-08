// Validação com a planilha original: saldos e ordem dos resumos precisam ser idênticos aos da aba Estoque/Resumo Nissan/Resumo Geral.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildReport } from "@/server/services/report.service";
import expected from "../fixtures/planilha-expected.json";
afterAll(() => prisma.$disconnect());
describe("paridade com PEÇAS DISPLAY.xlsm (requer banco recém-semeado)", () => {
  it("Resumo Nissan: mesmos códigos, mesma ordem, mesmos saldos", async () => {
    const r = await buildReport("RESUMO_NISSAN", expected.asOf);
    expect(r.rows.map((x) => x.code)).toEqual(expected.resumoNissan);
    for (const row of r.rows) expect(row.balance, row.code).toBe((expected.balances as Record<string, number>)[row.code]);
  });
  it("Resumo Geral: mesmos códigos, mesma ordem, mesmos saldos", async () => {
    const r = await buildReport("RESUMO_GERAL", expected.asOf);
    expect(r.rows.map((x) => x.code)).toEqual(expected.resumoGeral);
    for (const row of r.rows) expect(row.balance, row.code).toBe((expected.balances as Record<string, number>)[row.code]);
  });
});
