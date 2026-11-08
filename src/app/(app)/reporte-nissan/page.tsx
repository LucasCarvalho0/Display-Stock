"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, ErrorBox, Input, PageHeader, Select, Spinner, useToast } from "@/components/ui";
import { api, fmtN, today, useFetch } from "@/lib/api";

export default function ReporteNissanPage() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState<"RESUMO_NISSAN" | "RESUMO_GERAL">("RESUMO_NISSAN");
  const [busy, setBusy] = useState<string>("");

  const { data, error, loading } = useFetch<any>(`/api/reports/nissan?kind=${kind}&date=${date}`);
  const { data: me } = useFetch<any>("/api/auth/me");

  const download = async (format: "XLSX" | "PDF") => {
    setBusy(format);
    try {
      const res: Response = await api("/api/reports/export", {
        method: "POST",
        json: { kind, date, format },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}_${date}.${format === "XLSX" ? "xlsx" : "pdf"}`;
      link.click();
      URL.revokeObjectURL(url);

      if (res.headers.get("X-Inventory-Status") !== "FECHADO") {
        toast(
          "Atenção: O inventário desta data ainda não foi fechado. O relatório foi emitido com ressalva.",
          "err"
        );
      } else {
        toast("Relatório exportado com sucesso!");
      }
    } catch (e: any) {
      toast(e.message || "Falha ao exportar relatório.", "err");
    } finally {
      setBusy("");
    }
  };

  const inv = data?.inventory;

  return (
    <div className="space-y-5">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <span>Relatórios Oficiais Nissan</span>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-500">Operação VPC &amp; Cockpit</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Reporte Nissan — Estoque VPC
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            loading={busy === "XLSX"}
            onClick={() => download("XLSX")}
            className="text-xs font-semibold bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Exportar Excel (XLSX)</span>
          </Button>

          <Button
            variant="secondary"
            loading={busy === "PDF"}
            onClick={() => download("PDF")}
            className="text-xs font-semibold"
          >
            <FileText className="h-4 w-4 text-red-600" />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE FILTROS */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data de Referência
              </label>
              <Input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                className="w-44 text-xs font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Modelo do Relatório
              </label>
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="text-xs font-medium"
              >
                <option value="RESUMO_NISSAN">Resumo Nissan (Peças NG primeiro)</option>
                <option value="RESUMO_GERAL">Resumo Geral (Normal e NG intercalados)</option>
              </Select>
            </div>
          </div>

          {/* Status do Inventário para esta Data */}
          {inv && (
            <div
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2 border ${
                inv.status === "FECHADO"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : inv.status === "PENDENTE"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {inv.status === "FECHADO" ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Inventário FECHADO ({inv.code})</span>
                </>
              ) : inv.status === "PENDENTE" ? (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Inventário PENDENTE ({inv.code})</span>
                </>
              ) : (
                <span>Sem inventário registrado para esta data</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {error && <ErrorBox message={error} />}

      {/* PRÉVIA IDÊNTICA À PLANILHA ORIGINAL / IMAGEM ENVIADA */}
      {loading ? (
        <Spinner />
      ) : (
        data && (
          <div className="rounded-xl border border-slate-300 bg-white shadow-md overflow-hidden">
            {/* BANNER SUPERIOR CIANO (#00B0F0) - IDÊNTICO À IMAGEM */}
            <div className="bg-[#00B0F0] px-4 py-3 flex items-center justify-between border-b border-[#0090C5]">
              {/* Logo Sesé */}
              <div className="bg-white rounded-md px-3 py-1.5 shadow-xs flex items-center justify-center">
                <img
                  src="/logo.jpg"
                  alt="Logo Sesé"
                  className="h-8 w-auto object-contain rounded"
                />
              </div>

              {/* Título Central */}
              <h2 className="text-xl md:text-2xl font-black text-black tracking-tight text-center font-sans">
                Estoque VPC
              </h2>

              {/* Logo Nissan */}
              <div className="bg-white rounded-md px-3 py-1.5 shadow-xs flex items-center justify-center">
                <img
                  src="/logo_1.jpeg"
                  alt="Logo Nissan"
                  className="h-7 w-auto object-contain"
                />
              </div>
            </div>

            {/* TABELA COM CABEÇALHO VERDE (#92D050) E BORDAS CIANO */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-[#92D050] text-black font-bold uppercase tracking-wider text-[11px] border-b border-black/20 h-9">
                    <th className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <span>Código</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <span>Produto</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <span>Modelo</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <span>Cliente</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-2 px-3 border border-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <span>Saldo Atual</span>
                        <Filter className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any) => {
                    const isZero = row.balance <= 0;
                    return (
                      <tr key={row.code} className="h-7 hover:brightness-95 transition-all">
                        {/* Código */}
                        <td className="py-1 px-3 border border-[#00B0F0] bg-[#F2F2F2] font-mono text-black font-medium">
                          {row.code}
                        </td>

                        {/* Produto */}
                        <td className="py-1 px-3 border border-[#00B0F0] bg-[#F2F2F2] text-black font-medium">
                          {row.description}
                        </td>

                        {/* Modelo */}
                        <td className="py-1 px-3 border border-[#00B0F0] bg-[#F2F2F2] text-black">
                          {row.model}
                        </td>

                        {/* Cliente */}
                        <td className="py-1 px-3 border border-[#00B0F0] bg-[#F2F2F2] text-black font-semibold">
                          {row.client}
                        </td>

                        {/* Saldo Atual (Verde se >0, Rosa com '-' se <=0) */}
                        <td
                          className={`py-1 px-3 border border-[#00B0F0] font-mono font-bold text-sm ${
                            isZero
                              ? "bg-[#FFC7CE] text-[#9C0006]"
                              : "bg-[#C6EFCE] text-[#006100]"
                          }`}
                        >
                          {isZero ? "-" : fmtN(row.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* RODAPÉ DO REPORTE */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-4">
                <span>
                  Total Peças Normais: <b>{fmtN(data.totals.normal)} un</b>
                </span>
                <span>·</span>
                <span>
                  Total Peças NG: <b>{fmtN(data.totals.ng)} un</b>
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Data do Corte de Dados: 28/10/2026 · Saldo Sistêmico Fechado
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
