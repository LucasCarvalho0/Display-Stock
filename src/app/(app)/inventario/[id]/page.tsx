"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Package,
  Layers,
  Calculator,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Textarea,
  useToast,
} from "@/components/ui";
import { api, fmtD, fmtDT, fmtN, useFetch } from "@/lib/api";
import { INV_STATUS } from "@/lib/labels";

const SHIFT = { MANHA: "Manhã", NOITE: "Noite" } as const;
const REASONS: Record<string, string> = {
  SAIDA_NAO_REGISTRADA: "Saída não registrada",
  ENTRADA_NAO_REGISTRADA: "Entrada não registrada",
  ERRO_LANCAMENTO: "Erro de lançamento",
  DIVERGENCIA_FISICA: "Divergência física",
  PECA_DANIFICADA: "Peça danificada",
  PECA_LOCALIZADA: "Peça localizada",
  OUTROS: "Outros",
};
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
type Tab = "contagem" | "comparacao" | "divergencias" | "fechamento";

export default function InventarioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { data: inv, error, reload } = useFetch<any>(`/api/inventory/${id}`);
  const { data: me } = useFetch<any>("/api/auth/me");
  const [tab, setTab] = useState<Tab>("contagem");

  if (error) return <ErrorBox message={error} />;
  if (!inv || !me) return <Spinner />;

  const [label, tone] = INV_STATUS[inv.status];
  const has = (p: string) => me.permissions.includes(p);
  const tabs: [Tab, string, string][] = [
    ["contagem", "1. Contagem em 2 Etapas", "bg-blue-600"],
    ["comparacao", "2. Comparação Automática", "bg-indigo-600"],
    ["divergencias", `3. Divergências (${inv.discrepancies.length})`, "bg-amber-600"],
    ["fechamento", "4. Aprovação e Fechamento", "bg-emerald-600"],
  ];

  return (
    <>
      <PageHeader
        title={`Inventário Industrial ${inv.code}`}
        subtitle={`${fmtD(inv.referenceDate)} · Responsável: ${inv.responsible.name} · Planta Resende (Cockpit)`}
        action={<Badge tone={tone}>{label}</Badge>}
      />

      {/* Navegação entre Módulos do Inventário com cores de identificação */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {tabs.map(([k, l, color]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === k
                ? `${color} text-white shadow-md scale-105`
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>{l}</span>
          </button>
        ))}
      </div>

      {tab === "contagem" && <Count inv={inv} reload={reload} can={has("inventory.count")} />}
      {tab === "comparacao" && <Compare id={id} inv={inv} />}
      {tab === "divergencias" && (
        <Discrepancies
          inv={inv}
          reload={reload}
          can={has("inventory.count")}
          canApprove={has("inventory.approve")}
          canAdjust={has("adjustments.authorize")}
        />
      )}
      {tab === "fechamento" && (
        <Closing
          inv={inv}
          reload={reload}
          canApprove={has("inventory.approve")}
          canClose={has("inventory.close")}
        />
      )}
    </>
  );
}

function Count({ inv, reload, can }: { inv: any; reload: () => void; can: boolean }) {
  const toast = useToast();
  const locked = inv.status !== "INICIADO" && !String(inv.status).startsWith("CONTAGEM");
  const shifts = (["MANHA", "NOITE"] as const).filter((s) => inv.progress[s]);
  const [shift, setShift] = useState<"MANHA" | "NOITE">(shifts[0] ?? inv.startShift);
  const { data, reload: reloadItems } = useFetch<any>(`/api/inventory/${inv.id}?shift=${shift}`);
  const items: any[] = data?.items ?? [];

  // Etapa atual: 1 = Pallets Fechados, 2 = Pré-Montagem, 3 = Resumo Consolidado
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [idx, setIdx] = useState(0);

  // Valores da contagem para o item atual
  const [warehouseVal, setWarehouseVal] = useState<string>("0");
  const [preAssemblyVal, setPreAssemblyVal] = useState<string>("0");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const cur = items[idx];

  // Carrega os valores quando o produto muda
  useEffect(() => {
    if (cur) {
      setWarehouseVal(cur.warehouseQty !== null && cur.warehouseQty !== undefined ? String(cur.warehouseQty) : "0");
      setPreAssemblyVal(cur.preAssemblyQty !== null && cur.preAssemblyQty !== undefined ? String(cur.preAssemblyQty) : "0");
      setErr("");
    }
  }, [cur?.id, cur?.warehouseQty, cur?.preAssemblyQty]);

  const prog = inv.progress[shift];
  const other = shift === "MANHA" ? "NOITE" : "MANHA";

  // Salva no banco de dados e avança
  const saveCurrent = async (wVal: number, pVal: number, nextIndex?: number) => {
    if (!cur) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/inventory/${inv.id}/counts`, {
        method: "POST",
        json: {
          productId: cur.productId,
          shift,
          warehouseQty: wVal,
          preAssemblyQty: pVal,
          physicalQty: wVal + pVal,
        },
      });
      await reloadItems();
      reload();

      if (nextIndex !== undefined) {
        setIdx(nextIndex);
      } else if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        toast("Todas as peças desta etapa foram conferidas!");
        // Se terminou etapa 1, sugere etapa 2; se terminou etapa 2, vai para o resumo
        if (stage === 1) setStage(2);
        else if (stage === 2) setStage(3);
      }
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar contagem.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    const w = Number(warehouseVal) || 0;
    const p = Number(preAssemblyVal) || 0;
    saveCurrent(w, p);
  };

  const handleZeroAndNext = () => {
    if (stage === 1) {
      setWarehouseVal("0");
      saveCurrent(0, Number(preAssemblyVal) || 0);
    } else {
      setPreAssemblyVal("0");
      saveCurrent(Number(warehouseVal) || 0, 0);
    }
  };

  const addQuick = (amount: number) => {
    if (stage === 1) {
      const curVal = Number(warehouseVal) || 0;
      setWarehouseVal(String(Math.max(0, curVal + amount)));
    } else {
      const curVal = Number(preAssemblyVal) || 0;
      setPreAssemblyVal(String(Math.max(0, curVal + amount)));
    }
  };

  const startOther = async () => {
    try {
      await api(`/api/inventory/${inv.id}/shifts`, { method: "POST", json: { shift: other } });
      setShift(other);
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const finish = async () => {
    try {
      const r = await api(`/api/inventory/${inv.id}/finish`, { method: "POST" });
      toast(
        r.discrepancies
          ? `${r.discrepancies} divergência(s) identificada(s).`
          : "Contagem validada sem divergências!",
        "ok"
      );
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const allDone = shifts.length === 2 && shifts.every((s) => inv.progress[s].counted === inv.progress[s].total);

  // Totais do turno atual
  const totalWarehouseSum = items.reduce((acc, it) => acc + (it.warehouseQty || 0), 0);
  const totalPreAssemblySum = items.reduce((acc, it) => acc + (it.preAssemblyQty || 0), 0);
  const totalPhysicalSum = totalWarehouseSum + totalPreAssemblySum;

  return (
    <div className="space-y-6">
      {/* SELETOR DE ETAPAS DO INVENTÁRIO (GRANDE E COLORIDO PARA TABLET) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setStage(1)}
          className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
            stage === 1
              ? "bg-[#1E3F90] text-white border-[#1E3F90] shadow-lg ring-2 ring-blue-300"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stage === 1 ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
              <Package className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-80">Etapa 1</span>
              <span className="text-base font-bold">Pallets Fechados</span>
              <span className="text-xs block opacity-75 mt-0.5">Almoxarifado Multimídia</span>
            </div>
          </div>
          <span className="text-sm font-mono font-bold">{fmtN(totalWarehouseSum)} pçs</span>
        </button>

        <button
          type="button"
          onClick={() => setStage(2)}
          className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
            stage === 2
              ? "bg-amber-600 text-white border-amber-600 shadow-lg ring-2 ring-amber-300"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stage === 2 ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-80">Etapa 2</span>
              <span className="text-base font-bold">Pré-Montagem</span>
              <span className="text-xs block opacity-75 mt-0.5">Kits L2, L3, PCD e bancadas</span>
            </div>
          </div>
          <span className="text-sm font-mono font-bold">{fmtN(totalPreAssemblySum)} pçs</span>
        </button>

        <button
          type="button"
          onClick={() => setStage(3)}
          className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
            stage === 3
              ? "bg-emerald-600 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-300"
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stage === 3 ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-80">Etapa 3</span>
              <span className="text-base font-bold">Resumo &amp; Total</span>
              <span className="text-xs block opacity-75 mt-0.5">Estoque + Pré-Montagem</span>
            </div>
          </div>
          <span className="text-sm font-mono font-bold">{fmtN(totalPhysicalSum)} pçs</span>
        </button>
      </div>

      {/* CONTROLE DE TURNO */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Turno Ativo:</span>
          {(["MANHA", "NOITE"] as const).map((s) => (
            <button
              key={s}
              disabled={!inv.progress[s]}
              onClick={() => setShift(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                shift === s
                  ? "bg-[#1E3F90] text-white shadow"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              } disabled:opacity-40`}
            >
              Turno {SHIFT[s]} ({inv.progress[s]?.counted || 0}/{inv.progress[s]?.total || 0})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!locked && can && !inv.progress[other] && (
            <Button variant="sky" onClick={startOther}>
              Iniciar Turno da {SHIFT[other]}
            </Button>
          )}
          {!locked && can && (
            <Button variant="success" disabled={!allDone} onClick={finish}>
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Contagem &amp; Comparar
            </Button>
          )}
        </div>
      </div>

      {/* ETAPA 1 E 2: ASSISTENTE DE CONTAGEM ITEM POR ITEM (DESIGN TOUCH TABLET) */}
      {(stage === 1 || stage === 2) && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8">
          {locked ? (
            <p className="text-center py-10 text-slate-500 text-lg">A contagem deste inventário já foi encerrada.</p>
          ) : !cur ? (
            <Spinner />
          ) : (
            <div className="space-y-6">
              {/* CABEÇALHO DO PRODUTO ATUAL */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        stage === 1 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {stage === 1 ? "Etapa 1: Pallets Fechados" : "Etapa 2: Pré-Montagem (Bancada)"}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      Item {idx + 1} de {items.length}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
                    {cur.description}
                  </h2>
                  <p className="font-mono text-sm text-slate-500 mt-0.5">Part Number: {cur.code}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-right">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Saldo Sistema
                    </span>
                    <span className="text-2xl font-bold font-mono text-navy-900">
                      {fmtN(cur.systemBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD DE CONTAGEM TOUCH COM INPUT GIGANTE */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <label className="text-base md:text-lg font-bold text-slate-800">
                    {stage === 1
                      ? "Quantidade nos Pallets Fechados:"
                      : "Quantidade na Pré-Montagem (L2, L3, PCD, Bancada):"}
                  </label>
                  <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                    Padrão zero se não houver peça
                  </span>
                </div>

                {/* INPUT COM CONTROLES + / - */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 max-w-xl mx-auto">
                  <button
                    type="button"
                    onClick={() => addQuick(-10)}
                    className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:scale-95 text-slate-700 font-bold text-base sm:text-lg flex items-center justify-center shadow-sm"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuick(-1)}
                    className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:scale-95 text-slate-700 font-bold text-xl flex items-center justify-center shadow-sm"
                  >
                    <Minus className="h-6 w-6" />
                  </button>

                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    autoFocus
                    value={stage === 1 ? warehouseVal : preAssemblyVal}
                    disabled={!can}
                    onChange={(e) => {
                      if (stage === 1) setWarehouseVal(e.target.value);
                      else setPreAssemblyVal(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && can && handleConfirm()}
                    className="w-36 sm:w-56 h-14 sm:h-20 text-center font-mono text-3xl sm:text-4xl font-extrabold bg-white border-2 border-brand rounded-2xl shadow-inner focus:outline-none focus:ring-4 focus:ring-brand/20 text-navy-900"
                  />

                  <button
                    type="button"
                    onClick={() => addQuick(1)}
                    className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:scale-95 text-slate-700 font-bold text-xl flex items-center justify-center shadow-sm"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuick(10)}
                    className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:scale-95 text-slate-700 font-bold text-base sm:text-lg flex items-center justify-center shadow-sm"
                  >
                    +10
                  </button>
                </div>

                {/* BOTÕES DE INCREMENTO RÁPIDO PARA TABLET */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (stage === 1) setWarehouseVal("0");
                      else setPreAssemblyVal("0");
                    }}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-800 active:scale-95 shadow-xs"
                  >
                    Zerar (0)
                  </button>
                  {[5, 10, 20, 50, 100, 200, 500].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => addQuick(num)}
                      className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs active:scale-95 shadow-xs"
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                {/* CÁLCULO AO VIVO DESTE PRODUTO */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Pallets Fechados
                    </span>
                    <span className="text-lg md:text-xl font-bold font-mono text-blue-600">
                      {fmtN(Number(warehouseVal) || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Pré-Montagem
                    </span>
                    <span className="text-lg md:text-xl font-bold font-mono text-amber-600">
                      {fmtN(Number(preAssemblyVal) || 0)}
                    </span>
                  </div>
                  <div className="bg-emerald-50 rounded-xl py-1 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Total Físico
                    </span>
                    <span className="text-xl md:text-2xl font-extrabold font-mono text-emerald-700">
                      {fmtN((Number(warehouseVal) || 0) + (Number(preAssemblyVal) || 0))}
                    </span>
                  </div>
                </div>

                {err && <ErrorBox message={err} />}
              </div>

              {/* BOTÕES DE AÇÃO COM CORES VIBRANTES E TAMANHO GRANDE DE TOQUE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <Button
                  type="button"
                  variant="indigo"
                  disabled={idx === 0 || busy}
                  onClick={() => setIdx(idx - 1)}
                  className="py-4 text-base"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Item Anterior
                </Button>

                <Button
                  type="button"
                  variant="warning"
                  disabled={!can || busy}
                  onClick={handleZeroAndNext}
                  className="py-4 text-base"
                >
                  <RotateCcw className="h-5 w-5" />
                  Manter 0 &amp; Próximo
                </Button>

                <Button
                  type="button"
                  variant="success"
                  loading={busy}
                  disabled={!can}
                  onClick={handleConfirm}
                  className="py-4 text-base shadow-lg"
                >
                  <Check className="h-5 w-5" />
                  Confirmar &amp; Avançar
                </Button>
              </div>

              {/* ATALHOS RÁPIDOS DE LISTA */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Progresso do Turno:</span>
                  <b className="text-slate-800">
                    {prog.counted} de {prog.total} produtos apontados
                  </b>
                </div>

                <div className="flex items-center gap-2">
                  {stage === 1 ? (
                    <Button variant="sky" onClick={() => setStage(2)}>
                      Ir para Pré-Montagem <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="purple" onClick={() => setStage(3)}>
                      Ver Tabela Consolidada <ClipboardList className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 3: RESUMO E TABELA CONSOLIDADA (IDÊNTICA À PLANILHA DA FÁBRICA) */}
      {stage === 3 && (
        <Card
          title="Consolidação Oficial de Estoque (Pallets Fechados × Pré-Montagem)"
          action={
            <div className="flex items-center gap-2">
              <Button variant="indigo" onClick={() => setStage(1)}>
                <Package className="h-4 w-4" /> Revisar Pallets
              </Button>
              <Button variant="warning" onClick={() => setStage(2)}>
                <Layers className="h-4 w-4" /> Revisar Pré-Montagem
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1E3F90] text-white text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold rounded-tl-xl">Produto</th>
                  <th className="py-3 px-4 font-bold text-center">Part Number</th>
                  <th className="py-3 px-4 font-bold text-center bg-blue-800">Estoque (Pallets)</th>
                  <th className="py-3 px-4 font-bold text-center bg-amber-700">Pré-Montagem</th>
                  <th className="py-3 px-4 font-bold text-center bg-emerald-700">Total Físico</th>
                  <th className="py-3 px-4 font-bold text-center">Sistema</th>
                  <th className="py-3 px-4 font-bold text-center rounded-tr-xl">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {items.map((it) => {
                  const w = it.warehouseQty ?? 0;
                  const p = it.preAssemblyQty ?? 0;
                  const tot = it.physicalQty ?? w + p;
                  const diff = tot - it.systemBalance;

                  return (
                    <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-navy-900">{it.description}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 text-center">{it.code}</td>
                      <td className="py-3 px-4 font-mono font-bold text-center text-blue-700 bg-blue-50/40">
                        {fmtN(w)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-center text-amber-700 bg-amber-50/40">
                        {fmtN(p)}
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-center text-emerald-700 bg-emerald-50/50 text-base">
                        {fmtN(tot)}
                      </td>
                      <td className="py-3 px-4 font-mono text-center text-slate-600">{fmtN(it.systemBalance)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            diff === 0
                              ? "bg-emerald-100 text-emerald-800"
                              : diff > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {sign(diff)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-extrabold text-navy-900 border-t-2 border-slate-300">
                  <td colSpan={2} className="py-3.5 px-4 uppercase text-xs tracking-wider">
                    Total Geral de Peças:
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center text-blue-800 text-base">
                    {fmtN(totalWarehouseSum)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center text-amber-800 text-base">
                    {fmtN(totalPreAssemblySum)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center text-emerald-800 text-lg bg-emerald-100/60">
                    {fmtN(totalPhysicalSum)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center text-slate-700">
                    {fmtN(items.reduce((s, x) => s + (x.systemBalance || 0), 0))}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-center text-slate-700">
                    {sign(totalPhysicalSum - items.reduce((s, x) => s + (x.systemBalance || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="pt-6 border-t border-slate-200 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              Conferência final de turno antes da homologação e fechamento.
            </span>

            <Button
              variant="success"
              disabled={!allDone || locked}
              onClick={finish}
              className="w-full sm:w-auto py-3.5 px-6 text-base font-bold shadow-lg"
            >
              <CheckCircle2 className="h-5 w-5" />
              Validar Contagem &amp; Comparar Turnos
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Compare({ id, inv }: { id: string; inv: any }) {
  const { data, loading } = useFetch<any>(`/api/inventory/${id}/compare`);
  const [open, setOpen] = useState<string | null>(null);
  if (loading || !data) return <Spinner />;

  const cell = (d: any) =>
    !d ? (
      "—"
    ) : d.pending ? (
      <Badge tone="yellow">pendente</Badge>
    ) : (
      <span>
        <b className="text-emerald-700">{d.physicalQty}</b>{" "}
        <span className="text-xs text-slate-400">
          (Pallets: {d.warehouseQty || 0} + Pré: {d.preAssemblyQty || 0} · esp. {d.expectedQty})
        </span>
      </span>
    );
  const diff = (d: any) =>
    !d || d.pending ? (
      "—"
    ) : (
      <b className={d.difference ? "text-red-600" : "text-emerald-600"}>{sign(d.difference)}</b>
    );

  return (
    <Card title="Comparação Inteligente (Saldo de Referência + Movimentações do Período)">
      <Table
        head={[
          "Produto",
          "Manhã (Físico)",
          "Dif. Manhã",
          "Noite (Físico)",
          "Dif. Noite",
          "Manhã → Noite",
          "Situação",
        ]}
      >
        {data.rows.flatMap((r: any) => [
          <tr
            key={r.productId}
            onClick={() => setOpen(open === r.productId ? null : r.productId)}
            className="cursor-pointer hover:bg-slate-50 transition"
          >
            <td>
              <b>{r.description}</b>
              <div className="font-mono text-xs text-slate-400">{r.code}</div>
            </td>
            <td>{cell(r.MANHA)}</td>
            <td>{diff(r.MANHA)}</td>
            <td>{cell(r.NOITE)}</td>
            <td>{diff(r.NOITE)}</td>
            <td className="text-xs">
              {r.betweenShifts ? (
                <>
                  bruto {sign(r.betweenShifts.rawDiff)} · mov. {sign(r.betweenShifts.netMovements)} ·{" "}
                  <b
                    className={
                      r.betweenShifts.unexplainedDiff ? "text-red-600" : "text-emerald-600"
                    }
                  >
                    sem explicação {sign(r.betweenShifts.unexplainedDiff)}
                  </b>
                </>
              ) : (
                "—"
              )}
            </td>
            <td>
              {r.hasDiscrepancy ? (
                <Badge tone="red">DIVERGÊNCIA</Badge>
              ) : (
                <Badge tone="green">Correto</Badge>
              )}
            </td>
          </tr>,
          open === r.productId && (
            <tr key={r.productId + "d"} className="bg-slate-50">
              <td colSpan={7}>
                {(["MANHA", "NOITE"] as const).map(
                  (s) =>
                    r[s]?.movements && (
                      <div key={s} className="mb-3">
                        <div className="mb-1 text-xs font-semibold">
                          Turno da {SHIFT[s].toLowerCase()}: referência {r[s].referenceBalance} em{" "}
                          {fmtDT(r[s].referenceAt)}, contagem em {fmtDT(r[s].countedAt)} → esperado{" "}
                          {r[s].expectedQty}
                          {r[s].difference !== 0 && (
                            <span className="ml-2 font-bold text-red-600">
                              DIVERGÊNCIA IDENTIFICADA: {sign(r[s].difference)} PEÇAS
                            </span>
                          )}
                        </div>
                        {r[s].movements.length ? (
                          <Table head={["Data", "Nº", "Operação", "Quantidade", "Responsável"]}>
                            {r[s].movements.map((m: any) => (
                              <tr key={m.id}>
                                <td>{fmtDT(m.occurredAt)}</td>
                                <td className="font-mono text-xs">{m.number}</td>
                                <td>{m.type}</td>
                                <td>
                                  {m.type.endsWith("NEGATIVO") || m.type === "SAIDA"
                                    ? `-${m.quantity}`
                                    : `+${m.quantity}`}
                                </td>
                                <td>{m.userName}</td>
                              </tr>
                            ))}
                          </Table>
                        ) : (
                          <p className="text-xs text-slate-400">Sem movimentações no período.</p>
                        )}
                      </div>
                    )
                )}
                {r.betweenShifts?.related?.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {r.betweenShifts.related.length} movimentação(ões) entre as contagens da manhã e
                    da noite explicam {sign(r.betweenShifts.netMovements)} peças da diferença bruta.
                  </p>
                )}
              </td>
            </tr>
          ),
        ])}
      </Table>
      {inv.status === "FECHADO" && (
        <p className="mt-2 text-xs text-slate-500">
          Inventário fechado: valores exibidos refletem o histórico atual de movimentações válidas.
        </p>
      )}
    </Card>
  );
}

function Discrepancies({
  inv,
  reload,
  can,
  canApprove,
  canAdjust,
}: {
  inv: any;
  reload: () => void;
  can: boolean;
  canApprove: boolean;
  canAdjust: boolean;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const upd = (id: string, patch: any) => setForm((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const call = async (path: string, json: any, ok: string) => {
    try {
      await api(`/api/inventory/${inv.id}/${path}`, { method: "POST", json });
      toast(ok);
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };
  const closed = inv.status === "FECHADO";
  const ST: Record<string, ["red" | "yellow" | "green" | "gray", string]> = {
    ABERTA: ["red", "Sem justificativa"],
    JUSTIFICADA: ["yellow", "Aguardando análise"],
    APROVADA: ["green", "Aprovada"],
    REJEITADA: ["red", "Rejeitada"],
  };

  if (!inv.discrepancies.length)
    return (
      <Card>
        <p className="text-sm text-slate-500">
          {["INICIADO", "CONTAGEM_MANHA", "CONTAGEM_NOITE"].includes(inv.status)
            ? "As divergências são geradas ao encerrar a contagem e comparar os turnos."
            : "Nenhuma divergência identificada."}
        </p>
      </Card>
    );

  return (
    <div className="space-y-4">
      {inv.discrepancies.map((d: any) => {
        const f = form[d.id] ?? {};
        const [tone, label] = ST[d.status];
        return (
          <Card
            key={d.id}
            title={
              <span>
                {d.product.description}{" "}
                <span className="font-mono text-xs text-slate-400">{d.product.code}</span> · Turno
                da {SHIFT[d.shift as "MANHA"].toLowerCase()}
              </span>
            }
            action={<Badge tone={tone}>{label}</Badge>}
          >
            <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                Esperado<div className="text-lg font-semibold">{d.expectedQty}</div>
              </div>
              <div>
                Físico<div className="text-lg font-semibold">{d.physicalQty}</div>
              </div>
              <div>
                Diferença<div className="text-lg font-bold text-red-600">{sign(d.difference)}</div>
              </div>
            </div>
            {d.justifications.map((j: any) => (
              <p key={j.id} className="mb-1 rounded-xl bg-slate-50 p-2.5 text-sm border border-slate-200">
                <b>{REASONS[j.reason]}</b> — {j.text}{" "}
                <span className="text-xs text-slate-400">
                  ({j.user.name}, {fmtDT(j.createdAt)})
                </span>
              </p>
            ))}
            {d.approvals.map((a: any) => (
              <p key={a.id} className="mb-1 text-xs text-slate-500">
                {a.decision === "APROVADO" ? "Aprovada" : "Rejeitada"} por {a.approver.name} em{" "}
                {fmtDT(a.createdAt)}
                {a.comment && `: ${a.comment}`}
              </p>
            ))}
            {!closed && can && ["ABERTA", "REJEITADA"].includes(d.status) && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Motivo da divergência">
                    <Select
                      value={f.reason ?? ""}
                      onChange={(e) => upd(d.id, { reason: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {Object.entries(REASONS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Justificativa (obrigatória)">
                      <Textarea
                        rows={2}
                        value={f.text ?? ""}
                        onChange={(e) => upd(d.id, { text: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
                <Button
                  variant="warning"
                  onClick={() =>
                    call(
                      "justifications",
                      { discrepancyId: d.id, reason: f.reason, text: f.text },
                      "Justificativa registrada com sucesso."
                    )
                  }
                >
                  Registrar Justificativa
                </Button>
              </div>
            )}
            {!closed && canApprove && d.status === "JUSTIFICADA" && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <Field label="Comentário da análise">
                  <Input
                    value={f.comment ?? ""}
                    onChange={(e) => upd(d.id, { comment: e.target.value })}
                  />
                </Field>
                {canAdjust && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!f.adjust}
                      onChange={(e) => upd(d.id, { adjust: e.target.checked })}
                      className="rounded text-brand"
                    />
                    Ajustar o estoque ({sign(d.difference)}) com movimentação autorizada
                  </label>
                )}
                {f.adjust && (
                  <Field label="Justificativa do ajuste">
                    <Input
                      value={f.adjustJustification ?? ""}
                      onChange={(e) => upd(d.id, { adjustJustification: e.target.value })}
                    />
                  </Field>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    onClick={() =>
                      call(
                        "approvals",
                        {
                          discrepancyId: d.id,
                          decision: "APROVADO",
                          comment: f.comment,
                          adjust: f.adjust,
                          adjustJustification: f.adjustJustification,
                        },
                        "Divergência aprovada com sucesso."
                      )
                    }
                  >
                    Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      call(
                        "approvals",
                        { discrepancyId: d.id, decision: "REJEITADO", comment: f.comment },
                        "Divergência rejeitada."
                      )
                    }
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Closing({
  inv,
  reload,
  canApprove,
  canClose,
}: {
  inv: any;
  reload: () => void;
  canApprove: boolean;
  canClose: boolean;
}) {
  const toast = useToast();
  const call = async (p: string, json?: any) => {
    try {
      await api(`/api/inventory/${inv.id}/${p}`, { method: "POST", json });
      toast("Operação concluída com sucesso.");
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };
  const FLOW = [
    "Inventário iniciado",
    "Contagem Pallets Fechados",
    "Contagem Pré-Montagem",
    "Comparação e Consolidação",
    "Identificação de divergências",
    "Justificativas",
    "Análise do líder",
    "Fechamento",
  ];

  return (
    <Card title="Aprovação e Fechamento Operacional">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs">
        {FLOW.map((s, i) => (
          <li key={s} className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 font-medium">
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {inv.status === "FECHADO" ? (
        <p className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 font-semibold">
          Inventário fechado em {fmtDT(inv.closedAt)}. Registrado com sucesso no histórico de auditoria.
        </p>
      ) : (
        <>
          {inv.blockers.length > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-bold text-amber-950 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Pendências antes do fechamento:
              </p>
              <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                {inv.blockers.map((b: string) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 font-semibold">
              Tudo pronto! Todas as etapas foram conferidas e aprovadas.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <Button
                variant="purple"
                onClick={() =>
                  call("approvals", {
                    decision: "APROVADO",
                    comment: "Inventário conferido e aprovado pelo líder.",
                  })
                }
              >
                Aprovar Inventário
              </Button>
            )}
            {canClose && (
              <Button
                variant="success"
                disabled={inv.blockers.length > 0}
                onClick={() => call("close")}
                className="shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" /> Fechar Exercício do Inventário
              </Button>
            )}
          </div>
          {!canClose && (
            <p className="mt-2 text-xs text-slate-500">
              Seu perfil não possui permissão para efetuar o fechamento final.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
