import { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { importConfirmSchema } from "@/server/validators";
import { confirmImport, previewImport } from "@/server/services/import.service";
// multipart (arquivo) → PRÉVIA ; JSON {batchId} → CONFIRMA. Estoque nunca é alterado silenciosamente.
export const POST = route({ perm: "products.edit", rate: { limit: 20, windowMs: 60_000 } }, async ({ req, user, ip }) => {
  if (req.headers.get("content-type")?.includes("application/json")) { const { batchId } = importConfirmSchema.parse(await (req as NextRequest).json()); return confirmImport(batchId, user.id, ip); }
  const form = await req.formData(); const file = form.get("file"); const kind = form.get("kind");
  if (!(file instanceof File)) throw badRequest("Envie um arquivo .xlsx.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw badRequest("Formato não suportado. Envie um arquivo .xlsx (salve a planilha .xlsm como .xlsx).");
  if (file.size > 5_000_000) throw badRequest("Arquivo maior que 5 MB.");
  if (kind !== "PRODUTOS" && kind !== "MOVIMENTACOES") throw badRequest("Tipo de importação inválido.");
  return previewImport(kind, file.name, await file.arrayBuffer(), user.id);
});
