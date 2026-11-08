import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { reportExportSchema } from "@/server/validators";
import { buildReport, exportPdf, exportXlsx, logExport } from "@/server/services/report.service";
export const POST = route({ perm: "reports.export", body: reportExportSchema }, async ({ user, body, ip }) => {
  const r = await buildReport(body.kind, body.date);
  const buf = body.format === "XLSX" ? await exportXlsx(r) : await exportPdf(r);
  await logExport(r, body.format, user.id, ip);
  const name = `${r.title.replace(/\s+/g, "_")}_${body.date}.${body.format === "XLSX" ? "xlsx" : "pdf"}`;
  return new NextResponse(new Uint8Array(buf), { headers: {
    "Content-Type": body.format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
    "Content-Disposition": `attachment; filename="${name}"`, "X-Inventory-Status": r.inventory.status } });
});
