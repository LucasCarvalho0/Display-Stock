"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  Package,
  PackageCheck,
  PackageX,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge, Card, ErrorBox, Spinner, Tone } from "@/components/ui";
import { fmtD, fmtDT, fmtN, useFetch } from "@/lib/api";

const PIE_COLORS = ["#0066CC", "#0B192C", "#10B981", "#F59E0B", "#DC2626", "#8B5CF6", "#0D9488", "#64748B"];
const SIT_LABEL: Record<string, [string, Tone]> = {
  CORRETO: ["Correto", "green"],
  ANALISE: ["Aguardando análise", "yellow"],
  TRATADO: ["Concluído", "blue"],
  PENDENTE: ["Pendente", "gray"],
};

export default function Dashboard() {
  const { data, error, loading } = useFetch<any>("/api/dashboard");

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? "Falha ao carregar indicadores."} />;

  const c = data.cards;
  const inv = data.inventory;

  const normalPercent = c.totalPieces > 0 ? ((c.normalPieces / c.totalPieces) * 100).toFixed(1) : "0";
  const ngPercent = c.totalPieces > 0 ? ((c.ngPieces / c.totalPieces) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* BANNER CRÍTICO SE HOUVER DIVERGÊNCIA EM INVENTÁRIO */}
      {inv?.exists && inv.discrepancies > 0 && inv.status !== "FECHADO" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 animate-pulse">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                  Ação Necessária
                </span>
                <span className="font-semibold text-red-950 text-sm md:text-base">
                  Inventário {inv.code} com {inv.discrepancies} Divergência(s) em Aberto
                </span>
              </div>
              <p className="text-xs text-red-800 mt-0.5">
                Existem apontamentos divergentes aguardando justificativa técnica e aprovação de
                liderança antes do fechamento.
              </p>
            </div>
          </div>
          <Link
            href={`/inventario/${inv.id}`}
            className="self-end md:self-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <span>Tratar Pendências</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* CABEÇALHO DO COCKPIT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <span>Cockpit Logístico Automotivo</span>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-500">Planta Resende · Setor Cockpit 04</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Monitor Operacional de Displays &amp; Telas
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Link
            href="/reporte-nissan"
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-brand" />
            <span>Reporte Nissan</span>
          </Link>
          <Link
            href="/inventario"
            className="px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <PackageCheck className="h-4 w-4" />
            <span>Módulo de Inventário</span>
          </Link>
        </div>
      </div>

      {/* GRID DE KPIS SUPERIORES (8 CARDS DE ALTA DENSIDADE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Peças Disponíveis */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Total Disponível
              </span>
              <span className="text-2xl font-bold font-mono text-navy-900 tracking-tight mt-1 block">
                {fmtN(c.totalPieces)} <span className="text-xs font-sans font-normal text-slate-400">un</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-brand flex items-center justify-center">
              <Warehouse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Saldo Ativo Auditado</span>
            <span className="font-mono text-emerald-600 font-semibold">100% Sistêmico</span>
          </div>
        </div>

        {/* Card 2: Produtos Cadastrados */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Produtos Cadastrados
              </span>
              <span className="text-2xl font-bold font-mono text-navy-900 tracking-tight mt-1 block">
                {fmtN(c.totalProducts)} <span className="text-xs font-sans font-normal text-slate-400">part numbers</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Família Nissan Display</span>
            <span className="font-mono font-medium text-slate-700">Ativos</span>
          </div>
        </div>

        {/* Card 3: Entradas do Dia */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Entradas do Dia
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-600 tracking-tight mt-1 block flex items-center gap-1">
                <ArrowDownToLine className="h-5 w-5 inline text-emerald-500" />
                +{fmtN(c.entriesToday)} <span className="text-xs font-sans font-normal text-slate-400">un</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Recebimento / Doca</span>
            <span className="font-mono text-brand font-medium">Bipagem Ativa</span>
          </div>
        </div>

        {/* Card 4: Saídas do Dia */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Saídas do Dia
              </span>
              <span className="text-2xl font-bold font-mono text-slate-800 tracking-tight mt-1 block flex items-center gap-1">
                <ArrowUpFromLine className="h-5 w-5 inline text-slate-400" />
                -{fmtN(c.exitsToday)} <span className="text-xs font-sans font-normal text-slate-400">un</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Abastecimento de Linha</span>
            <span className="font-mono text-slate-700">Consumo Cockpit</span>
          </div>
        </div>

        {/* Card 5: Peças Normais */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Conformidade Normal (OK)
              </span>
              <span className="text-2xl font-bold font-mono text-navy-900 tracking-tight mt-1 block">
                {fmtN(c.normalPieces)} <span className="text-xs font-sans font-normal text-slate-400">un</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${normalPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Taxa de Conformidade</span>
              <span className="font-semibold text-emerald-700">{normalPercent}%</span>
            </div>
          </div>
        </div>

        {/* Card 6: Peças NG */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-red-600 font-semibold block">
                Peças NG (Quarentena)
              </span>
              <span className="text-2xl font-bold font-mono text-red-600 tracking-tight mt-1 block">
                {fmtN(c.ngPieces)} <span className="text-xs font-sans font-normal text-slate-400">un</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Segregação Física</span>
            <span className="font-mono text-red-600 font-semibold">{ngPercent}% do estoque</span>
          </div>
        </div>

        {/* Card 7: Abaixo do Mínimo */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Abaixo do Mínimo
              </span>
              <span className="text-2xl font-bold font-mono text-amber-600 tracking-tight mt-1 block">
                {fmtN(c.belowMin)} <span className="text-xs font-sans font-normal text-slate-400">itens</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Status Reposição</span>
            <span className="font-mono text-amber-700 font-semibold">
              {c.belowMin > 0 ? "Atenção PCP" : "OK"}
            </span>
          </div>
        </div>

        {/* Card 8: Ruptura / Sem Estoque */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                Sem Estoque (Ruptura)
              </span>
              <span className="text-2xl font-bold font-mono text-navy-900 tracking-tight mt-1 block">
                {fmtN(c.outOfStock)} <span className="text-xs font-sans font-normal text-slate-400">itens</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              {c.outOfStock === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <PackageX className="h-5 w-5 text-red-600" />
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Disponibilidade da Linha</span>
            <span className="font-mono text-emerald-600 font-semibold">
              {c.outOfStock === 0 ? "100% Abastecida" : "Ruptura Parcial"}
            </span>
          </div>
        </div>
      </div>

      {/* PAINEL CENTRAL DE INVENTÁRIO DO DIA (DESTAQUE PRIORIDADE MÁXIMA) */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy-900">
                  Inventário Cíclico Operacional
                </h2>
                {inv.exists && (
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-brand border border-blue-200">
                    {inv.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {inv.exists
                  ? `Data de referência: ${fmtD(inv.referenceDate)} · Somente peças normais nesta fase.`
                  : "Nenhum inventário registrado para a data de hoje."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inv.exists ? (
              <Link
                href={`/inventario/${inv.id}`}
                className="px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>Acessar Painel do Inventário</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/inventario"
                className="px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>Iniciar Inventário do Dia</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {inv.exists ? (
          <div className="p-4 md:p-5 space-y-4">
            {/* Badges de Status dos Turnos */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Turno Manhã
                </span>
                <span className="font-semibold text-navy-900">
                  {inv.morning.status === "CONCLUIDO" ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                    </span>
                  ) : inv.morning.status === "EM_ANDAMENTO" ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Em andamento
                    </span>
                  ) : (
                    "Não iniciado"
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Turno Noite
                </span>
                <span className="font-semibold text-navy-900">
                  {inv.night.status === "CONCLUIDO" ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                    </span>
                  ) : inv.night.status === "EM_ANDAMENTO" ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Em andamento
                    </span>
                  ) : (
                    "Não iniciado"
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Conferidos
                </span>
                <span className="font-mono font-bold text-navy-900 text-sm">
                  {inv.conferred} peças
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Divergências
                </span>
                <span
                  className={`font-mono font-bold text-sm ${
                    inv.discrepancies > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {inv.discrepancies}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Justificativas
                </span>
                <span className="font-mono font-bold text-navy-900 text-sm">
                  {inv.pendingJustifications} pendente(s)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                  Status Fechamento
                </span>
                <span className="font-semibold text-xs">
                  {inv.status === "FECHADO" ? (
                    <Badge tone="green">Fechado</Badge>
                  ) : (
                    <Badge tone="yellow">{inv.status}</Badge>
                  )}
                </span>
              </div>
            </div>

            {/* Tabela de Conferência Operacional */}
            {inv.table && inv.table.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-navy-900 text-white uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Código / Part Number</th>
                      <th className="py-2.5 px-3">Descrição da Peça</th>
                      <th className="py-2.5 px-3 text-right">Qtd Sistêmica</th>
                      <th className="py-2.5 px-3 text-right">Qtd Física</th>
                      <th className="py-2.5 px-3 text-right">Diferença</th>
                      <th className="py-2.5 px-3">Situação</th>
                      <th className="py-2.5 px-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inv.table.map((row: any) => {
                      const isDivergent = row.difference !== null && row.difference !== 0;
                      return (
                        <tr
                          key={row.code}
                          className="hover:bg-slate-50/80 transition-colors font-medium"
                        >
                          <td className="py-2.5 px-3 font-mono text-brand font-semibold">
                            {row.code}
                          </td>
                          <td className="py-2.5 px-3 text-navy-900">{row.description}</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {fmtN(row.system)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {row.physical !== null ? fmtN(row.physical) : "—"}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                              isDivergent ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {row.difference === null
                              ? "—"
                              : row.difference > 0
                              ? `+${row.difference}`
                              : row.difference}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge tone={SIT_LABEL[row.situation]?.[1] ?? "gray"}>
                              {SIT_LABEL[row.situation]?.[0] ?? row.situation}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Link
                              href={`/inventario/${inv.id}`}
                              className="text-brand hover:underline font-semibold"
                            >
                              Detalhar
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">
            <Warehouse className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p>Nenhuma sessão de inventário iniciada para hoje.</p>
            <p className="text-xs text-slate-400 mt-1">
              Conforme rotina operacional, inventários são realizados preferencialmente às
              segundas ou sextas-feiras.
            </p>
          </div>
        )}
      </div>

      {/* GRÁFICOS RECHARTS (4 GRÁFICOS OPERACIONAIS) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico 1: Entradas × Saídas */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Entradas × Saídas</h3>
              <p className="text-xs text-slate-500">Histórico consolidado dos últimos 12 meses</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">UNIDADES</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.entriesVsExits}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#0066CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Movimentações por Período */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Tendência Diária (30 dias)</h3>
              <p className="text-xs text-slate-500">Fluxo diário de entradas e saídas</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">VOLUMETRIA</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.byPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="entradas"
                  name="Entradas"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="saidas"
                  name="Saídas"
                  stroke="#0066CC"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Movimentações por Colaborador */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Apontamentos por Funcionário</h3>
              <p className="text-xs text-slate-500">Operações registradas nos últimos 30 dias</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">LANÇAMENTOS</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byEmployee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="movimentacoes"
                  name="Movimentações"
                  fill="#0B192C"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Estoque por Cliente */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Distribuição do Estoque</h3>
              <p className="text-xs text-slate-500">Proporção de peças em saldo por cliente</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">PARTILHA</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.stockByClient}
                  dataKey="saldo"
                  nameKey="name"
                  outerRadius={85}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.charts.stockByClient.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* HISTÓRICO RECENTE DE MOVIMENTAÇÕES */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-900">
              Histórico Recente de Movimentações
            </h3>
            <p className="text-xs text-slate-500">
              Últimos lançamentos com numeração permanente e identificação de usuário
            </p>
          </div>
          <Link
            href="/movimentacoes"
            className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
          >
            <span>Ver todas</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Nº Operação</th>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3 text-right">Qtd</th>
                <th className="py-2.5 px-3">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentMovements.length > 0 ? (
                data.recentMovements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors font-medium">
                    <td className="py-2.5 px-3 font-mono font-bold text-brand">{m.number}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {fmtDT(m.occurredAt)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-navy-900">{m.code}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === "ENTRADA"
                            ? "bg-emerald-50 text-emerald-700"
                            : m.type === "SAIDA"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-navy-900">
                      {m.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{m.user}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhuma movimentação registrada recentemente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
