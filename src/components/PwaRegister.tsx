"use client";

import { useEffect, useState } from "react";
import { Download, MonitorSmartphone, X } from "lucide-react";

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Registrar o Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker ativo com escopo:", reg.scope);
        })
        .catch((err) => {
          console.warn("Falha ao registrar Service Worker do PWA:", err);
        });
    }

    // 2. Verificar se já está rodando como PWA instalado (Standalone)
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone)
    ) {
      setIsInstalled(true);
    }

    // 3. Capturar o evento do navegador para botão de instalação
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  // Se já estiver instalado ou o usuário dispensou o banner, não exibe
  if (isInstalled || !installPrompt || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Instalação do Aplicativo"
      className="fixed bottom-4 right-4 z-50 max-w-sm bg-navy-900 text-white p-4 rounded-2xl shadow-2xl border border-sky-500/30 flex items-center gap-3.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/30">
        <MonitorSmartphone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
          Instalar DISPLAY STOCK
        </h4>
        <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
          Instale o aplicativo em seu dispositivo para acesso rápido e direto.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-navy-950 font-bold rounded-lg text-xs flex items-center gap-1 transition shadow-xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Instalar</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-white rounded-md transition"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

