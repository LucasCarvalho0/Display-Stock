"use client";
import { useState } from "react";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Table, useToast } from "@/components/ui";
import { api, fmtDT, useFetch } from "@/lib/api";

export default function Configuracoes() {
  const toast = useToast(); const { data: me } = useFetch<any>("/api/auth/me"); const canAudit = me?.permissions.includes("settings.manage");
  const { data: audit } = useFetch<any[]>(canAudit ? "/api/audit" : null);
  const [cur, setCur] = useState(""); const [nxt, setNxt] = useState(""); const [err, setErr] = useState("");
  const change = async () => { setErr(""); try { await api("/api/auth/password", { method: "POST", json: { current: cur, next: nxt } }); toast("Senha alterada."); setCur(""); setNxt(""); } catch (e: any) { setErr(e.message); } };
  return <>
    <PageHeader title="Configurações" />
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Alterar minha senha"><div className="space-y-3"><Field label="Senha atual"><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field><Field label="Nova senha" hint="Mín. 10 caracteres, com maiúsculas, minúsculas e números."><Input type="password" value={nxt} onChange={(e) => setNxt(e.target.value)} /></Field>{err && <ErrorBox message={err} />}<Button onClick={change}>Salvar</Button></div></Card>
      <Card title="Sobre o sistema" className="lg:col-span-2"><ul className="space-y-1 text-sm text-slate-600"><li>Fuso horário de exibição: America/Sao_Paulo</li><li>Saldo = saldo inicial congelado + movimentações válidas após a data de corte (mesma regra da planilha)</li><li>Backups: veja <code>docs/README.md</code> → “Backup e recuperação”</li></ul></Card>
    </div>
    {canAudit && <Card title="Auditoria (últimos 200 eventos)" className="mt-4">{audit && <Table head={["Quando", "Usuário", "Ação", "Entidade"]}>{audit.map((a) => <tr key={a.id}><td>{fmtDT(a.createdAt)}</td><td>{a.user?.name ?? "—"}</td><td className="font-mono text-xs">{a.action}</td><td className="text-xs">{a.entity}</td></tr>)}</Table>}</Card>}
  </>;
}
