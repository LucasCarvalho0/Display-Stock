import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { dateOnly, endOfDay, formatDate, formatDateTime } from "@/lib/time";
import { balancesAsOf, getCutoff } from "./stock.service";
import { audit } from "./audit.service";

export type ReportKind = "RESUMO_NISSAN" | "RESUMO_GERAL";
const TITLES: Record<ReportKind, string> = {
  RESUMO_NISSAN: "Resumo Nissan",
  RESUMO_GERAL: "Resumo Geral",
};
export const COLUMNS = ["Código", "Produto", "Modelo", "Cliente", "Saldo Atual"] as const;

export async function buildReport(kind: ReportKind, date: string) {
  const asOf = endOfDay(date);
  const cutoff = await getCutoff();
  if (asOf < cutoff) {
    throw badRequest(
      `Não há saldo confiável antes da data de corte (${formatDateTime(cutoff)}). Escolha uma data a partir de ${formatDate(cutoff)}.`
    );
  }
  const orderField = kind === "RESUMO_NISSAN" ? "sortNissan" : "sortGeral";
  const products = await prisma.product.findMany({
    where: { [orderField]: { not: null } },
    include: { client: true },
    orderBy: { [orderField]: "asc" },
  });
  const balances = await balancesAsOf(asOf);
  const rows = products.map((p) => ({
    code: p.code,
    description: p.description,
    model: p.model,
    client: p.client.name,
    balance: balances.get(p.id) ?? 0,
    classification: p.classification,
  }));

  const sessions = await prisma.inventorySession.findMany({
    where: { referenceDate: dateOnly(date) },
    orderBy: { startedAt: "desc" },
  });
  const closed = sessions.find((s) => s.status === "FECHADO");
  const inventory = closed
    ? { status: "FECHADO" as const, code: closed.code }
    : sessions[0]
    ? { status: "PENDENTE" as const, code: sessions[0].code }
    : { status: "SEM_INVENTARIO" as const, code: null };

  return {
    kind,
    title: TITLES[kind],
    sheetTitle: "Estoque VPC",
    date,
    columns: COLUMNS,
    rows,
    inventory,
    totals: {
      normal: rows
        .filter((r) => r.classification === "NORMAL")
        .reduce((s, r) => s + r.balance, 0),
      ng: rows
        .filter((r) => r.classification === "NG")
        .reduce((s, r) => s + r.balance, 0),
    },
  };
}

export async function exportXlsx(r: Awaited<ReturnType<typeof buildReport>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(r.title, {
    views: [{ showGridLines: true }],
  });

  // 1. LARGURA DAS COLUNAS (Idêntico ao Excel original)
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 36;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 18;

  // 2. LINHA 1: BANNER SUPERIOR "Estoque VPC" (Ciano #00B0F0)
  ws.mergeCells("A1:E1");
  const row1 = ws.getRow(1);
  row1.height = 58;

  const a1 = ws.getCell("A1");
  a1.value = "Estoque VPC";
  a1.font = { name: "Arial", size: 20, bold: true, color: { argb: "FF000000" } };
  a1.alignment = { horizontal: "center", vertical: "middle" };

  const cyanFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00B0F0" },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  for (let c = 1; c <= 5; c++) {
    const cell = row1.getCell(c);
    cell.fill = cyanFill;
    cell.border = thinBorder;
  }

  // Inserção dos Logos originais (Sesé à esquerda, Nissan à direita)
  const logo0Path = path.join(process.cwd(), "public/logo_0.jpeg");
  const logo1Path = path.join(process.cwd(), "public/logo_1.jpeg");

  if (fs.existsSync(logo0Path)) {
    const img0 = wb.addImage({
      buffer: fs.readFileSync(logo0Path) as unknown as ExcelJS.Buffer,
      extension: "jpeg",
    });
    ws.addImage(img0, {
      tl: { col: 0.1, row: 0.12 } as any,
      br: { col: 0.95, row: 0.88 } as any,
      editAs: "oneCell",
    });
  }

  if (fs.existsSync(logo1Path)) {
    const img1 = wb.addImage({
      buffer: fs.readFileSync(logo1Path) as unknown as ExcelJS.Buffer,
      extension: "jpeg",
    });
    ws.addImage(img1, {
      tl: { col: 4.15, row: 0.12 } as any,
      br: { col: 4.9, row: 0.88 } as any,
      editAs: "oneCell",
    });
  }

  // 3. LINHA 2: CABEÇALHO DAS COLUNAS (Verde #92D050)
  const row2 = ws.getRow(2);
  row2.height = 22;
  const greenHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF92D050" },
  };

  r.columns.forEach((colName, idx) => {
    const cell = row2.getCell(idx + 1);
    cell.value = colName;
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = greenHeaderFill;
    cell.border = thinBorder;
  });

  // Ativar filtro automático de colunas
  const endRowIdx = 2 + r.rows.length;
  ws.autoFilter = `A2:E${endRowIdx}`;

  // 4. LINHAS DE DADOS (Linhas 3 em diante)
  const cyanBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF00B0F0" } },
    bottom: { style: "thin", color: { argb: "FF00B0F0" } },
    left: { style: "thin", color: { argb: "FF00B0F0" } },
    right: { style: "thin", color: { argb: "FF00B0F0" } },
  };

  const grayFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };

  const greenBalanceFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6EFCE" },
  };

  const pinkZeroBalanceFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC7CE" },
  };

  r.rows.forEach((row, i) => {
    const rowIdx = 3 + i;
    const rLine = ws.getRow(rowIdx);
    rLine.height = 18;

    // Col A: Código
    const c1 = rLine.getCell(1);
    c1.value = row.code;
    c1.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
    c1.alignment = { horizontal: "center", vertical: "middle" };
    c1.fill = grayFill;
    c1.border = cyanBorder;

    // Col B: Produto
    const c2 = rLine.getCell(2);
    c2.value = row.description;
    c2.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
    c2.alignment = { horizontal: "center", vertical: "middle" };
    c2.fill = grayFill;
    c2.border = cyanBorder;

    // Col C: Modelo
    const c3 = rLine.getCell(3);
    c3.value = row.model;
    c3.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
    c3.alignment = { horizontal: "center", vertical: "middle" };
    c3.fill = grayFill;
    c3.border = cyanBorder;

    // Col D: Cliente
    const c4 = rLine.getCell(4);
    c4.value = row.client;
    c4.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
    c4.alignment = { horizontal: "center", vertical: "middle" };
    c4.fill = grayFill;
    c4.border = cyanBorder;

    // Col E: Saldo Atual
    const c5 = rLine.getCell(5);
    c5.value = row.balance;
    c5.numFmt = `#,##0;(#,##0);"-"`;
    c5.alignment = { horizontal: "center", vertical: "middle" };
    c5.border = cyanBorder;

    if (row.balance <= 0) {
      c5.fill = pinkZeroBalanceFill;
      c5.font = { name: "Arial", size: 10, color: { argb: "FF9C0006" } };
    } else {
      c5.fill = greenBalanceFill;
      c5.font = { name: "Arial", size: 10, color: { argb: "FF006100" } };
    }
  });

  // Adicionar regras de formatação condicional dinâmicas
  ws.addConditionalFormatting({
    ref: `E3:E${endRowIdx}`,
    rules: [
      {
        type: "cellIs",
        operator: "lessThanOrEqual" as any,
        priority: 1,
        formulae: ["0"],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" } },
        },
      },
      {
        type: "cellIs",
        operator: "greaterThan",
        priority: 2,
        formulae: ["0"],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6EFCE" } },
          font: { color: { argb: "FF006100" } },
        },
      },
    ],
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportPdf(r: Awaited<ReturnType<typeof buildReport>>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 30;
  const cols = [115, 205, 55, 80, 80];

  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (
    t: string,
    x: number,
    yy: number,
    f = font,
    size = 9,
    color = rgb(0.1, 0.1, 0.1)
  ) => page.drawText(t, { x, y: yy, size, font: f, color });

  // Banner Superior Estoque VPC
  page.drawRectangle({
    x: M,
    y: y - 36,
    width: W - 2 * M,
    height: 40,
    color: rgb(0, 0.69, 0.94), // #00B0F0
  });

  text("sesé", M + 15, y - 22, bold, 16, rgb(0, 0, 0));
  text("Estoque VPC", W / 2 - 45, y - 22, bold, 18, rgb(0, 0, 0));
  text("NISSAN", W - M - 65, y - 22, bold, 14, rgb(0, 0, 0));
  y -= 46;

  // Cabeçalho verde da tabela
  const drawTableHeader = () => {
    page.drawRectangle({
      x: M,
      y: y - 14,
      width: W - 2 * M,
      height: 20,
      color: rgb(0.57, 0.81, 0.31), // #92D050
    });
    let x = M + 8;
    r.columns.forEach((colName, idx) => {
      text(colName, x, y - 9, bold, 9, rgb(0, 0, 0));
      x += cols[idx];
    });
    y -= 22;
  };

  drawTableHeader();

  // Linhas de Dados
  for (const item of r.rows) {
    if (y < M + 25) {
      page = pdf.addPage([W, H]);
      y = H - M;
      drawTableHeader();
    }

    // Fundo cinza suave nas 4 primeiras colunas
    page.drawRectangle({
      x: M,
      y: y - 10,
      width: W - 2 * M - cols[4],
      height: 16,
      color: rgb(0.95, 0.95, 0.95), // #F2F2F2
    });

    // Fundo da coluna de saldo (verde se >0, rosa se <=0)
    const isZero = item.balance <= 0;
    page.drawRectangle({
      x: W - M - cols[4],
      y: y - 10,
      width: cols[4],
      height: 16,
      color: isZero ? rgb(1, 0.78, 0.8) : rgb(0.77, 0.93, 0.8),
    });

    let x = M + 6;
    text(item.code, x, y - 6, font, 8.5, rgb(0, 0, 0));
    x += cols[0];
    text(item.description.slice(0, 40), x, y - 6, font, 8.5, rgb(0, 0, 0));
    x += cols[1];
    text(item.model, x, y - 6, font, 8.5, rgb(0, 0, 0));
    x += cols[2];
    text(item.client, x, y - 6, font, 8.5, rgb(0, 0, 0));
    x += cols[3];

    const balanceStr = isZero ? "-" : item.balance.toLocaleString("pt-BR");
    const balColor = isZero ? rgb(0.61, 0, 0.02) : rgb(0, 0.38, 0);
    text(balanceStr, x + 25, y - 6, bold, 9, balColor);

    // Linha divisória ciano
    page.drawLine({
      start: { x: M, y: y - 11 },
      end: { x: W - M, y: y - 11 },
      thickness: 0.5,
      color: rgb(0, 0.69, 0.94),
    });

    y -= 17;
  }

  return Buffer.from(await pdf.save());
}

export async function logExport(
  r: Awaited<ReturnType<typeof buildReport>>,
  format: "XLSX" | "PDF",
  userId: string,
  ip?: string
) {
  await prisma.$transaction(async (tx) => {
    await tx.reportExport.create({
      data: {
        report: r.kind,
        format,
        referenceDate: dateOnly(r.date),
        inventoryClosed: r.inventory.status === "FECHADO",
        userId,
      },
    });
    await audit(tx, {
      userId,
      action: "RELATORIO_EXPORTADO",
      entity: "ReportExport",
      ip,
      after: {
        kind: r.kind,
        format,
        date: r.date,
        inventario: r.inventory.status,
      },
    });
  });
}
