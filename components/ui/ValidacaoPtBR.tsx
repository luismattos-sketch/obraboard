"use client";

import { useEffect } from "react";

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Mensagem em português para a validação nativa (o navegador usa o idioma do aparelho: "Please fill out this field."). */
export function mensagemValidacao(v: ValidityState, el: { min?: string; max?: string; minLength?: number; maxLength?: number; type?: string }): string {
  if (v.valueMissing) return el.type === "checkbox" ? "Marque esta opção." : "Preencha este campo.";
  if (v.badInput) return "Digite um número válido.";
  if (v.typeMismatch) return el.type === "email" ? "Digite um e-mail válido." : "Valor inválido.";
  if (v.rangeUnderflow) return `O valor mínimo é ${el.min}.`;
  if (v.rangeOverflow) return `O valor máximo é ${el.max}.`;
  if (v.stepMismatch) return "Valor fora do passo permitido.";
  if (v.tooShort) return `Use pelo menos ${el.minLength} caracteres.`;
  if (v.tooLong) return `Use no máximo ${el.maxLength} caracteres.`;
  if (v.patternMismatch) return "Formato inválido.";
  return "";
}

export function ValidacaoPtBR() {
  useEffect(() => {
    const ehCampo = (t: EventTarget | null): t is Campo =>
      t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
    const invalido = (e: Event) => {
      if (!ehCampo(e.target)) return;
      const el = e.target;
      el.setCustomValidity("");
      const msg = mensagemValidacao(el.validity, el as HTMLInputElement);
      if (msg) el.setCustomValidity(msg);
    };
    const limpar = (e: Event) => {
      if (ehCampo(e.target)) e.target.setCustomValidity("");
    };
    document.addEventListener("invalid", invalido, true);
    document.addEventListener("input", limpar, true);
    document.addEventListener("change", limpar, true);
    return () => {
      document.removeEventListener("invalid", invalido, true);
      document.removeEventListener("input", limpar, true);
      document.removeEventListener("change", limpar, true);
    };
  }, []);
  return null;
}
