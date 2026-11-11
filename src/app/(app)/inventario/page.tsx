"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Badge, Button, Card, ErrorBoundary, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table } from "@/components/ui";
import { api, fmtD, today, useFetch } from "@/lib/api";
import { INV_STATUS } from "@/lib/labels";

export default function Inventario() {
  const router = useRouter();
  const { data, loading, reload } = useFetch<any[]>("/api/inventory");
  const { data: users } = useFetch<any[]>("/api/users");
  const { data: me } = useFetch<any>("/api/auth/me");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ referenceDate: today(), shift: "MANHA", responsibleId: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.id && !f.responsibleId) {
      setF((prev) => ({ ...prev, responsibleId: me.id }));
    }
  }, [me?.id]);

  const dow = new Date(`${f.referenceDate}T12:00:00`).getDay();
  const unusualDay = dow !== 1 && dow !== 5;

  const start = async () => {
    const respId = f.responsibleId || me?.id || (users?.find((u) => u.active)?.id ?? "");
    if (!respId) {
      setErr("Selecione um responsável válido.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ id: string }>("/api/inventory", {
        method: "POST",
        json: { ...f, responsibleId: respId },
      });
      router.push(`/inventario/${r.id}`);
    } catch (e: any) {
      setErr(e.message ?? "Erro ao iniciar inventário. Tente novamente.");
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErrorBoundary>
      <PageHeader
        title="Inventário de Displays &amp; Cockpit"
        subtitle="Controle oficial por turno: Pallets Fechados (Almoxarifado) + Pré-Montagem (Bancada)"
        action={
          <Button variant="primary" onClick={() => setOpen(true)} className="py-3 px-5 text-sm font-bold shadow-md">
            <ClipboardCheck className="h-5 w-5" />
            INICIAR NOVO INVENTÁRIO
          </Button>
        }
      />
      <Card title="Histórico de inventários">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            head={["Código", "Data", "Turno Inicial", "Responsável", "Divergências", "Status", "Ação"]}
            empty={data?.length ? undefined : "Nenhum inventário realizado."}
          >
            {data?.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 transition">
                <td className="font-mono text-xs font-bold text-navy-900">{s.code}</td>
                <td>{fmtD(s.referenceDate)}</td>
                <td>
                  <span className="font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    {s.startShift === "MANHA" ? "Manhã" : "Noite"}
                  </span>
                </td>
                <td>{s.responsible?.name ?? "—"}</td>
                <td className="font-bold text-center">
                  {(s._count?.discrepancies ?? 0) > 0 ? (
                    <span className="text-red-600 font-mono font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {s._count.discrepancies}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-mono text-xs">0</span>
                  )}
                </td>
                <td>
                  <Badge tone={(INV_STATUS[s.status] ?? INV_STATUS["INICIADO"])[1]}>
                    {(INV_STATUS[s.status] ?? INV_STATUS["INICIADO"])[0]}
                  </Badge>
                </td>
                <td>
                  <Link
                    className="px-4 py-2 rounded-xl bg-[#1E3F90] hover:bg-blue-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95 transition min-h-[36px]"
                    href={`/inventario/${s.id}`}
                  >
                    <span>Abrir Inventário</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Iniciar Novo Inventário de Turno">
        <div className="space-y-4">
          <Field label="Data de Referência">
            <Input type="date" value={f.referenceDate} onChange={(e) => setF({ ...f, referenceDate: e.target.value })} />
          </Field>
          {unusualDay && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              A rotina prevê inventário preferencialmente às segundas ou sextas-feiras. Você pode prosseguir em outro dia normalmente.
            </p>
          )}
          <Field label="Turno Inicial">
            <Select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}>
              <option value="MANHA">Turno 1: Manhã</option>
              <option value="NOITE">Turno 2: Noite</option>
            </Select>
          </Field>
          <Field label="Responsável pelo Inventário">
            <Select
              value={f.responsibleId || me?.id || ""}
              onChange={(e) => setF({ ...f, responsibleId: e.target.value })}
            >
              {users
                ?.filter((u) => u.active)
                .map((u) => {
                  const roleName = typeof u.role === "object" ? u.role?.name : u.role || "Operador";
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({roleName})
                    </option>
                  );
                })}
            </Select>
          </Field>
          {err && <ErrorBox message={err} />}
          <Button variant="success" loading={busy} onClick={start} className="w-full py-3.5 text-base font-bold shadow-md">
            <ClipboardCheck className="h-5 w-5" />
            Iniciar Inventário e Abrir Contagem
          </Button>
        </div>
      </Modal>
    </ErrorBoundary>
  );
}
