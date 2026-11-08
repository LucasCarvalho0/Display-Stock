import ExcelJS from "exceljs";
import { Classification } from "@prisma/client";
import { prisma, transaction } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { audit } from "./audit.service";
import { applyMovement } from "./stock.service";
import { fullCode } from "./product.service";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const HEADERS: Record<string, string[]> = {
  code: ["codigo", "codigo da peca", "code"], description: ["produto", "descricao", "description"], model: ["modelo", "model"],
  client: ["cliente", "client"], minStock: ["estoque minimo", "minimo", "min"], classification: ["classificacao", "tipo", "ng"],
  at: ["data e hora", "data", "data/hora"], type: ["tipo", "operacao"], quantity: ["quantidade", "qtd", "qtde"],
};
async function readRows(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.worksheets[0]; if (!ws) throw badRequest("Planilha vazia.");
  const header = (ws.getRow(1).values as unknown[]).slice(1).map(norm);
  const idx = (k: string) => header.findIndex((h) => HEADERS[k].includes(h));
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, n) => { if (n === 1) return; const v = row.values as unknown[]; const o: Record<string, unknown> = { _line: n };
    for (const k of Object.keys(HEADERS)) { const i = idx(k); if (i >= 0) { const c = v[i + 1]; o[k] = c && typeof c === "object" && "text" in (c as object) ? (c as { text: string }).text : c; } }
    if (Object.keys(o).length > 1) rows.push(o); });
  return { rows, found: Object.keys(HEADERS).filter((k) => idx(k) >= 0) };
}

type Row = { line: number; status: "NOVO" | "VALIDO" | "DUPLICADO_BANCO" | "DUPLICADO_ARQUIVO" | "INVALIDO"; errors: string[]; data: Record<string, unknown> };

/** Etapa 1–7: lê, valida, identifica duplicidades e devolve a PRÉVIA. Nada é gravado além do lote em estado PREVIA. */
export async function previewImport(kind: "PRODUTOS" | "MOVIMENTACOES", fileName: string, buf: ArrayBuffer, userId: string) {
  const { rows: raw, found } = await readRows(buf);
  const need = kind === "PRODUTOS" ? ["code", "description", "model", "client"] : ["code", "type", "quantity"];
  const missing = need.filter((k) => !found.includes(k));
  if (missing.length) throw badRequest(`Colunas obrigatórias não encontradas: ${missing.join(", ")}.`, { colunasEncontradas: found });
  const rows: Row[] = [];
  if (kind === "PRODUTOS") {
    const existing = new Set((await prisma.product.findMany({ select: { code: true } })).map((p) => p.code));
    const clients = new Set((await prisma.client.findMany({ select: { name: true } })).map((c) => c.name));
    const seen = new Set<string>();
    for (const r of raw) {
      const errors: string[] = [];
      const cls: Classification = norm(r.classification) === "ng" || String(r.code ?? "").trim().toUpperCase().endsWith(" NG") ? "NG" : "NORMAL";
      const code = fullCode(String(r.code ?? ""), cls);
      if (!String(r.code ?? "").trim()) errors.push("Código vazio");
      if (!String(r.description ?? "").trim()) errors.push("Descrição vazia");
      const client = String(r.client ?? "").trim().toUpperCase();
      if (!client) errors.push("Cliente vazio"); // clientes novos são criados na confirmação
      const min = r.minStock === undefined || r.minStock === null || r.minStock === "" ? 1 : Number(r.minStock);
      if (!Number.isInteger(min) || min < 0) errors.push("Estoque mínimo inválido");
      let status: Row["status"] = "NOVO";
      if (errors.length) status = "INVALIDO"; else if (seen.has(code)) status = "DUPLICADO_ARQUIVO"; else if (existing.has(code)) status = "DUPLICADO_BANCO";
      seen.add(code);
      rows.push({ line: r._line as number, status, errors, data: { code, description: String(r.description ?? "").trim(), model: String(r.model ?? "").trim(), client, classification: cls, minStock: min, newClient: client && !clients.has(client) } });
    }
  } else {
    const products = new Map((await prisma.product.findMany({ include: { balance: true } })).map((p) => [p.code, p]));
    const running = new Map<string, number>();
    for (const r of raw) {
      const errors: string[] = []; const code = String(r.code ?? "").trim(); const p = products.get(code);
      const t = norm(r.type); const type = t.startsWith("ent") ? "ENTRADA" : t.startsWith("sai") ? "SAIDA" : null;
      const qty = Number(r.quantity);
      if (!p) errors.push(`Código "${code}" não cadastrado`);
      if (!type) errors.push("Tipo deve ser Entrada ou Saída");
      if (!Number.isInteger(qty) || qty <= 0) errors.push("Quantidade inválida");
      if (p && type && qty > 0) { const cur = running.get(code) ?? p.balance?.quantity ?? 0; const nxt = cur + (type === "ENTRADA" ? qty : -qty);
        if (nxt < 0) errors.push(`Deixaria o saldo negativo (${nxt})`); else running.set(code, nxt); }
      rows.push({ line: r._line as number, status: errors.length ? "INVALIDO" : "VALIDO", errors, data: { code, type, quantity: qty, productId: p?.id } });
    }
  }
  const summary = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), { total: rows.length });
  const batch = await prisma.importBatch.create({ data: { kind, fileName, payload: rows as never, summary, userId } });
  return { batchId: batch.id, kind, summary, rows };
}

/** Etapa 8–9: só após confirmação explícita. Movimentações importadas registram origem, responsável e horário. */
export async function confirmImport(batchId: string, userId: string, ip?: string) {
  return transaction(async (tx) => {
    const b = await tx.importBatch.findUnique({ where: { id: batchId } });
    if (!b) throw notFound("Lote de importação não encontrado.");
    if (b.status !== "PREVIA") throw conflict("LOTE_JA_PROCESSADO", "Este lote já foi confirmado ou cancelado.");
    const rows = b.payload as unknown as Row[];
    let done = 0;
    if (b.kind === "PRODUTOS") {
      for (const r of rows.filter((x) => x.status === "NOVO")) {
        const d = r.data as { code: string; description: string; model: string; client: string; classification: Classification; minStock: number };
        const client = await tx.client.upsert({ where: { name: d.client }, create: { name: d.client }, update: {} });
        await tx.product.create({ data: { code: d.code, baseCode: d.code.replace(/\s+NG$/, ""), description: d.description, model: d.model, clientId: client.id, classification: d.classification, minStock: d.minStock, balance: { create: { quantity: 0 } } } });
        done++;
      }
    } else {
      if (rows.some((r) => r.status === "INVALIDO")) throw conflict("LOTE_COM_ERROS", "Corrija as linhas inválidas e reenvie a planilha. Importações de movimentação são tudo-ou-nada.");
      for (const r of rows) { const d = r.data as { type: "ENTRADA" | "SAIDA"; quantity: number; productId: string };
        await applyMovement(tx, { productId: d.productId, type: d.type, quantity: d.quantity, userId, source: "IMPORTACAO_PLANILHA", importBatchId: b.id, note: `Importado de ${b.fileName}, linha ${r.line}`, ip }); done++; }
    }
    await tx.importBatch.update({ where: { id: b.id }, data: { status: "CONFIRMADA", confirmedAt: new Date() } });
    await audit(tx, { userId, action: "IMPORTACAO_CONFIRMADA", entity: "ImportBatch", entityId: b.id, ip, after: { kind: b.kind, registros: done, arquivo: b.fileName } });
    return { imported: done };
  });
}
