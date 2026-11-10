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
  Pager,
  Select,
  Spinner,
  Table,
  Textarea,
  useToast,
} from "@/components/ui";
import { api, fmtDT, qs, useFetch } from "@/lib/api";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";

const TYPE: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

const SHIFT_LABELS: Record<string, { label: string; tone: "yellow" | "blue" | "green" }> = {
  MANHA: { label: "1T (Manhã)", tone: "yellow" },
  NOITE: { label: "2T (Noite)", tone: "blue" },
  GERAL: { label: "Geral", tone: "green" },
};

export default function Movimentacoes() {
  const [f, setF] = useState<any>({
    from: "",
    to: "",
    code: "",
    product: "",
    client: "",
    userId: "",
    type: "",
    classification: "",
    shift: "",
    page: 1,
  });
  const [sel, setSel] = useState<string | null>(null);

  const { data, error, loading, reload } = useFetch<any>(
    `/api/movements?${qs({ ...f, pageSize: 25 })}`
  );
  const { data: users } = useFetch<any[]>("/api/users");

  const set = (k: string, v: any) =>
    setF((s: any) => ({ ...s, [k]: v, page: k === "page" ? v : 1 }));

  return (
    <>
      <PageHeader
        title="Histórico de Movimentações"
        subtitle="Espelhamento completo entre 1º e 2º turno. Movimentações confirmadas têm integridade criptográfica e rastreabilidade por turno."
      />

      <Card>
        {/* FILTROS */}
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Field label="Data inicial">
            <Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} />
          </Field>
          <Field label="Data final">
            <Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} />
          </Field>
          <Field label="Turno de Operação">
            <Select value={f.shift} onChange={(e) => set("shift", e.target.value)}>
              <option value="">Todos os Turnos (Espelhamento)</option>
              <option value="MANHA">1º Turno (1T - Manhã)</option>
              <option value="NOITE">2º Turno (2T - Noite)</option>
              <option value="GERAL">Geral (Admin / Ambos)</option>
            </Select>
          </Field>
          <Field label="Operação">
            <Select value={f.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Código da Peça">
            <Input
              placeholder="Ex: 28021"
              value={f.code}
              onChange={(e) => set("code", e.target.value)}
            />
          </Field>
          <Field label="Descrição">
            <Input
              placeholder="Ex: DISPLAY A-IVI"
              value={f.product}
              onChange={(e) => set("product", e.target.value)}
            />
          </Field>
          <Field label="Colaborador">
            <Select value={f.userId} onChange={(e) => set("userId", e.target.value)}>
              <option value="">Todos os Colaboradores</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Classificação">
            <Select
              value={f.classification}
              onChange={(e) => set("classification", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="NORMAL">Normal</option>
              <option value="NG">NG</option>
            </Select>
          </Field>
        </div>

        {error && <ErrorBox message={error} />}

        {loading && !data ? (
          <Spinner />
        ) : data && (
          <>
            <Table
              head={["Nº Movimento", "Data/Hora", "Turno", "Código", "Operação", "Qtd", "Responsável", "Situação", "Ação"]}
              empty={data.rows.length ? undefined : "Nenhuma movimentação encontrada para os filtros aplicados."}
            >
              {data.rows.map((m: any) => {
                const shiftBadge = SHIFT_LABELS[m.shift] || SHIFT_LABELS.GERAL;

                return (
                  <tr
                    key={m.id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setSel(m.id)}
                  >
                    <td className="font-mono text-xs font-semibold text-brand">{m.number}</td>
                    <td className="text-xs text-slate-600">{fmtDT(m.occurredAt)}</td>
                    <td>
                      <Badge tone={shiftBadge.tone}>{shiftBadge.label}</Badge>
                    </td>
                    <td className="font-semibold text-slate-800">{m.product.code}</td>
                    <td>
                      <span
                        className={`font-semibold ${
                          m.type.startsWith("ENTRADA") || m.type === "AJUSTE_POSITIVO"
                            ? "text-emerald-700"
                            : "text-blue-700"
                        }`}
                      >
                        {TYPE[m.type]}
                      </span>
                    </td>
                    <td className="font-bold">{m.quantity}</td>
                    <td className="text-xs text-slate-700">{m.createdBy?.name || "Sistema"}</td>
                    <td>
                      {m.status === "ESTORNADA" ? (
                        <Badge tone="red">Estornada</Badge>
                      ) : (
                        <Badge tone="green">Ativa</Badge>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 font-bold text-xs inline-flex items-center gap-1 transition shadow-2xs active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSel(m.id);
                        }}
                      >
                        Auditar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={(p) => set("page", p)}
            />
          </>
        )}
      </Card>

      <Detail id={sel} onClose={() => setSel(null)} onChanged={reload} />
    </>
  );
}

function Detail({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: m, loading, reload } = useFetch<any>(id ? `/api/movements/${id}` : null);
  const { data: me } = useFetch<any>("/api/auth/me");
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [qty, setQty] = useState("");
  const [type, setType] = useState("");
  const [just, setJust] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Regra de bloqueio cruzado de turnos:
  // Administrador Geral tem permissão irrestrita.
  // Usuário de Turno 1 não pode corrigir registro de Turno 2, e vice-versa.
  const isDifferentShift =
    me?.role !== "Administrador" &&
    me?.shift !== "GERAL" &&
    m?.shift &&
    m?.shift !== me?.shift;

  const canCorrect =
    me?.permissions?.includes("movements.correct") &&
    m?.status === "ATIVA" &&
    !m?.type.startsWith("AJUSTE") &&
    !isDifferentShift;

  const send = async (v: boolean) => {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/movements/${m.id}/corrections`, {
        method: "POST",
        json: {
          justification: just,
          ...(v
            ? { void: true }
            : {
                quantity: qty ? Number(qty) : undefined,
                type: type && type !== m.type ? type : undefined,
              }),
        },
      });
      toast("Correção registrada com sucesso!");
      setEdit(false);
      setJust("");
      reload();
      onChanged();
    } catch (e: any) {
      setErr(e.message || "Erro ao registrar correção.");
    } finally {
      setBusy(false);
    }
  };

  const movShiftLabel =
    m?.shift === "MANHA" ? "1º Turno (Manhã)" : m?.shift === "NOITE" ? "2º Turno (Noite)" : "Geral";
  const userShiftLabel =
    me?.shift === "MANHA" ? "1º Turno (Manhã)" : me?.shift === "NOITE" ? "2º Turno (Noite)" : "Geral";

  return (
    <Modal open={!!id} onClose={onClose} title={m ? `Movimentação ${m.number}` : "Movimentação"} wide>
      {loading || !m ? (
        <Spinner />
      ) : (
        <div className="space-y-4 text-sm">
          {/* AVISO DE ESPELHAMENTO SE FOR DE OUTRO TURNO */}
          {isDifferentShift && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">
                  Espelhamento Ativo (Modo Somente Leitura)
                </p>
                <p className="mt-0.5 text-amber-900/90 leading-relaxed">
                  Este registro pertence ao <strong>{movShiftLabel}</strong> e seu usuário está alocado no{" "}
                  <strong>{userShiftLabel}</strong>. Você tem acesso completo para consultar todos os dados,
                  mas alterações e estornos são bloqueados entre turnos. Caso necessite retificar,
                  solicite a um operador do respectivo turno ou ao Administrador Geral (Lucas Conceição).
                </p>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {[
              ["Produto", `${m.product.code} — ${m.product.description}`],
              ["Cliente", m.product.client.name],
              ["Turno de Apontamento", movShiftLabel],
              ["Operação", TYPE[m.type]],
              ["Quantidade", m.quantity],
              ["Data/Hora", fmtDT(m.occurredAt)],
              ["Responsável", `${m.createdBy?.name || "Sistema"} (${m.createdBy?.shift || "Geral"})`],
              ["Situação", m.status],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-slate-500 font-medium">{k}</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>

          {m.note && (
            <div className="rounded-lg bg-slate-100/80 p-3 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Observações Operacionais:</span> {m.note}
            </div>
          )}

          <div>
            <h4 className="mb-2 font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <span>Histórico de Correções &amp; Auditoria</span>
            </h4>
            {m.revisions.length === 0 ? (
              <p className="text-slate-400 text-xs italic">Nenhuma correção registrada neste apontamento.</p>
            ) : (
              <Table head={["#", "Antes", "Depois", "Justificativa", "Responsável", "Quando"]}>
                {m.revisions.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.revisionNo}</td>
                    <td className="text-xs">
                      {r.previous.type} · {r.previous.quantity}
                    </td>
                    <td className="text-xs font-semibold">
                      {r.next.status === "ESTORNADA"
                        ? "ESTORNADA"
                        : `${r.next.type} · ${r.next.quantity}`}
                    </td>
                    <td className="text-xs">{r.justification}</td>
                    <td className="text-xs">{r.revisedBy?.name || "Usuário"}</td>
                    <td className="text-xs text-slate-500">{fmtDT(r.revisedAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          {canCorrect && !edit && (
            <Button
              variant="secondary"
              onClick={() => {
                setEdit(true);
                setQty(String(m.quantity));
                setType(m.type);
              }}
            >
              Corrigir Movimentação
            </Button>
          )}

          {edit && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nova Quantidade">
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </Field>
                <Field label="Operação">
                  <Select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </Select>
                </Field>
              </div>

              <Field label="Justificativa Obrigatória (Auditoria IATF 16949)">
                <Textarea
                  rows={2}
                  placeholder="Informe o motivo formal da correção (ex: erro de digitação na etiqueta)..."
                  value={just}
                  onChange={(e) => setJust(e.target.value)}
                />
              </Field>

              {err && <ErrorBox message={err} />}

              <div className="flex gap-2 pt-1">
                <Button loading={busy} onClick={() => send(false)}>
                  Salvar Correção
                </Button>
                <Button variant="danger" loading={busy} onClick={() => send(true)}>
                  Estornar
                </Button>
                <Button variant="ghost" onClick={() => setEdit(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
