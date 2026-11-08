"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  History as HistoryIcon,
  Layers,
  Package,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Badge, Button, Card, ErrorBox, Input, Modal, Pager, Select, Spinner, Table } from "@/components/ui";
import { api, fmtDT, fmtN, qs, useFetch } from "@/lib/api";

const ST_MAP: Record<string, [string, "green" | "yellow" | "red"]> = {
  OK: ["Normal", "green"],
  ABAIXO_MINIMO: ["Abaixo do mínimo", "yellow"],
  ZERADO: ["Sem estoque", "red"],
};

export default function EstoquePage() {
  const [filters, setFilters] = useState({
    q: "",
    classification: "",
    clientId: "",
    status: "",
    sort: "sortOrder",
    dir: "asc",
    page: 1,
  });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data, error, loading } = useFetch<any>(`/api/stock?${qs({ ...filters, pageSize: 25 })}`);
  const { data: clients } = useFetch<any[]>("/api/clients");
  const { data: dash } = useFetch<any>("/api/dashboard");

  const setField = (key: string, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? value : 1 }));

  const sortBy = (key: string) =>
    setFilters((prev) => ({
      ...prev,
      sort: key,
      dir: prev.sort === key && prev.dir === "asc" ? "desc" : "asc",
      page: 1,
    }));

  const exportCsv = async () => {
    const all = await api<any>(`/api/stock?${qs({ ...filters, page: 1, pageSize: 500 })}`);
    const head = ["Código", "Produto", "Modelo", "Cliente", "Saldo", "Estoque Mínimo", "Classificação", "Situação"];
    const lines = all.rows.map((r: any) =>
      [
        r.code,
        r.description,
        r.model,
        r.client,
        r.balance,
        r.minStock,
        r.classification === "NG" ? "NG" : "Normal",
        ST_MAP[r.status]?.[0] ?? r.status,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(";")
    );
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `estoque_display_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const Th = ({ k, children }: { k: string; children: string }) => (
    <button
      onClick={() => sortBy(k)}
      className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold hover:text-white"
    >
      <span>{children}</span>
      {filters.sort === k &&
        (filters.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  const c = dash?.cards;

  return (
    <div className="space-y-5">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <span>Gestão Física &amp; Sistêmica</span>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-500">Posto Cockpit Nissan</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Controle de Estoque de Displays &amp; Multimídia
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={exportCsv} className="text-xs">
            <Download className="h-4 w-4" />
            <span>Exportar CSV</span>
          </Button>
          <Link
            href="/entrada"
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>+ Entrada</span>
          </Link>
          <Link
            href="/saida"
            className="px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>- Saída</span>
          </Link>
        </div>
      </div>

      {/* KPI SUMMARY ROW (VISUAL RICHNESS STITCH) */}
      {c && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-bold uppercase tracking-wider">Total em Saldo Físico</span>
              <Boxes className="h-4 w-4 text-brand" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-navy-900">{fmtN(c.totalPieces)}</span>
              <span className="text-xs text-slate-400">unidades</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{c.totalProducts} Part Numbers monitorados</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-bold uppercase tracking-wider">Estoque Normal Operacional</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-emerald-600">{fmtN(c.normalPieces)}</span>
              <span className="text-xs text-slate-400">aptos à montagem</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span>{c.totalPieces > 0 ? ((c.normalPieces / c.totalPieces) * 100).toFixed(1) : 0}% do inventário</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-red-600 text-xs mb-1">
              <span className="font-bold uppercase tracking-wider">Quarentena / Saldo NG</span>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-red-600">{fmtN(c.ngPieces)}</span>
              <span className="text-xs text-red-500">peças bloqueadas</span>
            </div>
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <span>Segregação física e laudo</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-bold uppercase tracking-wider">Status Reposição</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-navy-900">{c.belowMin}</span>
              <span className="text-xs text-slate-400">abaixo do mínimo</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span className={c.outOfStock > 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-medium"}>
                {c.outOfStock > 0 ? `${c.outOfStock} item(ns) em ruptura` : "Linha 100% abastecida"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ABAS RÁPIDAS DE FILTRO POR CLASSIFICAÇÃO */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setField("classification", "")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.classification === ""
                ? "bg-white text-navy-900 shadow-xs"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            Visão Geral Consolidada
          </button>
          <button
            type="button"
            onClick={() => setField("classification", "NORMAL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.classification === "NORMAL"
                ? "bg-white text-brand shadow-xs"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            Peças Normais (Linha)
          </button>
          <button
            type="button"
            onClick={() => setField("classification", "NG")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filters.classification === "NG"
                ? "bg-white text-red-600 shadow-xs"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            Peças NG (Quarentena)
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Terminal className="h-3.5 w-3.5 text-brand" />
          <span>COLETOR HONEYWELL READY</span>
        </div>
      </div>

      {/* TABELA DE ESTOQUE COM FILTROS AVANÇADOS */}
      <Card>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Pesquisar código, descrição, modelo ou cliente..."
              value={filters.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </div>

          <Select
            value={filters.clientId}
            onChange={(e) => setField("clientId", e.target.value)}
          >
            <option value="">Todos os clientes</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) => setField("status", e.target.value)}
          >
            <option value="">Todas as situações</option>
            <option value="OK">Normal (Acima do mín.)</option>
            <option value="ABAIXO_MINIMO">Abaixo do mínimo</option>
            <option value="ZERADO">Sem estoque (Ruptura)</option>
          </Select>

          <Button
            variant="secondary"
            onClick={() =>
              setFilters({
                q: "",
                classification: "",
                clientId: "",
                status: "",
                sort: "sortOrder",
                dir: "asc",
                page: 1,
              })
            }
          >
            Limpar Filtros
          </Button>
        </div>

        {error && <ErrorBox message={error} />}

        {loading && !data ? (
          <Spinner />
        ) : (
          data && (
            <>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-navy-900 text-white uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">
                        <Th k="code">Código / Part Number</Th>
                      </th>
                      <th className="py-2.5 px-3">
                        <Th k="description">Produto</Th>
                      </th>
                      <th className="py-2.5 px-3">Modelo</th>
                      <th className="py-2.5 px-3">
                        <Th k="client">Cliente</Th>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <Th k="balance">Saldo Atual</Th>
                      </th>
                      <th className="py-2.5 px-3 text-right">Estoque Mínimo</th>
                      <th className="py-2.5 px-3 text-center">Tipo</th>
                      <th className="py-2.5 px-3">Situação</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {data.rows.map((row: any) => {
                      const isNg = row.classification === "NG";
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isNg ? "bg-red-50/20" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-brand">
                            {row.code}
                          </td>
                          <td className="py-2.5 px-3 text-navy-900">{row.description}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.model}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.client}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-navy-900">
                            {fmtN(row.balance)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {row.minStock}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge tone={isNg ? "red" : "green"}>
                              {isNg ? "NG" : "Normal"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge tone={ST_MAP[row.status]?.[1] ?? "gray"}>
                              {ST_MAP[row.status]?.[0] ?? row.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(row)}
                              className="inline-flex items-center gap-1 text-brand hover:underline font-semibold"
                            >
                              <HistoryIcon className="h-3.5 w-3.5" />
                              <span>Histórico</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pager
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onChange={(p) => setField("page", p)}
              />
            </>
          )
        )}
      </Card>

      {/* MODAL DE HISTÓRICO DO PRODUTO */}
      <ProductHistoryModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}

function ProductHistoryModal({ product, onClose }: { product: any; onClose: () => void }) {
  const { data, loading } = useFetch<any[]>(product ? `/api/products/${product.id}` : null);

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product ? `Rastreabilidade Unitária — ${product.code}` : ""}
      wide
    >
      {product && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Descrição:</span>
              <span className="font-semibold text-navy-900">{product.description}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Modelo / Veículo:</span>
              <span className="font-semibold text-navy-900">{product.model}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Saldo Atual:</span>
              <span className="font-mono font-bold text-brand text-sm">{fmtN(product.balance)} un</span>
            </div>
            <div>
              <span className="text-slate-400 block">Estoque Mínimo:</span>
              <span className="font-mono text-slate-700">{product.minStock} un</span>
            </div>
          </div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Linha do Tempo de Movimentações (Auditável)
          </h4>

          {loading ? (
            <Spinner />
          ) : (
            <Table
              head={["Nº Operação", "Data / Hora", "Operação", "Quantidade", "Responsável", "Situação"]}
              empty={data?.length ? undefined : "Sem movimentações registradas para este produto."}
            >
              {data?.map((m: any) => (
                <tr key={m.id}>
                  <td className="font-mono font-bold text-xs text-brand">{m.number}</td>
                  <td className="font-mono text-xs text-slate-600">{fmtDT(m.occurredAt)}</td>
                  <td className="font-semibold text-xs text-navy-900">{m.type}</td>
                  <td className="font-mono font-bold text-xs">
                    {m.type === "SAIDA" || m.type === "AJUSTE_NEGATIVO" ? `-${m.quantity}` : `+${m.quantity}`}
                  </td>
                  <td className="text-xs text-slate-700">{m.createdBy?.name ?? "—"}</td>
                  <td>
                    {m.status === "ESTORNADA" ? (
                      <Badge tone="red">Estornada</Badge>
                    ) : (
                      <Badge tone="green">Ativa</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </Modal>
  );
}
