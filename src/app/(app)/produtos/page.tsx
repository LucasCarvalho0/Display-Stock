"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import type { z } from "zod";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Table, useToast } from "@/components/ui";
import { api, fmtN, qs, useFetch } from "@/lib/api";
import { productCreateSchema } from "@/server/validators";

type Form = z.input<typeof productCreateSchema>;
export default function Produtos() {
  const toast = useToast(); const { data: me } = useFetch<any>("/api/auth/me"); const canEdit = me?.permissions.includes("products.edit");
  const [f, setF] = useState({ q: "", classification: "", page: 1 }); const { data, loading, reload } = useFetch<any>(`/api/products?${qs({ ...f, pageSize: 25 })}`); const { data: clients } = useFetch<any[]>("/api/clients");
  const [newOpen, setNewOpen] = useState(false); const [impOpen, setImpOpen] = useState(false);
  const toggle = async (r: any) => { try { await api(`/api/products/${r.id}`, { method: "PATCH", json: { active: !r.active } }); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const setMin = async (r: any) => { const v = prompt(`Estoque mínimo de ${r.code}:`, String(r.minStock)); if (v === null) return; try { await api(`/api/products/${r.id}`, { method: "PATCH", json: { minStock: Number(v) } }); reload(); } catch (e: any) { toast(e.message, "err"); } };
  return <>
    <PageHeader title="Cadastro de produtos" subtitle="Peças normais e NG são cadastros distintos (o NG recebe o sufixo “ NG” no código)" action={canEdit && <div className="flex gap-2"><Button variant="secondary" onClick={() => setImpOpen(true)}><Upload className="h-4 w-4" />Importar Excel</Button><Button onClick={() => setNewOpen(true)}>Novo produto</Button></div>} />
    <Card><div className="mb-3 grid gap-2 md:grid-cols-3"><Input placeholder="Pesquisar código, descrição, modelo ou cliente" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} />
      <Select value={f.classification} onChange={(e) => setF({ ...f, classification: e.target.value, page: 1 })}><option value="">Todas as classificações</option><option value="NORMAL">Normal</option><option value="NG">NG</option></Select></div>
      {loading && !data ? <Spinner /> : data && <><Table head={["Código", "Descrição", "Modelo", "Cliente", "Classificação", "Mínimo", "Status", ""]} empty={data.rows.length ? undefined : "Nenhum produto."}>
        {data.rows.map((r: any) => <tr key={r.id}><td className="font-mono text-xs">{r.code}</td><td>{r.description}</td><td>{r.model}</td><td>{r.client}</td><td><Badge tone={r.classification === "NG" ? "red" : "green"}>{r.classification === "NG" ? "NG" : "Normal"}</Badge></td><td>{fmtN(r.minStock)}</td><td>{r.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
          <td className="space-x-3 whitespace-nowrap text-xs">{canEdit && <><button className="text-brand" onClick={() => setMin(r)}>Mínimo</button><button className="text-slate-500" onClick={() => toggle(r)}>{r.active ? "Inativar" : "Ativar"}</button></>}</td></tr>)}</Table>
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setF({ ...f, page: p })} /></>}</Card>
    <NewProduct open={newOpen} onClose={() => setNewOpen(false)} clients={clients ?? []} onDone={() => { setNewOpen(false); reload(); }} />
    <ImportModal open={impOpen} onClose={() => setImpOpen(false)} onDone={() => { setImpOpen(false); reload(); }} />
  </>;
}
function NewProduct({ open, onClose, clients, onDone }: { open: boolean; onClose: () => void; clients: any[]; onDone: () => void }) {
  const toast = useToast(); const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(productCreateSchema), defaultValues: { classification: "NORMAL", minStock: 1 } });
  const submit = handleSubmit(async (v) => { setErr(""); try { await api("/api/products", { method: "POST", json: v }); toast("Produto cadastrado."); reset(); onDone(); } catch (e: any) { setErr(e.message); } });
  return <Modal open={open} onClose={onClose} title="Novo produto"><form onSubmit={submit} className="space-y-3" noValidate>
    <Field label="Código da peça" error={errors.code?.message} hint="Sem o sufixo NG — ele é aplicado pela classificação."><Input {...register("code")} /></Field>
    <Field label="Descrição" error={errors.description?.message}><Input {...register("description")} /></Field><Field label="Modelo" error={errors.model?.message}><Input {...register("model")} /></Field>
    <Field label="Cliente" error={errors.clientId?.message}><Select {...register("clientId")}><option value="">Selecione…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Classificação"><Select {...register("classification")}><option value="NORMAL">Normal</option><option value="NG">NG</option></Select></Field><Field label="Estoque mínimo" error={errors.minStock?.message}><Input type="number" min={0} {...register("minStock")} /></Field></div>
    <p className="text-xs text-slate-500">O saldo inicial é sempre zero; use “Entrada de peças” para lançar estoque.</p>
    {err && <ErrorBox message={err} />}<Button type="submit" loading={isSubmitting} className="w-full">Salvar</Button></form></Modal>;
}
function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const ref = useRef<HTMLInputElement>(null); const [kind, setKind] = useState("PRODUTOS"); const [prev, setPrev] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const upload = async () => { const file = ref.current?.files?.[0]; if (!file) return setErr("Selecione um arquivo .xlsx."); setBusy(true); setErr(""); setPrev(null);
    try { const fd = new FormData(); fd.append("file", file); fd.append("kind", kind); setPrev(await api("/api/import/excel", { method: "POST", body: fd })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); try { const r = await api("/api/import/excel", { method: "POST", json: { batchId: prev.batchId } }); toast(`${r.imported} registro(s) importado(s).`); setPrev(null); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const tone: Record<string, any> = { NOVO: "green", VALIDO: "green", DUPLICADO_BANCO: "yellow", DUPLICADO_ARQUIVO: "yellow", INVALIDO: "red" };
  const importable = prev?.rows.filter((r: any) => r.status === "NOVO" || r.status === "VALIDO").length ?? 0;
  return <Modal open={open} onClose={onClose} title="Importar planilha Excel" wide><div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-3"><Field label="Tipo"><Select value={kind} onChange={(e) => { setKind(e.target.value); setPrev(null); }}><option value="PRODUTOS">Produtos</option><option value="MOVIMENTACOES">Movimentações</option></Select></Field>
      <div className="md:col-span-2"><Field label="Arquivo .xlsx" hint={kind === "PRODUTOS" ? "Colunas: Código, Produto, Modelo, Cliente (opcional: Estoque Mínimo, Classificação)" : "Colunas: Código, Tipo (Entrada/Saída), Quantidade"}><input ref={ref} type="file" accept=".xlsx" className="text-sm" /></Field></div></div>
    <Button onClick={upload} loading={busy} variant="secondary">Gerar prévia</Button>{err && <ErrorBox message={err} />}
    {prev && <><div className="flex flex-wrap gap-2 text-sm">{Object.entries(prev.summary).map(([k, v]) => <Badge key={k} tone={tone[k] ?? "gray"}>{k}: {String(v)}</Badge>)}</div>
      <div className="max-h-72 overflow-auto"><Table head={["Linha", "Código", "Situação", "Detalhes"]}>{prev.rows.map((r: any) => <tr key={r.line}><td>{r.line}</td><td>{r.data.code}</td><td><Badge tone={tone[r.status]}>{r.status}</Badge></td><td className="text-xs">{r.errors.join("; ") || (r.status.startsWith("DUPLICADO") ? "Será ignorado" : "")}{r.data.newClient ? " · cliente novo será criado" : ""}</td></tr>)}</Table></div>
      <Button loading={busy} disabled={!importable} onClick={confirm}>Confirmar importação ({importable})</Button>
      {kind === "MOVIMENTACOES" && <p className="text-xs text-slate-500">Movimentações importadas registram origem, responsável, data e horário. Linhas inválidas bloqueiam a confirmação.</p>}</>}
  </div></Modal>;
}
