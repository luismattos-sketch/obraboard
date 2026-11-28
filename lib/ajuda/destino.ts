// Para onde o botão "?" de cada tela leva no manual.
import { hrefPasso } from "./capitulos";
import type { SlugCapitulo } from "./tipos";

export type TelaAjuda =
  | "obras"
  | "lookahead"
  | "programacao"
  | "encerrar-semana"
  | "turno-planejado"
  | "turno-em-campo"
  | "turno-fechamento"
  | "rdos"
  | "analise"
  | "quadro";

const CAPITULO_DA_TELA: Record<TelaAjuda, SlugCapitulo> = {
  obras: "primeiros-passos",
  lookahead: "programar-semana",
  programacao: "programar-semana",
  "encerrar-semana": "encerrar-semana",
  "turno-planejado": "check-in",
  "turno-em-campo": "durante-o-turno",
  "turno-fechamento": "fechar-turno",
  rdos: "fechar-turno",
  analise: "encerrar-semana",
  quadro: "quadro-tv",
};

export const destinoAjuda = (tela: TelaAjuda): string => hrefPasso(CAPITULO_DA_TELA[tela]);

export function telaDoTurno(status: "planejado" | "em_campo" | "enviado" | "fechado"): TelaAjuda {
  if (status === "planejado") return "turno-planejado";
  if (status === "em_campo") return "turno-em-campo";
  return "turno-fechamento";
}
