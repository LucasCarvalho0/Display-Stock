// Regras PURAS do inventário (sem banco). Cobertas por tests/unit/inventory-calc.test.ts.
export type LedgerMovement = {
  id: string; number: string; type: "ENTRADA" | "SAIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  quantity: number; occurredAt: Date; userName?: string;
};
export const signed = (m: Pick<LedgerMovement, "type" | "quantity">) =>
  m.type === "ENTRADA" || m.type === "AJUSTE_POSITIVO" ? m.quantity : -m.quantity;

export const between = (movs: LedgerMovement[], after: Date, upTo: Date) =>
  movs.filter((m) => m.occurredAt > after && m.occurredAt <= upTo).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

/** Saldo esperado = saldo de referência + movimentações válidas entre a referência e o instante da contagem. */
export function computeExpected(a: { referenceBalance: number; referenceAt: Date; countedAt: Date; movements: LedgerMovement[] }) {
  const related = between(a.movements, a.referenceAt, a.countedAt);
  const net = related.reduce((s, m) => s + signed(m), 0);
  return { expected: a.referenceBalance + net, netMovements: net, related };
}
export const difference = (physical: number, expected: number) => physical - expected;

/**
 * Entre turnos: a contagem da noite é comparada com (físico da manhã + movimentações entre as duas contagens).
 * Uma saída legítima entre os turnos explica a diferença bruta e NÃO é erro.
 */
export function crossShift(a: { morningPhysical: number; morningCountedAt: Date; nightPhysical: number; nightCountedAt: Date; movements: LedgerMovement[] }) {
  const related = between(a.movements, a.morningCountedAt, a.nightCountedAt);
  const net = related.reduce((s, m) => s + signed(m), 0);
  const rawDiff = a.nightPhysical - a.morningPhysical;
  const expectedNight = a.morningPhysical + net;
  return { rawDiff, netMovements: net, expectedNight, unexplainedDiff: a.nightPhysical - expectedNight, related };
}

export const isJustificationValid = (text: string | undefined | null) => (text ?? "").trim().length >= 5;

export type CloseCheck = {
  counts: { shift: "MANHA" | "NOITE" | "GERAL"; total: number; counted: number }[];
  discrepancies: { status: "ABERTA" | "JUSTIFICADA" | "APROVADA" | "REJEITADA" }[];
  hasSessionApproval: boolean; countingFinished: boolean;
};
export function closeBlockers(c: CloseCheck): string[] {
  const b: string[] = [];
  for (const s of c.counts) if (s.counted < s.total) b.push(`Contagem do turno ${s.shift === "MANHA" ? "da manhã" : "da noite"} incompleta (${s.counted}/${s.total}).`);
  if (!c.counts.some((s) => s.shift === "MANHA") || !c.counts.some((s) => s.shift === "NOITE")) b.push("Os dois turnos (manhã e noite) precisam ser contados.");
  if (!c.countingFinished) b.push("A comparação automática ainda não foi executada (encerre a contagem).");
  const open = c.discrepancies.filter((d) => d.status === "ABERTA").length;
  const unjustified = c.discrepancies.filter((d) => d.status === "REJEITADA").length;
  const pending = c.discrepancies.filter((d) => d.status === "JUSTIFICADA").length;
  if (open) b.push(`${open} divergência(s) sem justificativa.`);
  if (unjustified) b.push(`${unjustified} divergência(s) rejeitada(s) aguardando nova justificativa.`);
  if (pending) b.push(`${pending} divergência(s) justificada(s) aguardando aprovação.`);
  if (!c.hasSessionApproval) b.push("O inventário ainda não foi aprovado pelo responsável.");
  return b;
}
