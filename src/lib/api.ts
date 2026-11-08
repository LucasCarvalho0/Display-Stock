"use client";
import { useCallback, useEffect, useState } from "react";
export class ApiError extends Error { constructor(public code: string, message: string, public details?: any, public status = 0) { super(message); } }

export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, { ...rest, headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (res.status === 401 && !url.includes("/auth/login")) { window.location.href = "/login"; throw new ApiError("NAO_AUTENTICADO", "Sessão expirada."); }
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new ApiError(b.error?.code ?? "ERRO", b.error?.message ?? "Erro inesperado.", b.error?.details, res.status); }
  if (res.headers.get("content-type")?.includes("application/json")) return (await res.json()).data as T;
  return res as unknown as T;
}
export const qs = (o: Record<string, unknown>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v)); return p.toString(); };

export function useFetch<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(!!url);
  const load = useCallback(async () => { if (!url) return; setLoading(true); try { setData(await api<T>(url)); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); } }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}
export const fmtDT = (d: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(d));
export const fmtD = (d: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", dateStyle: "short" }).format(new Date(d));
export const fmtN = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR"));
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
