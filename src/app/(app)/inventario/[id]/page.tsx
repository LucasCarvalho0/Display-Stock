"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Table, Textarea, useToast } from "@/components/ui";
import { api, fmtD, fmtDT, fmtN, useFetch } from "@/lib/api";
import { INV_STATUS } from "@/lib/labels";

const SHIFT = { MANHA: "Manhã", NOITE: "Noite" } as const;
const REASONS: Record<string, string> = { SAIDA_NAO_REGISTRADA: "Saída não registrada", ENTRADA_NAO_REGISTRADA: "Entrada não registrada", ERRO_LANCAMENTO: "Erro de lançamento", DIVERGENCIA_FISICA: "Divergência física", PECA_DANIFICADA: "Peça danificada", PECA_LOCALIZADA: "Peça localizada", OUTROS: "Outros" };
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
type Tab = "contagem" | "comparacao" | "divergencias" | "fechamento";

export default function InventarioDetalhe() {
  const { id } = useParams<{ id: string }>(); const { data: inv, error, reload } = useFetch<any>(`/api/inventory/${id}`); const { data: me } = useFetch<any>("/api/auth/me");
  const [tab, setTab] = useState<Tab>("contagem");
  if (error) return <ErrorBox message={error} />; if (!inv || !me) return <Spinner />;
  const [label, tone] = INV_STATUS[inv.status]; const has = (p: string) => me.permissions.includes(p);
  const tabs: [Tab, string][] = [["contagem", "Contagem"], ["comparacao", "Comparação"], ["divergencias", `Divergências (${inv.discrepancies.length})`], ["fechamento", "Aprovação e fechamento"]];
  return <>
    <PageHeader title={`Inventário ${inv.code}`} subtitle={`${fmtD(inv.referenceDate)} · Responsável: ${inv.responsible.name} · Peças normais`} action={<Badge tone={tone}>{label}</Badge>} />
    <div className="mb-4 flex gap-1 overflow-x-auto border-b">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${tab === k ? "border-b-2 border-brand text-brand" : "text-slate-500"}`}>{l}</button>)}</div>
    {tab === "contagem" && <Count inv={inv} reload={reload} can={has("inventory.count")} />}
    {tab === "comparacao" && <Compare id={id} inv={inv} />}
    {tab === "divergencias" && <Discrepancies inv={inv} reload={reload} can={has("inventory.count")} canApprove={has("inventory.approve")} canAdjust={has("adjustments.authorize")} />}
    {tab === "fechamento" && <Closing inv={inv} reload={reload} canApprove={has("inventory.approve")} canClose={has("inventory.close")} />}
  </>;
}

function Count({ inv, reload, can }: { inv: any; reload: () => void; can: boolean }) {
  const toast = useToast(); const locked = inv.status !== "INICIADO" && !String(inv.status).startsWith("CONTAGEM");
  const shifts = (["MANHA", "NOITE"] as const).filter((s) => inv.progress[s]);
  const [shift, setShift] = useState<"MANHA" | "NOITE">(shifts[0] ?? inv.startShift); const { data, reload: reloadItems } = useFetch<any>(`/api/inventory/${inv.id}?shift=${shift}`);
  const items: any[] = data?.items ?? []; const [idx, setIdx] = useState(0); const [val, setVal] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const firstPending = useMemo(() => Math.max(0, items.findIndex((i) => i.physicalQty === null)), [items]);
  useEffect(() => { setIdx(firstPending); }, [shift, items.length]); // retoma de onde parou
  const cur = items[idx]; useEffect(() => { setVal(cur?.physicalQty?.toString() ?? ""); setErr(""); }, [cur?.id, cur?.physicalQty]);
  const prog = inv.progress[shift]; const other = shift === "MANHA" ? "NOITE" : "MANHA";
  const confirm = async () => { if (val.trim() === "") return setErr("Informe a quantidade física."); setBusy(true); setErr("");
    try { await api(`/api/inventory/${inv.id}/counts`, { method: "POST", json: { productId: cur.productId, shift, physicalQty: Number(val) } }); await reloadItems(); reload(); if (idx < items.length - 1) setIdx(idx + 1); else toast("Última peça contada."); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const startOther = async () => { try { await api(`/api/inventory/${inv.id}/shifts`, { method: "POST", json: { shift: other } }); setShift(other); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const finish = async () => { try { const r = await api(`/api/inventory/${inv.id}/finish`, { method: "POST" }); toast(r.discrepancies ? `${r.discrepancies} divergência(s) identificada(s).` : "Sem divergências."); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const allDone = shifts.length === 2 && shifts.every((s) => inv.progress[s].counted === inv.progress[s].total);

  return <div className="grid gap-4 lg:grid-cols-3">
    <Card className="lg:col-span-2" title={`INVENTÁRIO — TURNO DA ${SHIFT[shift].toUpperCase()}`} action={<div className="flex gap-2">{(["MANHA", "NOITE"] as const).map((s) => <Button key={s} variant={shift === s ? "primary" : "secondary"} disabled={!inv.progress[s]} onClick={() => setShift(s)}>{SHIFT[s]}</Button>)}</div>}>
      {locked ? <p className="text-sm text-slate-500">A contagem deste inventário foi encerrada.</p> : !cur ? <Spinner /> : <div className="space-y-4">
        <div><div className="text-xs text-slate-500">Produto</div><div className="text-xl font-semibold text-navy-900">{cur.description}</div></div>
        <div className="grid grid-cols-3 gap-3"><div><div className="text-xs text-slate-500">Código</div><div className="font-mono">{cur.code}</div></div><div><div className="text-xs text-slate-500">Modelo</div><div>{cur.model}</div></div><div><div className="text-xs text-slate-500">Estoque no sistema</div><div className="text-2xl font-bold">{fmtN(cur.systemBalance)}</div></div></div>
        <Field label="Quantidade física"><Input type="number" min={0} inputMode="numeric" className="text-2xl" value={val} disabled={!can} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && can && confirm()} /></Field>
        {val !== "" && <p className="text-sm text-slate-600">Diferença para o saldo do sistema: <b className={Number(val) - cur.systemBalance ? "text-amber-700" : "text-emerald-700"}>{sign(Number(val) - cur.systemBalance)}</b> <span className="text-xs">(a análise final considera as movimentações do período)</span></p>}
        {err && <ErrorBox message={err} />}
        <Button loading={busy} disabled={!can} onClick={confirm} className="w-full py-3">CONFIRMAR CONTAGEM</Button>
        <div className="flex items-center justify-between border-t pt-3 text-sm"><span>Progresso: <b>{prog.counted}</b> de {prog.total} peças · item {idx + 1}/{items.length} {cur.physicalQty !== null && <Badge tone="green">contado</Badge>}</span>
          <div className="flex gap-2"><Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" />Anterior</Button><Button variant="secondary" disabled={idx >= items.length - 1} onClick={() => setIdx(idx + 1)}>PRÓXIMO PRODUTO<ChevronRight className="h-4 w-4" /></Button></div></div>
      </div>}
    </Card>
    <div className="space-y-4">
      <Card title="Andamento dos turnos">{(["MANHA", "NOITE"] as const).map((s) => <div key={s} className="mb-2 flex items-center justify-between text-sm"><span>{SHIFT[s]}</span>{inv.progress[s] ? <Badge tone={inv.progress[s].counted === inv.progress[s].total ? "green" : "yellow"}>{inv.progress[s].counted}/{inv.progress[s].total}</Badge> : <Badge>não iniciado</Badge>}</div>)}
        {!locked && can && !inv.progress[other] && <Button variant="secondary" className="mt-2 w-full" onClick={startOther}>Iniciar turno da {SHIFT[other].toLowerCase()}</Button>}
        {!locked && can && <Button variant="success" disabled={!allDone} className="mt-2 w-full" onClick={finish}><CheckCircle2 className="h-4 w-4" />Encerrar contagem e comparar</Button>}
        {!locked && !allDone && <p className="mt-2 text-xs text-slate-500">Os dois turnos precisam ter todas as peças contadas, de forma independente. Os números da manhã nunca são copiados para a noite.</p>}</Card>
    </div>
  </div>;
}

function Compare({ id, inv }: { id: string; inv: any }) {
  const { data, loading } = useFetch<any>(`/api/inventory/${id}/compare`); const [open, setOpen] = useState<string | null>(null);
  if (loading || !data) return <Spinner />;
  const cell = (d: any) => !d ? "—" : d.pending ? <Badge>pendente</Badge> : <span>{d.physicalQty} <span className="text-xs text-slate-400">(esp. {d.expectedQty})</span></span>;
  const diff = (d: any) => !d || d.pending ? "—" : <b className={d.difference ? "text-red-600" : "text-emerald-600"}>{sign(d.difference)}</b>;
  return <Card title="Comparação inteligente (saldo de referência + movimentações válidas do período)">
    <Table head={["Produto", "Manhã (físico)", "Dif. manhã", "Noite (físico)", "Dif. noite", "Manhã → Noite", "Situação"]}>
      {data.rows.flatMap((r: any) => [<tr key={r.productId} onClick={() => setOpen(open === r.productId ? null : r.productId)} className="cursor-pointer hover:bg-slate-50">
        <td><b>{r.description}</b><div className="font-mono text-xs text-slate-400">{r.code}</div></td><td>{cell(r.MANHA)}</td><td>{diff(r.MANHA)}</td><td>{cell(r.NOITE)}</td><td>{diff(r.NOITE)}</td>
        <td className="text-xs">{r.betweenShifts ? <>bruto {sign(r.betweenShifts.rawDiff)} · mov. {sign(r.betweenShifts.netMovements)} · <b className={r.betweenShifts.unexplainedDiff ? "text-red-600" : "text-emerald-600"}>sem explicação {sign(r.betweenShifts.unexplainedDiff)}</b></> : "—"}</td>
        <td>{r.hasDiscrepancy ? <Badge tone="red">DIVERGÊNCIA</Badge> : <Badge tone="green">Correto</Badge>}</td></tr>,
        open === r.productId && <tr key={r.productId + "d"} className="bg-slate-50"><td colSpan={7}>
          {(["MANHA", "NOITE"] as const).map((s) => r[s]?.movements && <div key={s} className="mb-3"><div className="mb-1 text-xs font-semibold">Turno da {SHIFT[s].toLowerCase()}: referência {r[s].referenceBalance} em {fmtDT(r[s].referenceAt)}, contagem em {fmtDT(r[s].countedAt)} → esperado {r[s].expectedQty}{r[s].difference !== 0 && <span className="ml-2 font-bold text-red-600">DIVERGÊNCIA IDENTIFICADA: {sign(r[s].difference)} PEÇAS</span>}</div>
            {r[s].movements.length ? <Table head={["Data", "Nº", "Operação", "Quantidade", "Responsável"]}>{r[s].movements.map((m: any) => <tr key={m.id}><td>{fmtDT(m.occurredAt)}</td><td className="font-mono text-xs">{m.number}</td><td>{m.type}</td><td>{m.type.endsWith("NEGATIVO") || m.type === "SAIDA" ? `-${m.quantity}` : `+${m.quantity}`}</td><td>{m.userName}</td></tr>)}</Table> : <p className="text-xs text-slate-400">Sem movimentações no período.</p>}</div>)}
          {r.betweenShifts?.related?.length > 0 && <p className="text-xs text-slate-500">{r.betweenShifts.related.length} movimentação(ões) entre as contagens da manhã e da noite explicam {sign(r.betweenShifts.netMovements)} peças da diferença bruta.</p>}
        </td></tr>])}
    </Table>
    {inv.status === "FECHADO" && <p className="mt-2 text-xs text-slate-500">Inventário fechado: valores exibidos refletem o histórico atual de movimentações válidas.</p>}
  </Card>;
}

function Discrepancies({ inv, reload, can, canApprove, canAdjust }: { inv: any; reload: () => void; can: boolean; canApprove: boolean; canAdjust: boolean }) {
  const toast = useToast(); const [form, setForm] = useState<Record<string, any>>({});
  const upd = (id: string, patch: any) => setForm((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const call = async (path: string, json: any, ok: string) => { try { await api(`/api/inventory/${inv.id}/${path}`, { method: "POST", json }); toast(ok); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const closed = inv.status === "FECHADO";
  const ST: Record<string, ["red" | "yellow" | "green" | "gray", string]> = { ABERTA: ["red", "Sem justificativa"], JUSTIFICADA: ["yellow", "Aguardando análise"], APROVADA: ["green", "Aprovada"], REJEITADA: ["red", "Rejeitada"] };
  if (!inv.discrepancies.length) return <Card><p className="text-sm text-slate-500">{["INICIADO", "CONTAGEM_MANHA", "CONTAGEM_NOITE"].includes(inv.status) ? "As divergências são geradas ao encerrar a contagem e comparar os turnos." : "Nenhuma divergência identificada."}</p></Card>;
  return <div className="space-y-4">{inv.discrepancies.map((d: any) => { const f = form[d.id] ?? {}; const [tone, label] = ST[d.status];
    return <Card key={d.id} title={<span>{d.product.description} <span className="font-mono text-xs text-slate-400">{d.product.code}</span> · Turno da {SHIFT[d.shift as "MANHA"].toLowerCase()}</span>} action={<Badge tone={tone}>{label}</Badge>}>
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm"><div>Esperado<div className="text-lg font-semibold">{d.expectedQty}</div></div><div>Físico<div className="text-lg font-semibold">{d.physicalQty}</div></div><div>Diferença<div className="text-lg font-bold text-red-600">{sign(d.difference)}</div></div></div>
      {d.justifications.map((j: any) => <p key={j.id} className="mb-1 rounded bg-slate-50 p-2 text-sm"><b>{REASONS[j.reason]}</b> — {j.text} <span className="text-xs text-slate-400">({j.user.name}, {fmtDT(j.createdAt)})</span></p>)}
      {d.approvals.map((a: any) => <p key={a.id} className="mb-1 text-xs text-slate-500">{a.decision === "APROVADO" ? "Aprovada" : "Rejeitada"} por {a.approver.name} em {fmtDT(a.createdAt)}{a.comment && `: ${a.comment}`}</p>)}
      {!closed && can && ["ABERTA", "REJEITADA"].includes(d.status) && <div className="mt-3 space-y-2 border-t pt-3"><div className="grid gap-2 md:grid-cols-3"><Field label="Motivo da divergência"><Select value={f.reason ?? ""} onChange={(e) => upd(d.id, { reason: e.target.value })}><option value="">Selecione…</option>{Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <div className="md:col-span-2"><Field label="Justificativa (obrigatória)"><Textarea rows={2} value={f.text ?? ""} onChange={(e) => upd(d.id, { text: e.target.value })} /></Field></div></div>
        <Button onClick={() => call("justifications", { discrepancyId: d.id, reason: f.reason, text: f.text }, "Justificativa registrada.")}>Registrar justificativa</Button></div>}
      {!closed && canApprove && d.status === "JUSTIFICADA" && <div className="mt-3 space-y-2 border-t pt-3">
        <Field label="Comentário da análise"><Input value={f.comment ?? ""} onChange={(e) => upd(d.id, { comment: e.target.value })} /></Field>
        {canAdjust && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.adjust} onChange={(e) => upd(d.id, { adjust: e.target.checked })} />Ajustar o estoque ({sign(d.difference)}) com movimentação de ajuste autorizada</label>}
        {f.adjust && <Field label="Justificativa do ajuste"><Input value={f.adjustJustification ?? ""} onChange={(e) => upd(d.id, { adjustJustification: e.target.value })} /></Field>}
        <div className="flex gap-2"><Button variant="success" onClick={() => call("approvals", { discrepancyId: d.id, decision: "APROVADO", comment: f.comment, adjust: f.adjust, adjustJustification: f.adjustJustification }, "Divergência aprovada.")}>Aprovar</Button>
          <Button variant="danger" onClick={() => call("approvals", { discrepancyId: d.id, decision: "REJEITADO", comment: f.comment }, "Divergência rejeitada.")}>Rejeitar</Button></div></div>}
    </Card>; })}</div>;
}

function Closing({ inv, reload, canApprove, canClose }: { inv: any; reload: () => void; canApprove: boolean; canClose: boolean }) {
  const toast = useToast(); const call = async (p: string, json?: any) => { try { await api(`/api/inventory/${inv.id}/${p}`, { method: "POST", json }); toast("Operação concluída."); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const FLOW = ["Inventário iniciado", "Contagem da manhã", "Contagem da noite", "Comparação automática", "Identificação de divergências", "Justificativas", "Análise do responsável", "Aprovação", "Fechamento"];
  return <Card title="Aprovação e fechamento">
    <ol className="mb-4 flex flex-wrap gap-2 text-xs">{FLOW.map((s, i) => <li key={s} className="rounded-full bg-slate-100 px-3 py-1">{i + 1}. {s}</li>)}</ol>
    {inv.status === "FECHADO" ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Inventário fechado em {fmtDT(inv.closedAt)}. Disponível no histórico.</p> : <>
      {inv.blockers.length > 0 ? <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="mb-1 text-sm font-semibold text-amber-900">Pendências que impedem o fechamento:</p><ul className="list-disc pl-5 text-sm text-amber-900">{inv.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul></div> : <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Tudo pronto para o fechamento.</p>}
      <div className="flex flex-wrap gap-2">
        {canApprove && <Button variant="secondary" onClick={() => call("approvals", { decision: "APROVADO", comment: "Inventário aprovado pelo responsável." })}>Aprovar inventário</Button>}
        {canClose && <Button disabled={inv.blockers.length > 0} onClick={() => call("close")}>Fechar inventário</Button>}
      </div>{!canClose && <p className="mt-2 text-xs text-slate-500">Seu perfil não tem permissão para fechar inventários.</p>}</>}
  </Card>;
}
