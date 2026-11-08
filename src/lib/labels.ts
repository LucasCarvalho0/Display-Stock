export type Tone = "gray" | "green" | "red" | "yellow" | "blue";
export const INV_STATUS: Record<string, [string, Tone]> = {
  INICIADO: ["Iniciado", "gray"], CONTAGEM_MANHA: ["Contagem da manhã", "yellow"], CONTAGEM_NOITE: ["Contagem da noite", "yellow"],
  COMPARADO: ["Divergências", "red"], JUSTIFICATIVAS: ["Em justificativas", "yellow"], AGUARDANDO_APROVACAO: ["Aguardando aprovação", "yellow"], FECHADO: ["Fechado", "blue"],
};
