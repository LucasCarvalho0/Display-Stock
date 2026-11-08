import { describe, expect, it } from "vitest";
import { closeBlockers, computeExpected, crossShift, difference, isJustificationValid, LedgerMovement } from "@/server/services/inventory-calc";

const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 7, h, m));
const mov = (id: string, type: LedgerMovement["type"], quantity: number, at: Date): LedgerMovement => ({ id, number: id, type, quantity, occurredAt: at });

describe("saldo esperado (regra do prompt, item 12.4)", () => {
  it("780 às 08h + 50 entradas − 30 saídas = 800 → sem divergência com contagem 800", () => {
    const e = computeExpected({ referenceBalance: 780, referenceAt: t(8), countedAt: t(18), movements: [mov("a", "ENTRADA", 50, t(10)), mov("b", "SAIDA", 30, t(12))] });
    expect(e.expected).toBe(800); expect(difference(800, e.expected)).toBe(0); expect(e.related).toHaveLength(2);
  });
  it("esperado 800 e físico 780 → divergência de -20", () => {
    const e = computeExpected({ referenceBalance: 780, referenceAt: t(8), countedAt: t(18), movements: [mov("a", "ENTRADA", 50, t(10)), mov("b", "SAIDA", 30, t(12))] });
    expect(difference(780, e.expected)).toBe(-20);
  });
  it("ignora movimentações fora do intervalo (antes da referência ou depois da contagem)", () => {
    const e = computeExpected({ referenceBalance: 100, referenceAt: t(8), countedAt: t(12), movements: [mov("a", "SAIDA", 5, t(7)), mov("b", "ENTRADA", 7, t(13)), mov("c", "ENTRADA", 3, t(9))] });
    expect(e.expected).toBe(103);
  });
  it("ajustes entram no cálculo com o sinal correto", () => {
    const e = computeExpected({ referenceBalance: 10, referenceAt: t(8), countedAt: t(12), movements: [mov("a", "AJUSTE_NEGATIVO", 4, t(9)), mov("b", "AJUSTE_POSITIVO", 1, t(10))] });
    expect(e.expected).toBe(7);
  });
});

describe("comparação entre turnos (12.5)", () => {
  it("saída legítima entre as contagens não é erro", () => {
    const r = crossShift({ morningPhysical: 800, morningCountedAt: t(10), nightPhysical: 770, nightCountedAt: t(20), movements: [mov("s", "SAIDA", 30, t(15))] });
    expect(r.rawDiff).toBe(-30); expect(r.netMovements).toBe(-30); expect(r.unexplainedDiff).toBe(0);
  });
  it("diferença sem movimentação correspondente fica sem explicação", () => {
    const r = crossShift({ morningPhysical: 780, morningCountedAt: t(10), nightPhysical: 775, nightCountedAt: t(20), movements: [] });
    expect(r.unexplainedDiff).toBe(-5);
  });
});

describe("justificativa e fechamento", () => {
  it("rejeita justificativa vazia ou só com espaços", () => { expect(isJustificationValid("   ")).toBe(false); expect(isJustificationValid("")).toBe(false); expect(isJustificationValid("Saída sem lançamento")).toBe(true); });
  const base = { counts: [{ shift: "MANHA" as const, total: 12, counted: 12 }, { shift: "NOITE" as const, total: 12, counted: 12 }], discrepancies: [], hasSessionApproval: true, countingFinished: true };
  it("libera quando tudo está tratado", () => expect(closeBlockers(base)).toEqual([]));
  it("bloqueia com divergência sem justificativa", () => expect(closeBlockers({ ...base, discrepancies: [{ status: "ABERTA" }] }).join()).toContain("sem justificativa"));
  it("bloqueia com divergência justificada mas não aprovada", () => expect(closeBlockers({ ...base, discrepancies: [{ status: "JUSTIFICADA" }] }).join()).toContain("aguardando aprovação"));
  it("bloqueia sem aprovação do inventário", () => expect(closeBlockers({ ...base, hasSessionApproval: false }).join()).toContain("aprovado"));
  it("bloqueia contagem incompleta ou turno ausente", () => {
    expect(closeBlockers({ ...base, counts: [{ shift: "MANHA", total: 12, counted: 9 }, { shift: "NOITE", total: 12, counted: 12 }] }).join()).toContain("9/12");
    expect(closeBlockers({ ...base, counts: [{ shift: "MANHA", total: 12, counted: 12 }] }).join()).toContain("dois turnos");
  });
});
