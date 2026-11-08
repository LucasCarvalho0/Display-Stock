"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorBox, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
export default function ChangePassword() {
  const router = useRouter(); const [cur, setCur] = useState(""); const [nxt, setNxt] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/auth/password", { method: "POST", json: { current: cur, next: nxt } }); router.push("/dashboard"); router.refresh(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-4"><h1 className="font-semibold">Troque sua senha para continuar</h1>
    <Field label="Senha atual (temporária)"><Input type="password" required value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
    <Field label="Nova senha" hint="Mínimo 10 caracteres, com maiúsculas, minúsculas e números."><Input type="password" required value={nxt} onChange={(e) => setNxt(e.target.value)} /></Field>
    {err && <ErrorBox message={err} />}<Button type="submit" loading={busy} className="w-full">Salvar e entrar</Button></form>;
}
