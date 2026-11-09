"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  anexarUtmEmUrl,
  dispararCtaClick,
  dispararPageView,
  dispararSignupStart,
} from "../lib/analytics";

const textosCtaLanding = new Set([
  "testar gratis",
  "testar gratis",
  "comecar gratis",
  "comecar gratis",
  "cadastre-se",
  "cadastrar",
  "conhecer o frentia",
  "ver como funciona",
  "saiba mais",
]);

export default function AnalyticsEvents() {
  const pathname = usePathname();
  const primeiroPageView = useRef(true);

  useEffect(() => {
    if (primeiroPageView.current) {
      primeiroPageView.current = false;
    } else {
      dispararPageView();
    }

    if (pathname === "/cadastro") {
      dispararSignupStart();
    }
  }, [pathname]);

  useEffect(() => {
    function tratarClique(evento: MouseEvent) {
      const alvo = evento.target;

      if (!(alvo instanceof Element)) {
        return;
      }

      const link = alvo.closest("a");

      if (!link) {
        return;
      }

      const href = link.getAttribute("href");

      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      if (href.startsWith("/") || href.startsWith(window.location.origin)) {
        link.setAttribute("href", anexarUtmEmUrl(href));
      }

      if (window.location.pathname !== "/") {
        return;
      }

      const textoOriginal = (link.textContent ?? "").replace(/\s+/g, " ").trim();
      const textoNormalizado = normalizarTexto(textoOriginal);
      const ehBotaoPrincipal =
        link.classList.contains("btn") || textosCtaLanding.has(textoNormalizado);

      if (!ehBotaoPrincipal) {
        return;
      }

      dispararCtaClick(textoOriginal);
    }

    document.addEventListener("click", tratarClique, true);

    return () => {
      document.removeEventListener("click", tratarClique, true);
    };
  }, []);

  return null;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
