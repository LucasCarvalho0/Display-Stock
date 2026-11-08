"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { api, fmtD, today, useFetch } from "@/lib/api";
import { INV_STATUS } from "@/lib/labels";

export default function Inventario() {
  const router = useRouter(); const { data, loading, reload } = useFetch<any[]>("/api/inventory"); const { data: users } = useFetch<any[]>("/api/users"); const { data: me } = useFetch<any>("/api/auth/me");
  const [open, setOpen] = useState(false); const [f, setF] = useState({ referenceDate: today(), shift: "MANHA", responsibleId: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const dow = new Date(`${f.referenceDate}T12:00:00`).getDay(); const unusualDay = dow !== 1 && dow !== 5;
  const start = async () => { setBusy(true); setErr(""); try { const r = await api<{ id: string }>("/api/inventory", { method: "POST", json: { ...f, responsibleId: f.responsibleId || me.id } }); router.push(`/inventario/${r.id}`); } catch (e: any) { setErr(e.message); reload(); } finally { setBusy(false); } };
  return <>
    <PageHeader title="Inventário" subtitle="Primeira versão: somente peças normais. O inventário de NG será uma etapa futura, sem misturar os controles." action={<Button onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" />INICIAR INVENTÁRIO</Button>} />
    <Card title="Histórico de inventários">{loading ? <Spinner /> : <Table head={["Código", "Data", "Turno inicial", "Responsável", "Divergências", "Status", ""]} empty={data?.length ? undefined : "Nenhum inventário realizado."}>
      {data?.map((s) => <tr key={s.id}><td className="font-mono text-xs">{s.code}</td><td>{fmtD(s.referenceDate)}</td><td>{s.startShift === "MANHA" ? "Manhã" : "Noite"}</td><td>{s.responsible.name}</td><td>{s._count.discrepancies}</td><td><Badge tone={INV_STATUS[s.status][1]}>{INV_STATUS[s.status][0]}</Badge></td><td><Link className="text-brand hover:underline" href={`/inventario/${s.id}`}>Abrir</Link></td></tr>)}</Table>}</Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Iniciar inventário">
      <div className="space-y-3">
        <Field label="Data"><Input type="date" value={f.referenceDate} onChange={(e) => setF({ ...f, referenceDate: e.target.value })} /></Field>
        {unusualDay && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">A rotina prevê inventário às segundas ou sextas-feiras. Você pode prosseguir em outro dia.</p>}
        <Field label="Turno"><Select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}><option value="MANHA">Manhã</option><option value="NOITE">Noite</option></Select></Field>
        <Field label="Responsável"><Select value={f.responsibleId || me?.id || ""} onChange={(e) => setF({ ...f, responsibleId: e.target.value })}>{users?.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        {err && <ErrorBox message={err} />}
        <Button loading={busy} onClick={start} className="w-full">Confirmar e carregar produtos normais</Button>
      </div></Modal>
  </>;
}
