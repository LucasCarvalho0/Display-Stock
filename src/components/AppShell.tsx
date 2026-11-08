"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Database,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageMinus,
  PackagePlus,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { ToastProvider } from "./ui";
import { api, fmtDT, useFetch } from "@/lib/api";

type U = { name: string; email: string; role: string; permissions: string[] };

const LOGISTICS_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/entrada", label: "Entrada de peças", icon: PackagePlus, perm: "movements.create" },
  { href: "/saida", label: "Saída de peças", icon: PackageMinus, perm: "movements.create" },
  { href: "/inventario", label: "Módulo de inventário", icon: ClipboardCheck },
  { href: "/movimentacoes", label: "Histórico de movimentações", icon: History },
  { href: "/produtos", label: "Cadastro de produtos", icon: Package },
  { href: "/reporte-nissan", label: "Reporte Nissan", icon: FileSpreadsheet },
];

const ADMIN_NAV = [
  { href: "/usuarios", label: "Usuários e permissões", icon: Users, perm: "users.manage" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppShell({ user, children }: { user: U; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const { data: dash } = useFetch<any>("/api/dashboard");

  const alerts: string[] = [];
  if (dash) {
    if (dash.cards.outOfStock > 0) alerts.push(`${dash.cards.outOfStock} produto(s) sem estoque`);
    if (dash.cards.belowMin > 0) alerts.push(`${dash.cards.belowMin} produto(s) abaixo do estoque mínimo`);
    for (const a of dash.inventory?.alerts ?? []) alerts.push(a.text);
  }

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  const hasPerm = (perm?: string) => !perm || user.permissions.includes(perm);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50 font-sans">
        {/* SIDEBAR */}
        <aside
          className={`${
            mobile ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl" : "hidden md:flex"
          } ${
            collapsed ? "w-20" : "w-64"
          } flex-col bg-navy-900 text-slate-300 transition-all duration-200 border-r border-navy-800`}
        >
          {/* Topo do Menu */}
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
                <Boxes className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="leading-tight">
                  <div className="text-sm font-bold text-white tracking-tight">DISPLAY STOCK</div>
                  <div className="text-[10px] text-sky-400 font-medium">NISSAN LOGISTICS</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-label="Alternar menu lateral"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navegação */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            <div>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Logística Interna
                </div>
              )}
              <nav className="space-y-1">
                {LOGISTICS_NAV.filter((n) => hasPerm(n.perm)).map((item) => {
                  const active = path.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobile(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand text-white shadow-sm"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Administração
                </div>
              )}
              <nav className="space-y-1">
                {ADMIN_NAV.filter((n) => hasPerm(n.perm)).map((item) => {
                  const active = path.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobile(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand text-white shadow-sm"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Footer do Menu / Gateway Telemetria */}
          {!collapsed && (
            <div className="p-3 bg-navy-950 border-t border-white/5 m-2 rounded-xl text-xs space-y-1 text-slate-400 font-mono">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>NISSAN ERP GATEWAY</span>
                <span className="text-sky-400 font-semibold">v2.4.0</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Banco de Dados Online</span>
              </div>
            </div>
          )}
        </aside>

        {mobile && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-xs"
            onClick={() => setMobile(false)}
          />
        )}

        {/* ÁREA PRINCIPAL */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* HEADER INDUSTRIAL */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobile(true)}
                aria-label="Abrir menu lateral"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm md:text-base text-navy-900 tracking-tight">
                    DISPLAY STOCK CONTROL
                  </span>
                  <span className="bg-slate-100 text-slate-700 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                    SESÉ OP
                  </span>
                </div>
                <div className="hidden sm:block text-xs text-slate-500">
                  Gestão Serializada de Peças Multimídia &amp; Displays · Cockpit 04
                </div>
              </div>
            </div>

            {/* TELEMETRIA & USUÁRIO */}
            <div className="flex items-center gap-3 md:gap-5 text-sm">
              {/* Relógio BRT */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span suppressHydrationWarning>
                  {mounted && now ? fmtDT(now) : "BRT Oficial"}
                </span>
              </div>

              {/* Alerta de divergência em inventário */}
              {dash?.inventory?.discrepancies > 0 && (
                <Link
                  href={`/inventario/${dash.inventory.id}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{dash.inventory.discrepancies} Divergência(s)</span>
                </Link>
              )}

              {/* Notificações */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen(!bellOpen)}
                  aria-label="Notificações operacionais"
                  className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <Bell className="h-5 w-5" />
                  {alerts.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                        Alertas Operacionais
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {alerts.length} pendência(s)
                      </span>
                    </div>
                    {alerts.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {alerts.map((msg, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-amber-50 text-amber-900 text-xs flex items-start gap-2 border border-amber-200"
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{msg}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Sem alertas pendentes no momento.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div className="h-6 w-px bg-slate-200" />

              {/* Usuário Logado */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center font-semibold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-right leading-tight">
                  <div className="font-semibold text-navy-900 text-xs">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{user.role}</div>
                </div>
              </div>

              {/* Sair */}
              <button
                onClick={logout}
                title="Sair do sistema"
                aria-label="Sair do sistema"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* CONTEÚDO PRINCIPAL */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
