import type { Tom } from "@/lib/dominio/tipos";

// Cores de status do manual da marca; a borda só aparece onde o componente usa border (Aviso).
export const classesTom: Record<Tom, string> = {
  neutro: "bg-fundo text-texto border-borda",
  info: "bg-primaria-clara text-primaria border-operacional",
  sucesso: "bg-sucesso-clara text-sucesso border-sucesso",
  alerta: "bg-alerta-clara text-alerta-escura border-alerta",
  perigo: "bg-perigo-clara text-perigo border-perigo",
};
