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
  Select,
  Spinner,
  Table,
  useToast,
} from "@/components/ui";
import { api, useFetch } from "@/lib/api";
import { Info, ShieldAlert, Sparkles, UserCheck, Users as UsersIcon } from "lucide-react";

const SHIFT_OPTIONS = [
  { value: "MANHA", label: "1º Turno (1T - Manhã)", short: "1T (Manhã)", tone: "yellow" as const },
  { value: "NOITE", label: "2º Turno (2T - Noite)", short: "2T (Noite)", tone: "blue" as const },
  { value: "GERAL", label: "Geral (1T & 2T / Admin)", short: "Geral (1T & 2T)", tone: "green" as const },
];

export default function UsuariosPage() {
  const toast = useToast();
  const { data: users, reload } = useFetch<any[]>("/api/users");
  const { data: roles, reload: reloadRoles } = useFetch<any>("/api/roles");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    shift: "MANHA",
  });
  const [err, setErr] = useState("");

  const create = async () => {
    setErr("");
    try {
      await api("/api/users", { method: "POST", json: f });
      toast("Usuário cadastrado com sucesso! Ele deverá alterar a senha no 1º acesso.");
      setOpen(false);
      setF({ name: "", email: "", password: "", roleId: "", shift: "MANHA" });
      reload();
    } catch (e: any) {
      setErr(e.message || "Erro ao cadastrar usuário.");
    }
  };

  const patch = async (id: string, json: any) => {
    try {
      await api(`/api/users/${id}`, { method: "PATCH", json });
      toast("Registro atualizado.");
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const resetPw = async (u: any) => {
    const p = prompt(
      `Nova senha temporária para ${u.name} (mín. 10 caracteres, contendo maiúsculas, minúsculas e números):`
    );
    if (p) patch(u.id, { password: p });
  };

  const toggleP = async (role: any, key: string) => {
    const next = role.permissions.includes(key)
      ? role.permissions.filter((k: string) => k !== key)
      : [...role.permissions, key];
    try {
      await api(`/api/roles/${role.id}`, { method: "PUT", json: { permissions: next } });
      reloadRoles();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  if (!users || !roles) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Gestão de Usuários & Turnos"
        subtitle="Cadastro corporativo (@gruposese.com), controle de perfis (Administrador, Líder, Administrativo) e segregação por turnos (1T / 2T)"
        action={
          <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            <span>Novo Usuário</span>
          </Button>
        }
      />

      {/* BANNER DE REGRAS OPERACIONAIS DE TURNO */}
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-sky-600 p-1.5 text-white shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-xs leading-relaxed space-y-1">
            <div className="font-semibold text-sky-900 text-sm flex items-center gap-2">
              <span>Regra Operacional Sesé: Espelhamento &amp; Governança de Turnos</span>
            </div>
            <p className="text-slate-700">
              <strong className="text-slate-900">Lucas Conceição</strong> atua como{" "}
              <strong className="text-brand">Administrador Geral</strong>, com supervisão e
              permissão irrestrita de edição sobre todas as operações de ambos os turnos.
            </p>
            <p className="text-slate-700">
              Colaboradores cadastrados como <strong className="text-slate-900">Líder Operacional</strong>{" "}
              ou <strong className="text-slate-900">Administrativo</strong> no 1º Turno (1T) ou 2º Turno (2T)
              têm <strong className="text-emerald-700">espelhamento total para leitura</strong> de todo o estoque
              e histórico. Contudo, por segurança e conformidade IATF,{" "}
              <strong className="text-amber-800">um turno não pode alterar ou estornar lançamentos originados pelo outro turno</strong>.
            </p>
          </div>
        </div>
      </div>

      <Card title="Quadro de Colaboradores & Turnos">
        <Table head={["Colaborador", "E-mail Corporativo", "Perfil de Acesso", "Turno Operacional", "Status", "Ações"]}>
          {users.map((u) => {
            const shiftInfo = SHIFT_OPTIONS.find((s) => s.value === (u.shift || "GERAL")) || SHIFT_OPTIONS[2];
            const isLucas = u.email?.toLowerCase().includes("lucas.conceicao");

            return (
              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                <td>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {u.name}
                    {isLucas && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                        <Sparkles className="h-3 w-3" />
                        Admin Geral
                      </span>
                    )}
                  </div>
                </td>
                <td className="font-mono text-xs text-slate-600">{u.email}</td>
                <td>
                  <Select
                    value={u.role.id}
                    onChange={(e) => patch(u.id, { roleId: e.target.value })}
                    className="text-xs py-1 font-medium"
                  >
                    {roles.roles.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.shift || "GERAL"}
                      onChange={(e) => patch(u.id, { shift: e.target.value })}
                      className="text-xs py-1"
                    >
                      {SHIFT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </td>
                <td>
                  {u.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>}
                </td>
                <td className="space-x-3 whitespace-nowrap text-xs">
                  <button
                    className="text-brand font-medium hover:underline"
                    onClick={() => resetPw(u)}
                  >
                    Redefinir senha
                  </button>
                  <button
                    className="text-slate-500 hover:text-slate-700"
                    onClick={() => patch(u.id, { active: !u.active })}
                  >
                    {u.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Matriz de Permissões por Perfil" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2.5">Permissão do Sistema</th>
                {roles.roles.map((r: any) => (
                  <th key={r.id} className="px-3 py-2.5">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(roles.catalog).map(([k, d]) => (
                <tr key={k} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="py-2.5">
                    <span className="text-slate-800 font-medium">{d as string}</span>
                    <div className="font-mono text-xs text-slate-400">{k}</div>
                  </td>
                  {roles.roles.map((r: any) => (
                    <td key={r.id} className="px-3 text-center">
                      <input
                        type="checkbox"
                        checked={r.permissions.includes(k)}
                        onChange={() => toggleP(r, k)}
                        aria-label={`${r.name}: ${d}`}
                        className="h-4 w-4 rounded text-brand focus:ring-brand border-slate-300"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL NOVO USUÁRIO */}
      <Modal open={open} onClose={() => setOpen(false)} title="Cadastrar Novo Colaborador">
        <div className="space-y-4">
          <Field label="Nome Completo">
            <Input
              placeholder="Ex: João Silva"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>

          <Field label="E-mail Corporativo" hint="Recomendado: @gruposese.com">
            <Input
              type="email"
              placeholder="usuario@gruposese.com"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Perfil de Acesso">
              <Select value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
                <option value="">Selecione…</option>
                {roles.roles.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Turno Operacional">
              <Select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}>
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Senha Temporária de Acesso"
            hint="Mín. 10 caracteres, contendo letras maiúsculas, minúsculas e números."
          >
            <Input
              type="password"
              placeholder="Ex: Sese@Turno2026"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </Field>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800 mb-1">Nota de Operação de Turno:</p>
            <p>
              Ao logar com este e-mail e senha, o sistema identificará automaticamente o turno e
              perfil do usuário. As leituras e consultas de estoque são espelhadas para todos, mas
              edições ficam restritas ao respectivo turno.
            </p>
          </div>

          {err && <ErrorBox message={err} />}

          <Button onClick={create} className="w-full py-2.5">
            Cadastrar Usuário &amp; Liberar Acesso
          </Button>
        </div>
      </Modal>
    </>
  );
}
