"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Table,
  useToast,
} from "@/components/ui";
import { api, fmtDT, fmtN, useFetch } from "@/lib/api";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Clock,
  History,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function ConfiguracoesPage() {
  const toast = useToast();
  const { data: me } = useFetch<any>("/api/auth/me");
  const canAudit = me?.permissions?.includes("settings.manage");

  const { data: audit } = useFetch<any[]>(canAudit ? "/api/audit" : null);
  const { data: closure, reload: reloadClosure, loading: loadingClosure } = useFetch<any>(
    canAudit ? "/api/closures" : null
  );

  const [cur, setCur] = useState("");
  const [nxt, setNxt] = useState("");
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closureErr, setClosureErr] = useState("");

  const change = async () => {
    setErr("");
    try {
      await api("/api/auth/password", { method: "POST", json: { current: cur, next: nxt } });
      toast("Senha alterada com sucesso.");
      setCur("");
      setNxt("");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const handleCloseFiscalYear = async () => {
    setClosureErr("");
    setIsClosing(true);
    try {
      const res = await api<any>("/api/closures", { method: "POST" });
      toast(`Exercício ${res.year} fechado e saldos congelados com sucesso!`);
      setModalOpen(false);
      reloadClosure();
    } catch (e: any) {
      setClosureErr(e.message || "Erro ao congelar exercício.");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Configurações & Governança"
        subtitle="Gerenciamento de credenciais, auditoria IATF 16949 e congelamento anual de exercício para longevidade do sistema"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ALTERAR SENHA */}
        <Card title="Alterar Minha Senha">
          <div className="space-y-3">
            <Field label="Senha Atual">
              <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </Field>
            <Field label="Nova Senha" hint="Mín. 10 caracteres, maiúsculas, minúsculas e números.">
              <Input type="password" value={nxt} onChange={(e) => setNxt(e.target.value)} />
            </Field>
            {err && <ErrorBox message={err} />}
            <Button onClick={change} className="w-full">
              Salvar Nova Senha
            </Button>
          </div>
        </Card>

        {/* DIRETRIZES DA PLATAFORMA */}
        <Card title="Diretrizes da Plataforma Sesé" className="lg:col-span-2">
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm pb-1 border-b border-slate-100">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <span>Conformidade Operacional IATF 16949 &amp; ACID</span>
            </div>
            <p>
              • <strong>Fuso Horário Oficial:</strong> America/Sao_Paulo (Horário Oficial de Brasília).
            </p>
            <p>
              • <strong>Cálculo de Saldo:</strong> Saldo Inicial Congelado + Movimentações Ativas após a data de corte.
            </p>
            <p>
              • <strong>Governança de Turnos:</strong> 1º Turno (1T) e 2º Turno (2T) possuem espelhamento mútuo total para leitura, com bloqueio cruzado estrito para edição ou estorno.
            </p>
            <p>
              • <strong>Administrador Geral:</strong> Lucas Conceição possui autoridade de supervisão sobre ambos os turnos.
            </p>
          </div>
        </Card>
      </div>

      {/* FECHAMENTO DE EXERCÍCIO ANUAL (CONGELAMENTO DE SALDOS) */}
      {canAudit && (
        <Card
          title="Relatório Anual Consolidado & Congelamento de Exercício"
          className="mt-6 border-slate-300 shadow-sm"
        >
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-sky-50/70 border border-sky-200 rounded-xl text-sky-950">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-brand" />
                  <span className="font-bold text-sm text-slate-900">
                    Otimização de Performance para Longo Prazo (Horizonte 8 Anos)
                  </span>
                </div>
                <p className="text-slate-600 max-w-3xl leading-relaxed">
                  Ao fechar o exercício anual, o sistema congela o saldo final de cada peça como o novo{" "}
                  <strong>Saldo Inicial</strong> e atualiza a data de corte. O histórico anterior permanece salvo
                  para auditoria, mas as consultas diárias passam a calcular apenas o período corrente, mantendo
                  as respostas em menos de <strong>50 milissegundos</strong> mesmo após anos de operação diária.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => setModalOpen(true)}
                  className="bg-brand hover:bg-brand-dark text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Fechar Exercício do Ano</span>
                </Button>
              </div>
            </div>

            {loadingClosure && !closure ? (
              <Spinner />
            ) : (
              closure && (
                <>
                  {/* KPIs DO EXERCÍCIO ATUAL */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                        Corte Vigente
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block truncate">
                        {fmtDT(closure.cutoffDate)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                        Saldo Inicial Anterior
                      </span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {fmtN(closure.totals.totalInitialBalance)} un.
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                        <ArrowDownToLine className="h-3 w-3" />
                        Entradas Período
                      </span>
                      <span className="text-sm font-bold text-emerald-900 font-mono mt-0.5 block">
                        +{fmtN(closure.totals.totalEntradas)} un.
                      </span>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[11px] font-medium text-blue-800 uppercase tracking-wider block flex items-center gap-1">
                        <ArrowUpFromLine className="h-3 w-3" />
                        Saídas Período
                      </span>
                      <span className="text-sm font-bold text-blue-900 font-mono mt-0.5 block">
                        −{fmtN(closure.totals.totalSaidas)} un.
                      </span>
                    </div>

                    <div className="p-3 bg-navy-900 text-white border border-navy-800 rounded-xl">
                      <span className="text-[11px] font-medium text-sky-400 uppercase tracking-wider block">
                        Saldo Final Atual
                      </span>
                      <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                        {fmtN(closure.totals.totalFinalBalance)} un.
                      </span>
                    </div>
                  </div>

                  {/* HISTÓRICO DE EXERCÍCIOS FECHADOS */}
                  <div className="pt-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-slate-500" />
                      <span>Histórico de Fechamentos Anuais Registrados</span>
                    </h4>

                    {closure.history.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                        Nenhum fechamento anual consolidado foi executado até o momento. O sistema está no seu ciclo inicial.
                      </div>
                    ) : (
                      <Table head={["Ano", "Data do Fechamento", "Responsável", "Produtos", "Saldo Congelado"]}>
                        {closure.history.map((h: any) => (
                          <tr key={h.id}>
                            <td className="font-bold text-navy-900">{h.year}</td>
                            <td className="text-xs text-slate-600">{fmtDT(h.closedAt)}</td>
                            <td className="text-xs font-medium text-slate-800">
                              {h.closedBy?.name} ({h.closedBy?.email})
                            </td>
                            <td className="text-xs">{h.totalProducts} produtos</td>
                            <td className="font-bold font-mono text-xs text-brand">
                              {fmtN(h.totalFinalBalance)} un.
                            </td>
                          </tr>
                        ))}
                      </Table>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </Card>
      )}

      {/* AUDITORIA */}
      {canAudit && (
        <Card title="Auditoria Operacional Permanente (Últimos 200 Eventos)" className="mt-6">
          {audit && (
            <Table head={["Quando", "Colaborador", "Ação Registrada", "Entidade", "IP Origem"]}>
              {audit.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="text-xs text-slate-600 font-mono">{fmtDT(a.createdAt)}</td>
                  <td className="font-medium text-xs text-slate-800">{a.user?.name ?? "Sistema"}</td>
                  <td>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {a.action}
                    </span>
                  </td>
                  <td className="text-xs text-slate-600">{a.entity}</td>
                  <td className="font-mono text-[11px] text-slate-400">{a.ip ?? "local"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* MODAL DE CONFIRMAÇÃO DO FECHAMENTO ANUAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirmar Fechamento e Congelamento de Exercício"
        wide
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
            <p className="font-bold text-amber-950 mb-1">Atenção: Ação Irreversível de Governança</p>
            <p>
              Ao confirmar, os <strong>{closure?.totals?.totalFinalBalance} produtos</strong> atualmente em estoque
              terão seus saldos consolidados e congelados como o novo ponto de partida oficial. Todas as movimentações
              anteriores continuarão registradas para efeito de auditoria e conformidade IATF.
            </p>
          </div>

          {/* PRÉVIA DOS ITENS A SEREM CONGELADOS */}
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2">Código</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Saldo Anterior</th>
                  <th className="p-2 text-right">Entradas</th>
                  <th className="p-2 text-right">Saídas</th>
                  <th className="p-2 text-right font-bold text-brand">Novo Saldo Congelado</th>
                </tr>
              </thead>
              <tbody>
                {closure?.items?.map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold">{item.code}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right font-mono">{fmtN(item.initialBalance)}</td>
                    <td className="p-2 text-right font-mono text-emerald-700">+{fmtN(item.entradas)}</td>
                    <td className="p-2 text-right font-mono text-blue-700">−{fmtN(item.saidas)}</td>
                    <td className="p-2 text-right font-mono font-bold text-brand">{fmtN(item.finalBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {closureErr && <ErrorBox message={closureErr} />}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={isClosing}
              onClick={handleCloseFiscalYear}
              className="bg-brand text-white font-semibold"
            >
              Confirmar &amp; Congelar Exercício
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
