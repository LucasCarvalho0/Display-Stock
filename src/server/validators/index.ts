import { z } from "zod";
const cls = z.enum(["NORMAL", "NG"], { errorMap: () => ({ message: "Classificação deve ser Normal ou NG." }) });
const qty = z.coerce.number({ invalid_type_error: "Informe a quantidade." }).int("A quantidade deve ser inteira.").positive("A quantidade deve ser maior que zero.");
const text = (label: string, max = 200) => z.string({ required_error: `${label} é obrigatório.` }).trim().min(1, `${label} é obrigatório.`).max(max);
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(25) };
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).");

export const loginSchema = z.object({ email: z.string().email("E-mail inválido."), password: z.string().min(1, "Informe a senha.") });
export const forgotSchema = z.object({ email: z.string().email("E-mail inválido.") });
export const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(10) });
export const changePasswordSchema = z.object({ current: z.string().min(1), next: z.string().min(10) });

export const productCreateSchema = z.object({ code: text("Código", 60), description: text("Descrição"), model: text("Modelo", 60), clientId: z.string().min(1, "Cliente é obrigatório."), classification: cls, minStock: z.coerce.number().int().min(0).default(1), active: z.boolean().optional() });
export const productUpdateSchema = productCreateSchema.omit({ code: true, classification: true }).partial();
export const stockQuerySchema = z.object({ q: z.string().optional(), classification: cls.optional(), clientId: z.string().optional(), status: z.enum(["ZERADO", "ABAIXO_MINIMO", "OK"]).optional(), sort: z.string().optional(), dir: z.enum(["asc", "desc"]).optional(), includeInactive: z.coerce.boolean().optional(), ...page });
export const lookupQuerySchema = z.object({ code: text("Código", 60), classification: cls.optional() });

export const movementCreateSchema = z.object({
  code: text("Código", 60), classification: cls, type: z.enum(["ENTRADA", "SAIDA"]), quantity: qty, note: z.string().trim().max(500).optional(),
});
export const movementQuerySchema = z.object({ from: ymd.optional(), to: ymd.optional(), code: z.string().optional(), product: z.string().optional(), client: z.string().optional(), userId: z.string().optional(), type: z.enum(["ENTRADA", "SAIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]).optional(), classification: cls.optional(), ...page });
export const correctionSchema = z.object({ quantity: qty.optional(), type: z.enum(["ENTRADA", "SAIDA"]).optional(), note: z.string().trim().max(500).nullable().optional(), void: z.boolean().optional(), justification: text("Justificativa", 500).min(5, "A justificativa precisa ter ao menos 5 caracteres.") });

const shift = z.enum(["MANHA", "NOITE"], { errorMap: () => ({ message: "Turno inválido." }) });
export const inventoryStartSchema = z.object({ referenceDate: ymd, shift, responsibleId: z.string().min(1, "Responsável é obrigatório.") });
export const shiftStartSchema = z.object({ shift });
export const countSchema = z.object({ productId: z.string().min(1), shift, physicalQty: z.coerce.number({ invalid_type_error: "Informe a quantidade física." }).int("Use número inteiro.").min(0, "A quantidade não pode ser negativa.") });
export const countItemsQuerySchema = z.object({ shift });
export const justificationSchema = z.object({ discrepancyId: z.string().min(1), reason: z.enum(["SAIDA_NAO_REGISTRADA", "ENTRADA_NAO_REGISTRADA", "ERRO_LANCAMENTO", "DIVERGENCIA_FISICA", "PECA_DANIFICADA", "PECA_LOCALIZADA", "OUTROS"], { errorMap: () => ({ message: "Selecione o motivo." }) }), text: z.string().trim().min(5, "A justificativa não pode ser vazia (mínimo 5 caracteres).").max(1000) });
export const approvalSchema = z.object({ discrepancyId: z.string().optional(), decision: z.enum(["APROVADO", "REJEITADO"]), comment: z.string().trim().max(500).optional(), adjust: z.boolean().optional(), adjustJustification: z.string().trim().max(500).optional() });

export const reportQuerySchema = z.object({ kind: z.enum(["RESUMO_NISSAN", "RESUMO_GERAL"]).default("RESUMO_NISSAN"), date: ymd });
export const reportExportSchema = z.object({ kind: z.enum(["RESUMO_NISSAN", "RESUMO_GERAL"]), date: ymd, format: z.enum(["XLSX", "PDF"]) });

export const userCreateSchema = z.object({ name: text("Nome", 120), email: z.string().email("E-mail inválido."), password: z.string().min(10, "Mínimo de 10 caracteres."), roleId: z.string().min(1) });
export const userUpdateSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), roleId: z.string().optional(), active: z.boolean().optional(), password: z.string().min(10).optional() });
export const rolePermissionsSchema = z.object({ permissions: z.array(z.string()) });
export const importConfirmSchema = z.object({ batchId: z.string().min(1) });
