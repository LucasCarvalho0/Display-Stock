"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Boxes,
  Briefcase,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Radio,
  Server,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button, ErrorBox } from "@/components/ui";
import { api } from "@/lib/api";
import { loginSchema } from "@/server/validators";
import type { z } from "zod";

type FormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [activeProfileTab, setActiveProfileTab] = useState<"administrativo" | "lider">("administrativo");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "lucas.conceicao@gruposese.com",
      password: "",
    },
  });

  const selectPreset = (type: "administrativo" | "lider") => {
    setActiveProfileTab(type);
    if (type === "administrativo") {
      setValue("email", "lucas.conceicao@gruposese.com");
    } else {
      setValue("email", "lider1@suaempresa.com.br");
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    setServerError("");
    try {
      const res = await api<{ mustChangePassword: boolean }>("/api/auth/login", {
        method: "POST",
        json: data,
      });
      router.push(res.mustChangePassword ? "/trocar-senha" : "/dashboard");
      router.refresh();
    } catch (e: any) {
      setServerError(e.message || "Credenciais inválidas.");
    }
  });

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
      {/* PAINEL ESQUERDO: IDENTIDADE E FORMULÁRIO */}
      <div className="lg:w-7/12 p-6 md:p-10 flex flex-col justify-between">
        <div>
          {/* Topo da Identidade Industrial */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-slate-200 shrink-0 bg-[#1E3F90] flex items-center justify-center p-1">
                <img
                  src="/logo.jpg"
                  alt="Grupo Sesé"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base md:text-lg tracking-tight text-navy-900">
                    DISPLAY STOCK CONTROL
                  </span>
                  <span className="bg-blue-100 text-brand px-2 py-0.5 rounded text-xs font-semibold">
                    SESÉ
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                  Planta Resende • Setor Multimídia &amp; Cockpit (T1)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>OPERAÇÃO SESÉ ON-LINE</span>
            </div>
          </div>

          {/* Cabeçalho do Formulário */}
          <div className="mt-6 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-navy-900">
              Autenticação Segura de Turno
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Entre com suas credenciais corporativas autorizadas para inicializar operações de
              conferência e apontamento.
            </p>
          </div>

          {/* Seletor de Atalho de Perfil */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Perfil de Operação &amp; Acesso
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => selectPreset("administrativo")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  activeProfileTab === "administrativo"
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>Administrativo</span>
              </button>
              <button
                type="button"
                onClick={() => selectPreset("lider")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  activeProfileTab === "lider"
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>Líder Operacional</span>
              </button>
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="email">
                  E-mail Corporativo Autorizado
                </label>
                <span className="text-[11px] font-mono text-slate-400">SSO / LDAP SESÉ</span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu.email@empresa.com.br"
                  {...register("email")}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 text-sm rounded-lg border ${
                    errors.email ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
                  } focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="password">
                  Senha de Acesso Terminal
                </label>
                <Link
                  href="/esqueci-senha"
                  className="text-xs text-brand hover:underline font-medium"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha de rede"
                  {...register("password")}
                  className={`w-full pl-10 pr-10 py-2.5 bg-white text-slate-900 text-sm rounded-lg border ${
                    errors.password ? "border-red-500 ring-1 ring-red-500" : "border-slate-300"
                  } focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded text-brand focus:ring-brand border-slate-300 accent-brand"
                />
                <span className="text-xs text-slate-600">Lembrar credencial neste terminal</span>
              </label>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                <Radio className="h-3 w-3 text-emerald-600" />
                RFID / Coletor Ativo
              </span>
            </div>

            {serverError && <ErrorBox message={serverError} />}

            <div className="pt-2">
              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full py-3 bg-brand text-white hover:bg-brand-dark rounded-xl font-semibold text-sm shadow-md flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Entrar no Sistema (Autenticação Segura)</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Rodapé de Telemetria */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>TERMINAL: DSC-OP-RES-084</span>
          <span>SSL/TLS 1.3 SEGURO</span>
        </div>
      </div>

      {/* PAINEL DIREITO: MONITOR INDUSTRIAL E TELEMETRIA SESÉ */}
      <div className="lg:w-5/12 bg-navy-900 text-white p-8 md:p-10 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-navy-800">
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div>
              <span className="text-[11px] uppercase tracking-widest text-sky-400 font-semibold block">
                Plataforma Industrial
              </span>
              <span className="text-base font-bold text-white">Status da Operação</span>
            </div>
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-[#1E3F90] flex items-center justify-center p-1 border border-white/10 shadow-sm">
              <img src="/logo.jpg" alt="Logo Sesé" className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="space-y-4 my-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-emerald-400" />
                  Servidor Operacional
                </span>
                <span className="text-emerald-400 font-mono font-semibold">ONLINE</span>
              </div>
              <p className="text-sm font-semibold text-white">Gestão Sesé &amp; Sincronização Ativa</p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span>Rastreabilidade Sesé</span>
                <span className="text-sky-400 font-mono font-semibold">ATIVO</span>
              </div>
              <p className="text-sm font-semibold text-white">
                Inventário por Turno (Manhã / Noite)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                <span>Controle de Estoque</span>
                <span className="text-emerald-400 font-mono font-semibold">25 PRODUTOS</span>
              </div>
              <p className="text-sm font-semibold text-white">
                Separação Rigorosa Normal × Peças NG
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/40 text-xs text-sky-200">
            <div className="flex items-center gap-2 font-semibold text-sky-300 mb-1">
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
              <span>Conformidade Operacional IATF 16949</span>
            </div>
            <p className="text-sky-200/80 leading-relaxed text-[11px]">
              Toda entrada e saída de multimídia registra responsável, data e saldo com auditoria
              criptográfica permanente.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-slate-400">
          <p className="text-[11px] leading-relaxed">
            Operação Sesé Display Stock Control v1.0.0. Acesso restrito a colaboradores
            autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
