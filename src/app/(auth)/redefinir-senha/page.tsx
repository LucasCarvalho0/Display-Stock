"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ErrorBox, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
function Form() {
  const token = useSearchParams().get("token") ?? ""; const router = useRouter();
  const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/auth/reset", { method: "POST", json: { token, password: p } }); router.push("/login"); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-4"><h1 className="font-semibold">Definir nova senha</h1>
    <Field label="Nova senha" hint="Mínimo 10 caracteres, com maiúsculas, minúsculas e números."><Input type="password" required value={p} onChange={(e) => setP(e.target.value)} /></Field>
    {err && <ErrorBox message={err} />}<Button type="submit" loading={busy} className="w-full">Salvar senha</Button></form>;
}
export default function Page() { return <Suspense><Form /></Suspense>; }
