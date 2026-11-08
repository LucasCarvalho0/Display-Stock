"use client";
import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table, useToast } from "@/components/ui";
import { api, fmtDT, useFetch } from "@/lib/api";

export default function Usuarios() {
  const toast = useToast(); const { data: users, reload } = useFetch<any[]>("/api/users"); const { data: roles, reload: reloadRoles } = useFetch<any>("/api/roles");
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: "", email: "", password: "", roleId: "" }); const [err, setErr] = useState("");
  const create = async () => { setErr(""); try { await api("/api/users", { method: "POST", json: f }); toast("Usuário criado. Ele deverá trocar a senha no primeiro acesso."); setOpen(false); setF({ name: "", email: "", password: "", roleId: "" }); reload(); } catch (e: any) { setErr(e.message); } };
  const patch = async (id: string, json: any) => { try { await api(`/api/users/${id}`, { method: "PATCH", json }); reload(); } catch (e: any) { toast(e.message, "err"); } };
  const resetPw = async (u: any) => { const p = prompt(`Nova senha temporária para ${u.name} (mín. 10 caracteres, maiúsculas, minúsculas e números):`); if (p) patch(u.id, { password: p }); };
  const toggleP = async (role: any, key: string) => { const next = role.permissions.includes(key) ? role.permissions.filter((k: string) => k !== key) : [...role.permissions, key]; try { await api(`/api/roles/${role.id}`, { method: "PUT", json: { permissions: next } }); reloadRoles(); } catch (e: any) { toast(e.message, "err"); } };
  if (!users || !roles) return <Spinner />;
  return <>
    <PageHeader title="Usuários" subtitle="Contas individuais e permissões por perfil (verificadas no servidor)" action={<Button onClick={() => setOpen(true)}>Novo usuário</Button>} />
    <Card title="Usuários"><Table head={["Nome", "E-mail", "Perfil", "Status", ""]}>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td>
      <td><Select value={u.role.id} onChange={(e) => patch(u.id, { roleId: e.target.value })}>{roles.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></td>
      <td>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td><td className="space-x-3 whitespace-nowrap text-xs"><button className="text-brand" onClick={() => resetPw(u)}>Redefinir senha</button><button className="text-slate-500" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? "Desativar" : "Ativar"}</button></td></tr>)}</Table></Card>
    <Card title="Perfis e permissões" className="mt-4"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Permissão</th>{roles.roles.map((r: any) => <th key={r.id} className="px-3">{r.name}</th>)}</tr></thead>
      <tbody>{Object.entries(roles.catalog).map(([k, d]) => <tr key={k} className="border-b last:border-0"><td className="py-2">{d as string}<div className="font-mono text-xs text-slate-400">{k}</div></td>{roles.roles.map((r: any) => <td key={r.id} className="px-3 text-center"><input type="checkbox" checked={r.permissions.includes(k)} onChange={() => toggleP(r, k)} aria-label={`${r.name}: ${d}`} /></td>)}</tr>)}</tbody></table></div></Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário"><div className="space-y-3">
      <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Perfil"><Select value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}><option value="">Selecione…</option>{roles.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
      <Field label="Senha temporária" hint="Mín. 10 caracteres, com maiúsculas, minúsculas e números."><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      {err && <ErrorBox message={err} />}<Button onClick={create} className="w-full">Criar usuário</Button></div></Modal>
  </>;
}
