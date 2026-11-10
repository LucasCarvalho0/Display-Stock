"use client";
import { Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from "react";

export const Card = ({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {(title || action) && <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-navy-900">{title}</h2>{action}</header>}
    <div className="p-4">{children}</div>
  </section>
);
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning" | "indigo" | "purple" | "sky" | "ghost";
  loading?: boolean;
};
export const Button = ({ variant = "primary", loading, children, className = "", disabled, ...p }: BtnProps) => {
  const v = {
    primary: "bg-[#1E3F90] text-white hover:bg-[#152e6b] shadow-sm active:scale-[0.98]",
    secondary: "bg-slate-700 text-white hover:bg-slate-800 shadow-sm active:scale-[0.98]",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm active:scale-[0.98]",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-[0.98]",
    warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm active:scale-[0.98]",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-[0.98]",
    purple: "bg-purple-600 text-white hover:bg-purple-700 shadow-sm active:scale-[0.98]",
    sky: "bg-sky-600 text-white hover:bg-sky-700 shadow-sm active:scale-[0.98]",
    ghost: "text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 active:scale-[0.98]",
  }[variant];
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 select-none ${v} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};
const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100 min-h-[44px]";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className = "", ...p }, ref) => <input ref={ref} {...p} className={`${inputCls} ${className}`} />);
Input.displayName = "Input";
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className = "", ...p }, ref) => <select ref={ref} {...p} className={`${inputCls} ${className}`} />);
Select.displayName = "Select";
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = "", ...p }, ref) => <textarea ref={ref} {...p} className={`${inputCls} ${className}`} />);
Textarea.displayName = "Textarea";
export const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>{children}{hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}{error && <span className="mt-1 block text-xs text-red-600 font-medium">{error}</span>}</label>
);
const tones = { gray: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", yellow: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800" };
export type Tone = keyof typeof tones;
export const Badge = ({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
export const StatCard = ({ label, value, icon, tone = "blue" }: { label: string; value: ReactNode; icon: ReactNode; tone?: Tone }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</div>
    <div><div className="text-2xl font-bold text-navy-900">{value}</div><div className="text-xs text-slate-500 font-medium">{label}</div></div>
  </div>
);
export const Table = ({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) => (
  <div className="overflow-x-auto -mx-1 sm:mx-0"><table className="w-full text-left text-sm whitespace-nowrap lg:whitespace-normal"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500 bg-slate-50/50"><tr>{head.map((h, i) => <th key={i} className="px-3.5 py-3 font-semibold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100 [&_td]:px-3.5 [&_td]:py-3 font-medium">{children}</tbody></table>{empty && <p className="py-8 text-center text-sm text-slate-400">{empty}</p>}</div>
);
export const Spinner = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;
export const ErrorBox = ({ message }: { message: string }) => <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{message}</div>;
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs" onClick={onClose}>
    <div className={`w-full rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden ${wide ? "max-w-4xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b px-5 py-3.5 shrink-0 bg-slate-50/50"><h3 className="font-bold text-base text-navy-900">{title}</h3><button onClick={onClose} aria-label="Fechar" className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 min-w-[40px] min-h-[40px] flex items-center justify-center transition"><X className="h-5 w-5" /></button></div>
      <div className="p-5 overflow-y-auto flex-1">{children}</div></div></div>;
}
export const PageHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-navy-900">{title}</h1>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>{action}</div>
);
export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex items-center justify-between pt-3 text-sm text-slate-500"><span>{total} registro(s)</span>
    <div className="flex items-center gap-2"><Button variant="indigo" disabled={page <= 1} onClick={() => onChange(page - 1)} className="text-xs px-3 py-1.5 min-h-[36px]">Anterior</Button><span className="font-semibold text-slate-700">{page} / {pages}</span><Button variant="indigo" disabled={page >= pages} onClick={() => onChange(page + 1)} className="text-xs px-3 py-1.5 min-h-[36px]">Próxima</Button></div></div>;
}
// Toasts
const ToastCtx = createContext<(m: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; m: string; tone: string }[]>([]);
  const push = useCallback((m: string, tone: "ok" | "err" = "ok") => { const id = Date.now() + Math.random(); setItems((s) => [...s, { id, m, tone }]); setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5000); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="fixed bottom-4 right-4 z-[60] space-y-2">{items.map((t) => <div key={t.id} role="status" className={`max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.tone === "ok" ? "bg-emerald-600" : "bg-red-600"}`}>{t.m}</div>)}</div></ToastCtx.Provider>;
}
