"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpDown,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Package,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Warehouse,
  X,
} from "lucide-react";
import { Badge, Button, ErrorBox, Field, Input, Select, Textarea, useToast } from "./ui";
import { api, fmtN, qs } from "@/lib/api";
import { movementCreateSchema } from "@/server/validators";

type FormData = z.input<typeof movementCreateSchema>;

type SuggestionItem = {
  id: string;
  code: string;
  baseCode: string;
  description: string;
  model: string;
  client: string;
  classification: "NORMAL" | "NG";
  balance: number;
  minStock: number;
  score?: number;
};

export default function MovementForm({ type }: { type: "ENTRADA" | "SAIDA" }) {
  const toast = useToast();
  const isOut = type === "SAIDA";
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(movementCreateSchema),
    defaultValues: {
      type,
      classification: "NORMAL",
      code: "",
      quantity: 1,
      note: "",
    },
  });

  const [productInfo, setProductInfo] = useState<any>(null);
  const [variants, setVariants] = useState<{ normal: any; ng: any } | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [serverError, setServerError] = useState("");
  const [successResult, setSuccessResult] = useState<any>(null);

  // Estados do Autocomplete / Busca Inteligente
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const code = watch("code");
  const classification = watch("classification");
  const quantityInput = watch("quantity");
  const quantity = Math.max(0, Number(quantityInput || 0));

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca rápida de sugestões conforme o usuário digita
  useEffect(() => {
    const q = code?.trim() || "";
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Se o código digitado é exatamente o código do produto já selecionado, não precisa reabrir dropdown
    if (productInfo && productInfo.code.toLowerCase() === q.toLowerCase()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api<SuggestionItem[]>(
          `/api/products/search?${qs({ q })}`
        );
        setSuggestions(results || []);
        setShowDropdown((results || []).length > 0);
        setHighlightedIndex(-1);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [code, productInfo]);

  // Função para selecionar um item sugerido
  const selectSuggestion = (item: SuggestionItem) => {
    setValue("code", item.code, { shouldValidate: true });
    setValue("classification", item.classification, { shouldValidate: true });
    setProductInfo(item);
    setShowDropdown(false);
    setLookupError("");

    // Carregar variantes deste produto (Normal e NG) para permitir troca imediata
    api<any>(`/api/products/lookup?${qs({ code: item.code, classification: item.classification })}`)
      .then((res) => {
        setProductInfo(res);
        setVariants(res.variants || null);
      })
      .catch(() => {});

    // Focar no campo de quantidade
    setTimeout(() => {
      const el = document.getElementById("quantity") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 100);
  };

  // Alternar instantaneamente entre versão Normal e versão NG da mesma peça
  const toggleVariant = async (targetCls: "NORMAL" | "NG") => {
    if (!productInfo) return;
    const base = productInfo.baseCode || productInfo.code.replace(/\s+NG$/i, "");
    const targetCode = targetCls === "NG" ? `${base} NG` : base;

    try {
      const res = await api<any>(
        `/api/products/lookup?${qs({ code: targetCode, classification: targetCls })}`
      );
      setValue("code", res.code, { shouldValidate: true });
      setValue("classification", targetCls, { shouldValidate: true });
      setProductInfo(res);
      setVariants(res.variants || null);
      setLookupError("");
      toast(`Peça alternada para ${targetCls === "NG" ? "NG / Quarentena" : "Normal"}. Saldo: ${res.balance} un.`);
    } catch (e: any) {
      toast(`Opção ${targetCls} não encontrada para esta peça.`, "err");
    }
  };

  // Busca explícita ao pressionar Enter ou clicar em Buscar
  const performLookup = async () => {
    const q = code?.trim();
    if (!q) {
      setProductInfo(null);
      setVariants(null);
      return;
    }

    setLookupError("");
    try {
      const res = await api<any>(
        `/api/products/lookup?${qs({ code: q, classification })}`
      );
      setProductInfo(res);
      setVariants(res.variants || null);
      setValue("code", res.code, { shouldValidate: true });
      setValue("classification", res.classification, { shouldValidate: true });
      setShowDropdown(false);
    } catch (e: any) {
      setLookupError(e.message || "Produto não localizado no cadastro.");
    }
  };

  // Navegação no dropdown via teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        performLookup();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        performLookup();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const currentBalance = productInfo ? productInfo.balance : 0;
  const projectedBalance = isOut
    ? currentBalance - quantity
    : currentBalance + quantity;

  const isInsufficient = isOut && productInfo && quantity > currentBalance;

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    setSuccessResult(null);

    try {
      const res = await api<any>("/api/movements", {
        method: "POST",
        json: values,
      });

      setSuccessResult(res);
      toast(`${res.number} confirmada com sucesso! Novo saldo: ${res.newBalance} un.`);
      reset({
        type,
        classification,
        code: "",
        quantity: 1,
        note: "",
      });
      setProductInfo(null);
      setVariants(null);
    } catch (e: any) {
      setServerError(e.message || "Falha ao registrar movimentação.");
      await performLookup();
    }
  });

  const addQty = (amount: number) => {
    setValue("quantity", (Number(quantity) || 0) + amount);
  };

  // Verifica se o dropdown contém opções normais e NG para o mesmo código
  const hasMultipleChoices = suggestions.length > 1;

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <span>Operações de Linha</span>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-500">
              {isOut ? "Alocação para Montagem" : "Recebimento de Carga"}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            {isOut ? "Saída de Peças e Telas" : "Entrada de Peças e Telas"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={isOut ? "/entrada" : "/saida"}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Ir para {isOut ? "Entrada" : "Saída"}
          </Link>
        </div>
      </div>

      {/* SUCESSO DE MOVIMENTAÇÃO */}
      {successResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-900">
                  Movimentação {successResult.number} Concluída!
                </span>
                <span className="bg-emerald-200 text-emerald-800 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
                  REGISTRADA
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Saldo anterior: <b>{successResult.previousBalance} un</b> → Saldo atualizado:{" "}
                <b className="text-sm font-mono">{successResult.newBalance} un</b>.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => setSuccessResult(null)}
          >
            OK
          </Button>
        </div>
      )}

      {/* GRID DE DUAS COLUNAS: FORMULÁRIO OPERACIONAL (7 COLS) + SIMULAÇÃO DE SALDO (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: FORMULÁRIO DE LANÇAMENTO */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
                  isOut ? "bg-brand" : "bg-emerald-600"
                }`}
              >
                {isOut ? (
                  <ArrowUpFromLine className="h-5 w-5" />
                ) : (
                  <ArrowDownToLine className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy-900">
                  {isOut ? "Requisição de Saída Cockpit" : "Recebimento e Buffer"}
                </h2>
                <p className="text-xs text-slate-500">
                  {isOut
                    ? "Alocação para linha de montagem com validação de saldo"
                    : "Conferência física de embalagem homologada e inserção de saldo"}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              ACID TX
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <input type="hidden" {...register("type")} />

            {/* CAMPO DE BUSCA INTELIGENTE COM AUTOCOMPLETE */}
            <div ref={searchContainerRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="part-code">
                  Buscar Peça por Código ou Descrição *
                </label>
                <span className="text-[11px] font-mono text-brand flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-brand" />
                  <span>Busca flexível (ex.: 11-6-32, 11633, BRPRT, PCD...)</span>
                </span>
              </div>

              <div className="relative">
                <QrCode className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="part-code"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder="Digite o código (ex: 11-6-32, BRPRT 11633, 99098) ou nome..."
                  {...register("code")}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  className={`w-full pl-10 pr-24 py-2.5 bg-white text-navy-900 font-mono text-sm rounded-lg border ${
                    errors.code ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
                  } focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20`}
                />
                <button
                  type="button"
                  onClick={performLookup}
                  className="absolute right-2 top-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Search className="h-3 w-3" />
                  <span>Buscar</span>
                </button>
              </div>

              {/* DROPDOWN DE SUGESTÕES E ESCOLHA RÁPIDA NORMAL VS NG */}
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {hasMultipleChoices
                        ? "Qual opção você quer? (Clique para selecionar)"
                        : "Opção encontrada:"}
                    </span>
                    <span className="text-[10px] font-mono font-normal">
                      Use as setas ↑↓ e Enter
                    </span>
                  </div>

                  {suggestions.map((item, index) => {
                    const isNg = item.classification === "NG";
                    const isSelected = highlightedIndex === index;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectSuggestion(item)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                          isSelected
                            ? "bg-blue-50 text-navy-900"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase shrink-0 ${
                              isNg
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isNg ? "NG / Quarentena" : "Normal"}
                          </span>
                          <div className="min-w-0 truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-navy-900">
                                {item.code}
                              </span>
                              <span className="text-xs text-slate-600 truncate">
                                — {item.description}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Modelo: {item.model} · Cliente: {item.client}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">
                            Saldo Atual
                          </span>
                          <span
                            className={`text-xs font-mono font-bold ${
                              item.balance <= 0
                                ? "text-red-500"
                                : isNg
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {fmtN(item.balance)} un
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {errors.code && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.code.message}</p>
              )}
            </div>

            {/* CARD DO PRODUTO SELECIONADO COM BOTÃO DE ALTERNÂNCIA NORMAL / NG */}
            {productInfo && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-brand shadow-xs">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-navy-900">
                          {productInfo.code}
                        </span>
                        <Badge tone={productInfo.classification === "NG" ? "red" : "green"}>
                          {productInfo.classification === "NG" ? "NG / Quarentena" : "Normal"}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-navy-900 mt-1">
                        {productInfo.description}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Modelo: <b>{productInfo.model}</b> · Cliente: <b>{productInfo.client}</b>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">
                      Saldo em Estoque
                    </span>
                    <span className="text-xl font-bold font-mono text-navy-900">
                      {fmtN(productInfo.balance)}{" "}
                      <span className="text-xs font-normal text-slate-500">un</span>
                    </span>
                  </div>
                </div>

                {/* BOTÃO DE ALTERNÂNCIA RÁPIDA NORMAL <-> NG */}
                {variants && (variants.normal || variants.ng) && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <span>Deseja alternar a classificação?</span>
                    </span>
                    {productInfo.classification === "NORMAL" && variants.ng ? (
                      <button
                        type="button"
                        onClick={() => toggleVariant("NG")}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs flex items-center gap-1 transition"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        <span>Mudar para NG (Saldo: {fmtN(variants.ng.balance)} un)</span>
                      </button>
                    ) : productInfo.classification === "NG" && variants.normal ? (
                      <button
                        type="button"
                        onClick={() => toggleVariant("NORMAL")}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs flex items-center gap-1 transition"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        <span>Mudar para Normal (Saldo: {fmtN(variants.normal.balance)} un)</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* CLASSIFICAÇÃO DA PEÇA (RADIO BUTTONS) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Classificação da Peça na Operação *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  onClick={() => {
                    if (productInfo && productInfo.classification !== "NORMAL") {
                      toggleVariant("NORMAL");
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    classification === "NORMAL"
                      ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="radio"
                    value="NORMAL"
                    {...register("classification")}
                    className="w-4 h-4 text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Peça Normal (Conforme)
                    </span>
                    <span className="text-[11px] text-slate-500">Apta para montagem</span>
                  </div>
                </label>

                <label
                  onClick={() => {
                    if (productInfo && productInfo.classification !== "NG") {
                      toggleVariant("NG");
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    classification === "NG"
                      ? "border-red-500 bg-red-50/60 ring-1 ring-red-500"
                      : "border-red-200 bg-red-50/30 hover:bg-red-50/60"
                  }`}
                >
                  <input
                    type="radio"
                    value="NG"
                    {...register("classification")}
                    className="w-4 h-4 text-red-600 accent-red-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-red-700 block">
                      Peça NG / Quarentena
                    </span>
                    <span className="text-[11px] text-red-600">Avaria / Segregada</span>
                  </div>
                </label>
              </div>
            </div>

            {/* QUANTIDADE COM BOTÕES DE INCREMENTO RÁPIDO */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="quantity">
                  Quantidade a Movimentar *
                </label>
                <span className="text-xs text-slate-400 font-mono">Unidade: Peças (UN)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  {...register("quantity")}
                  className={`w-36 py-2 px-3 text-lg font-bold font-mono text-navy-900 bg-white rounded-lg border ${
                    errors.quantity ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
                  } focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20`}
                />
                <button
                  type="button"
                  onClick={() => addQty(1)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-mono font-bold transition shadow-xs active:scale-95"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => addQty(5)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-mono font-bold transition shadow-xs active:scale-95"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => addQty(10)}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-mono font-bold transition shadow-xs active:scale-95"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => addQty(20)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-mono font-bold transition shadow-xs active:scale-95"
                >
                  +20 (Caixa)
                </button>
              </div>
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.quantity.message}</p>
              )}
            </div>

            {/* OBSERVAÇÃO */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="note">
                Observação / Documento / Justificativa
              </label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Ex.: Solicitação da Linha 04, lote de recebimento nº 489..."
                {...register("note")}
              />
            </div>

            {/* ALERTAS */}
            {lookupError && <ErrorBox message={lookupError} />}
            {isInsufficient && (
              <ErrorBox
                message={`Saldo insuficiente. Existem apenas ${currentBalance} unidades disponíveis.`}
              />
            )}
            {serverError && <ErrorBox message={serverError} />}

            {/* BOTÃO DE ENVIO */}
            <div className="pt-2">
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={!productInfo || isInsufficient}
                variant={isOut ? "primary" : "success"}
                className="w-full py-3 rounded-xl font-semibold text-sm shadow-md flex items-center justify-center gap-2"
              >
                {isOut ? (
                  <>
                    <ArrowUpFromLine className="h-4 w-4" />
                    <span>Confirmar Saída de Peças</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    <span>Confirmar Entrada de Peças</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* COLUNA DIREITA: SIMULAÇÃO DE SALDO & REGRAS DE AUDITORIA */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Simulação de Saldo em Tempo Real
              </h3>
              <span className="text-[11px] font-mono text-slate-400">TELEMETRIA</span>
            </div>

            {productInfo ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-slate-500">Saldo Atual em Sistema:</span>
                  <span className="font-mono font-bold text-navy-900 text-sm">
                    {fmtN(currentBalance)} un
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-slate-500">Operação Solicitada:</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      isOut ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {isOut ? `-${quantity}` : `+${quantity}`} un
                  </span>
                </div>

                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    isInsufficient
                      ? "bg-red-50 border-red-300 text-red-900"
                      : "bg-blue-50/50 border-blue-200 text-navy-900"
                  }`}
                >
                  <div>
                    <span className="text-xs font-semibold block">Saldo Resultante:</span>
                    <span className="text-[11px] text-slate-500">
                      {isInsufficient ? "Operação bloqueada" : "Saldo após confirmação"}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-2xl font-black ${
                      isInsufficient ? "text-red-600" : "text-brand"
                    }`}
                  >
                    {fmtN(projectedBalance)} un
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <Terminal className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                <span>Bipe ou digite o código de um produto para visualizar a simulação.</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  <b>Transação Atômica:</b> O saldo e o histórico são gravados simultaneamente.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  <b>Proteção contra Saldo Negativo:</b> O sistema rejeita saídas maiores que o
                  estoque disponível.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
