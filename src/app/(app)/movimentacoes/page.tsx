"use client";
import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Table, Textarea, useToast } from "@/components/ui";
import { api, fmtDT, qs, useFetch } from "@/lib/api";

const TYPE: Record<string, string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE_POSITIVO: "Ajuste (+)", AJUSTE_NEGATIVO: "Ajuste (−)" };
export default function Movimentacoes() {
  const [f, setF] = useState<any>({ from: "", to: "", code: "", product: "", client: "", userId: "", type: "", classification: "", page: 1 }); const [sel, setSel] = useState<string | null>(null);
  const { data, error, loading, reload } = useFetch<any>(`/api/movements?${qs({ ...f, pageSize: 25 })}`);
  const { data: users } = useFetch<any[]>("/api/users");
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v, page: k === "page" ? v : 1 }));
  return <>
    <PageHeader title="Histórico de movimentações" subtitle="Movimentações confirmadas nunca são excluídas — apenas corrigidas ou estornadas, com rastreabilidade" />
    <Card>
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <Field label="Data inicial"><Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} /></Field><Field label="Data final"><Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} /></Field>
        <Field label="Código"><Input value={f.code} onChange={(e) => set("code", e.target.value)} /></Field><Field label="Produto"><Input value={f.product} onChange={(e) => set("product", e.target.value)} /></Field>
        <Field label="Cliente"><Input value={f.client} onChange={(e) => set("client", e.target.value)} /></Field>
        <Field label="Funcionário"><Select value={f.userId} onChange={(e) => set("userId", e.target.value)}><option value="">Todos</option>{users?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Operação"><Select value={f.type} onChange={(e) => set("type", e.target.value)}><option value="">Todas</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Classificação"><Select value={f.classification} onChange={(e) => set("classification", e.target.value)}><option value="">Todas</option><option value="NORMAL">Normal</option><option value="NG">NG</option></Select></Field>
      </div>
      {error && <ErrorBox message={error} />}{loading && !data ? <Spinner /> : data && <>
        <Table head={["Nº", "Data", "Código", "Operação", "Qtd", "Usuário", "Situação"]} empty={data.rows.length ? undefined : "Nenhuma movimentação."}>
          {data.rows.map((m: any) => <tr key={m.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSel(m.id)}><td className="font-mono text-xs">{m.number}</td><td>{fmtDT(m.occurredAt)}</td><td>{m.product.code}</td><td>{TYPE[m.type]}</td><td>{m.quantity}</td><td>{m.createdBy.name}</td>
            <td>{m.status === "ESTORNADA" ? <Badge tone="red">Estornada</Badge> : <Badge tone="green">Ativa</Badge>}</td></tr>)}
        </Table><Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => set("page", p)} /></>}
    </Card>
    <Detail id={sel} onClose={() => setSel(null)} onChanged={reload} />
  </>;
}
function Detail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { data: m, loading, reload } = useFetch<any>(id ? `/api/movements/${id}` : null); const { data: me } = useFetch<any>("/api/auth/me");
  const toast = useToast(); const [edit, setEdit] = useState(false); const [qty, setQty] = useState(""); const [type, setType] = useState(""); const [just, setJust] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const canCorrect = me?.permissions.includes("movements.correct") && m?.status === "ATIVA" && !m?.type.startsWith("AJUSTE");
  const send = async (v: boolean) => { setBusy(true); setErr(""); try {
      await api(`/api/movements/${m.id}/corrections`, { method: "POST", json: { justification: just, ...(v ? { void: true } : { quantity: qty ? Number(qty) : undefined, type: type && type !== m.type ? type : undefined }) } });
      toast("Correção registrada."); setEdit(false); setJust(""); reload(); onChanged(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  return <Modal open={!!id} onClose={onClose} title={m ? `Movimentação ${m.number}` : "Movimentação"} wide>
    {loading || !m ? <Spinner /> : <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Produto", `${m.product.code} — ${m.product.description}`], ["Cliente", m.product.client.name], ["Operação", TYPE[m.type]], ["Quantidade", m.quantity], ["Data/hora", fmtDT(m.occurredAt)], ["Usuário", m.createdBy.name], ["Origem", m.source], ["Situação", m.status]].map(([k, v]) => <div key={k as string}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      {m.note && <p className="rounded bg-slate-50 p-2">Obs.: {m.note}</p>}
      <div><h4 className="mb-1 font-semibold">Histórico de correções</h4>
        {m.revisions.length === 0 ? <p className="text-slate-400">Sem correções.</p> : <Table head={["#", "Antes", "Depois", "Justificativa", "Quem", "Quando"]}>{m.revisions.map((r: any) => <tr key={r.id}><td>{r.revisionNo}</td><td className="text-xs">{r.previous.type} · {r.previous.quantity}</td><td className="text-xs">{r.next.status === "ESTORNADA" ? "ESTORNADA" : `${r.next.type} · ${r.next.quantity}`}</td><td>{r.justification}</td><td>{r.revisedBy.name}</td><td>{fmtDT(r.revisedAt)}</td></tr>)}</Table>}</div>
      {canCorrect && !edit && <Button variant="secondary" onClick={() => { setEdit(true); setQty(String(m.quantity)); setType(m.type); }}>Corrigir movimentação</Button>}
      {edit && <div className="space-y-3 rounded-lg border p-3">
        <div className="grid grid-cols-2 gap-3"><Field label="Nova quantidade"><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Operação"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></Select></Field></div>
        <Field label="Justificativa obrigatória"><Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} /></Field>
        {err && <ErrorBox message={err} />}
        <div className="flex gap-2"><Button loading={busy} onClick={() => send(false)}>Salvar correção</Button><Button variant="danger" loading={busy} onClick={() => send(true)}>Estornar</Button><Button variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button></div></div>}
    </div>}
  </Modal>;
}
