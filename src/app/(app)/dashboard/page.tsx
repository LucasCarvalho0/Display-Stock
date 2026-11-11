"use client";

import { useMemo, useState } from "react";
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
  FileSpreadsheet,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  PackageMinus,
  PackageX,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Warehouse,
  ClipboardCheck,
} from "lucide-react";
import { Badge, Button, Card, ErrorBox, Input, Spinner, Tone } from "@/components/ui";
import { fmtD, fmtDT, fmtN, useFetch } from "@/lib/api";

const PIE_COLORS = ["#1E3F90", "#10B981", "#F59E0B", "#DC2626", "#8B5CF6", "#0D9488", "#0B192C", "#64748B"];

const ST_MAP: Record<string, [string, Tone]> = {
  OK: ["Normal", "green"],
  ABAIXO_MINIMO: ["Abaixo do mínimo", "yellow"],
  ZERADO: ["Sem estoque", "red"],
};

export default function Dashboard() {
  const { data, error, loading } = useFetch<any>("/api/dashboard");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? "Falha ao carregar indicadores."} />;

  const c = data.cards;
  const inv = data.inventory;
  const items: any[] = data.cockpitItems ?? [];

  const normalPercent = c.totalPieces > 0 ? ((c.normalPieces / c.totalPieces) * 100).toFixed(1) : "0";
  const ngPercent = c.totalPieces > 0 ? ((c.ngPieces / c.totalPieces) * 100).toFixed(1) : "0";

  // Filtragem dos itens do sistema
  const filteredItems = items.filter((it) => {
    const matchClass =
      filterClass === "ALL" ||
      (filterClass === "NORMAL" && it.classification === "NORMAL") ||
      (filterClass === "NG" && it.classification === "NG") ||
      (filterClass === "CRITICAL" && it.status !== "OK");

    const matchSearch =
      searchTerm === "" ||
      it.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.model.toLowerCase().includes(searchTerm.toLowerCase());

    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* BANNER CRÍTICO SE HOUVER DIVERGÊNCIA EM INVENTÁRIO */}
      {inv?.exists && inv.discrepancies > 0 && inv.status !== "FECHADO" && (
        <div className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-red-700 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                  Atenção Imediata
                </span>
                <span className="font-bold text-white text-sm sm:text-base">
                  Inventário {inv.code} · {inv.discrepancies} Divergência(s) Detectada(s)
                </span>
              </div>
              <p className="text-xs text-red-100 mt-0.5">
                Existem divergências apontadas aguardando justificativa técnica antes da homologação final.
              </p>
            </div>
          </div>
          <Link
            href={`/inventario/${inv.id}`}
            className="self-stretch sm:self-auto px-4 py-2.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md active:scale-95 whitespace-nowrap min-h-[40px]"
          >
            <span>Tratar Pendências</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* HERO COCKPIT CARD (VISUAL PREMIUM AUTOMOTIVO SESÉ & NISSAN) */}
      <div className="rounded-3xl bg-gradient-to-br from-navy-950 via-[#1E3F90] to-blue-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden border border-blue-800/40">
        {/* Detalhes visuais de fundo */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-blue-400/20 text-sky-200 border border-blue-400/30 text-[11px] font-bold uppercase tracking-wider">
                Cockpit Nissan · Sesé Logística Resende
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                AO VIVO
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Painel de Displays &amp; Multimídia
            </h1>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              Controle serializado de saldo físico em pallets fechados no almoxarifado, bancadas de pré-montagem (L2, L3, PCD) e quarentena NG.
            </p>

            {/* Pílulas de Totais Oficiais */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-white/15 flex items-center gap-2.5">
                <Boxes className="h-5 w-5 text-sky-300" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-blue-200 block font-semibold">
                    Pallets Fechados
                  </span>
                  <span className="font-mono font-extrabold text-base text-white">
                    {fmtN(c.warehousePieces || 0)} <span className="text-xs text-blue-200 font-normal">pçs</span>
                  </span>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-white/15 flex items-center gap-2.5">
                <Layers className="h-5 w-5 text-amber-300" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-200 block font-semibold">
                    Pré-Montagem
                  </span>
                  <span className="font-mono font-extrabold text-base text-white">
                    {fmtN(c.preAssemblyPieces || 0)} <span className="text-xs text-amber-200 font-normal">pçs</span>
                  </span>
                </div>
              </div>

              <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl px-3.5 py-2 border border-emerald-400/30 flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-200 block font-semibold">
                    Saldo Total Consolidado
                  </span>
                  <span className="font-mono font-extrabold text-lg text-emerald-300">
                    {fmtN(c.totalPieces)} <span className="text-xs text-emerald-200 font-normal">pçs</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO RÁPIDA COLORIDOS */}
          <div className="flex flex-row lg:flex-col gap-2.5 shrink-0 self-stretch lg:self-auto justify-end">
            <Link
              href="/inventario"
              className="flex-1 lg:flex-none px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-95 transition min-h-[44px]"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Iniciar Inventário</span>
            </Link>

            <div className="flex gap-2 flex-1 lg:flex-none">
              <Link
                href="/entrada"
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 transition min-h-[44px]"
              >
                <PackagePlus className="h-4 w-4 text-emerald-300" />
                <span>+ Entrada</span>
              </Link>
              <Link
                href="/saida"
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 active:scale-95 transition min-h-[44px]"
              >
                <PackageMinus className="h-4 w-4 text-sky-300" />
                <span>- Saída</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CARDS DE INDICADORES OPERACIONAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Normal Operacional */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Peças Normais (Linha)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-navy-900">
                  {fmtN(c.normalPieces)}
                </span>
                <span className="text-xs text-slate-400 font-medium">un</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${normalPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Conformidade</span>
              <span className="font-bold text-emerald-700 font-mono">{normalPercent}% do saldo</span>
            </div>
          </div>
        </div>

        {/* Card 2: Peças NG Quarentena */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                Quarentena NG (Bloqueado)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-rose-600">
                  {fmtN(c.ngPieces)}
                </span>
                <span className="text-xs text-rose-400 font-medium">un</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Segregação Física</span>
            <span className="font-bold text-rose-600 font-mono">{ngPercent}% do estoque</span>
          </div>
        </div>

        {/* Card 3: Movimentações do Dia */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Movimentação Hoje
              </span>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1 font-mono font-bold text-emerald-600 text-lg">
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>+{fmtN(c.entriesToday)}</span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1 font-mono font-bold text-blue-700 text-lg">
                  <ArrowUpFromLine className="h-4 w-4" />
                  <span>-{fmtN(c.exitsToday)}</span>
                </div>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3F90] flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Doca × Linha Cockpit</span>
            <span className="font-semibold text-slate-700 font-mono">Turno Ativo</span>
          </div>
        </div>

        {/* Card 4: Saúde do Abastecimento */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Saúde de Reposição
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-navy-900">
                  {c.totalProducts - c.belowMin - c.outOfStock}/{c.totalProducts}
                </span>
                <span className="text-xs text-slate-400 font-medium">part numbers</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              {c.outOfStock === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <PackageX className="h-5 w-5 text-rose-600" />
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Status Geral:</span>
            {c.outOfStock === 0 && c.belowMin === 0 ? (
              <span className="font-bold text-emerald-600 font-mono">100% OK</span>
            ) : c.outOfStock > 0 ? (
              <span className="font-bold text-rose-600 font-mono">{c.outOfStock} item(ns) zerado(s)</span>
            ) : (
              <span className="font-bold text-amber-600 font-mono">{c.belowMin} abaixo do mín.</span>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL DOS ITENS DO SISTEMA (ESTOQUE DETALHADO POR COMPONENTE) */}
      <Card
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1E3F90] flex items-center justify-center font-bold">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">Itens e Componentes do Cockpit</h2>
              <p className="text-xs text-slate-500 font-normal">
                Saldos consolidados de pallets fechados, bancada de pré-montagem e status operacional
              </p>
            </div>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/estoque"
              className="px-3.5 py-1.5 rounded-xl bg-[#1E3F90] hover:bg-blue-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition min-h-[36px]"
            >
              <span>Ver no Módulo Estoque</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          {/* BARRA DE FILTROS E PESQUISA DOS ITENS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterClass("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterClass === "ALL"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-slate-600 hover:text-navy-900"
                }`}
              >
                Todos ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterClass("NORMAL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterClass === "NORMAL"
                    ? "bg-white text-[#1E3F90] shadow-sm"
                    : "text-slate-600 hover:text-navy-900"
                }`}
              >
                Normais Linha ({items.filter((i) => i.classification === "NORMAL").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterClass("NG")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterClass === "NG"
                    ? "bg-white text-rose-600 shadow-sm"
                    : "text-slate-600 hover:text-navy-900"
                }`}
              >
                Quarentena NG ({items.filter((i) => i.classification === "NG").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterClass("CRITICAL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  filterClass === "CRITICAL"
                    ? "bg-white text-amber-600 shadow-sm"
                    : "text-slate-600 hover:text-navy-900"
                }`}
              >
                Abaixo do Mín. ({items.filter((i) => i.status !== "OK").length})
              </button>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar componente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 min-h-[36px]"
              />
            </div>
          </div>

          {/* TABELA VISUAL DOS COMPONENTES */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead className="bg-[#1E3F90] text-white uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 font-bold">Produto / Descrição</th>
                  <th className="py-3 px-3.5 font-bold">Part Number</th>
                  <th className="py-3 px-3.5 font-bold text-center">Modelo</th>
                  <th className="py-3 px-3.5 font-bold text-right bg-blue-800">Pallets (Almoxarifado)</th>
                  <th className="py-3 px-3.5 font-bold text-right bg-amber-700">Pré-Montagem</th>
                  <th className="py-3 px-3.5 font-bold text-right bg-emerald-700">Saldo Total</th>
                  <th className="py-3 px-3.5 font-bold text-center">Tipo</th>
                  <th className="py-3 px-3.5 font-bold text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((it) => {
                  const isNg = it.classification === "NG";
                  return (
                    <tr
                      key={it.id}
                      className={`hover:bg-slate-50 transition-colors ${isNg ? "bg-rose-50/25" : ""}`}
                    >
                      <td className="py-3 px-3.5 font-bold text-navy-900 text-xs sm:text-sm">
                        {it.description}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-500 font-semibold">
                        {it.code}
                      </td>
                      <td className="py-3 px-3.5 text-center text-slate-600">
                        {it.model}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {fmtN(it.warehouseQty)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                        {fmtN(it.preAssemblyQty)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-sm text-emerald-800 bg-emerald-50/40">
                        {fmtN(it.totalQty)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <Badge tone={isNg ? "red" : "green"}>
                          {isNg ? "NG" : "Normal"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <Badge tone={ST_MAP[it.status]?.[1] ?? "gray"}>
                          {ST_MAP[it.status]?.[0] ?? it.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* SEÇÃO INFERIOR: GRÁFICOS E MOVIMENTAÇÕES RECENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GRÁFICO 1: ENTRADAS × SAÍDAS HISTÓRICAS (8 COLS) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Volumetria de Movimentações (12 Meses)</h3>
              <p className="text-xs text-slate-500">Comparativo histórico de entradas versus saídas</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">UNIDADES</span>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.entriesVsExits}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#1E3F90" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: PROPORÇÃO POR CLIENTE / MODELO (4 COLS) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-navy-900">Distribuição por Cliente</h3>
              <p className="text-xs text-slate-500">Saldo total particionado</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">FATIA</span>
          </div>
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.stockByClient}
                  dataKey="saldo"
                  nameKey="name"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.charts.stockByClient.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* HISTÓRICO RECENTE DE MOVIMENTAÇÕES AUDITÁVEIS */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-navy-900">
              Histórico Recente de Operações
            </h3>
            <p className="text-xs text-slate-500">
              Últimos lançamentos com numeração sequencial perpétua e auditoria de usuário
            </p>
          </div>
          <Link
            href="/movimentacoes"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition active:scale-95"
          >
            <span>Ver Todas</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Nº Operação</th>
                <th className="py-3 px-3.5">Data / Hora</th>
                <th className="py-3 px-3.5">Part Number</th>
                <th className="py-3 px-3.5">Operação</th>
                <th className="py-3 px-3.5 text-right">Qtd</th>
                <th className="py-3 px-3.5">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentMovements && data.recentMovements.length > 0 ? (
                data.recentMovements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors font-medium">
                    <td className="py-3 px-3.5 font-mono font-bold text-[#1E3F90]">{m.number}</td>
                    <td className="py-3 px-3.5 text-slate-600 font-mono">
                      {fmtDT(m.occurredAt)}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-navy-900 font-bold">{m.code}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === "ENTRADA"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : m.type === "SAIDA"
                            ? "bg-blue-50 text-[#1E3F90] border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-navy-900 text-sm">
                      {m.quantity}
                    </td>
                    <td className="py-3 px-3.5 text-slate-700">{m.user}</td>
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
