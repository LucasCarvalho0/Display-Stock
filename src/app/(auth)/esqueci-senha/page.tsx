"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, ErrorBox, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
export default function Forgot() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(""); try { const r = await api<{ message: string }>("/api/auth/forgot", { method: "POST", json: { email } }); setMsg(r.message); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-4"><h1 className="font-semibold">Recuperar senha</h1>
    <Field label="E-mail cadastrado"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    {err && <ErrorBox message={err} />}{msg && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
    <Button type="submit" loading={busy} className="w-full">Enviar instruções</Button><p className="text-center text-sm"><Link href="/login" className="text-brand">Voltar ao login</Link></p></form>;
}
