export type Tom = "neutro" | "info" | "sucesso" | "alerta" | "perigo";

export const classesTom: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-700",
  info: "bg-primaria-clara text-primaria",
  sucesso: "bg-sucesso-clara text-sucesso",
  alerta: "bg-alerta-clara text-alerta",
  perigo: "bg-perigo-clara text-perigo",
};
