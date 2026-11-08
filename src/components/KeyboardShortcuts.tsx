"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignorar atalhos de navegação globais se o foco estiver dentro de um campo de texto aberto
      // a menos que seja ESC ou teclas de função F1-F12
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // F2: Entrada de Peças
      if (e.key === "F2") {
        e.preventDefault();
        router.push("/entrada");
        return;
      }

      // F3: Saída de Peças
      if (e.key === "F3") {
        e.preventDefault();
        router.push("/saida");
        return;
      }

      // F4: Controle de Estoque
      if (e.key === "F4") {
        e.preventDefault();
        router.push("/estoque");
        return;
      }

      // F7: Inventário de Turno
      if (e.key === "F7") {
        e.preventDefault();
        router.push("/inventario");
        return;
      }

      // F8: Reporte Nissan
      if (e.key === "F8") {
        e.preventDefault();
        router.push("/reporte-nissan");
        return;
      }

      // F9: Dashboard Operacional
      if (e.key === "F9") {
        e.preventDefault();
        router.push("/dashboard");
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
