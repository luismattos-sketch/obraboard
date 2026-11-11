import { falha, ok, type Resultado } from "@/lib/db/resultado";

export const ERRO_MOTIVO = "Informe o motivo da reabertura";
export const ERRO_MOTIVO_LONGO = "O motivo pode ter até 500 caracteres";
const MOTIVO_MIN = 3;
const MOTIVO_MAX = 500;

/** Motivo da reabertura: obrigatório, de 3 a 500 caracteres depois do trim (o banco confere de novo). */
export function validarMotivo(texto: unknown): Resultado<string> {
  const m = typeof texto === "string" ? texto.trim() : "";
  if (m.length < MOTIVO_MIN) return falha(ERRO_MOTIVO);
  if (m.length > MOTIVO_MAX) return falha(ERRO_MOTIVO_LONGO);
  return ok(m);
}

export type TipoEvento = "criado" | "liberado" | "novo_link" | "enviado" | "fechado" | "reaberto";

/** Um marco da linha do tempo do turno (registrado pelo banco). */
export type EventoTurno = {
  id: string;
  tipo: TipoEvento;
  em: string;
  atorTipo: "planejador" | "encarregado";
  atorNome: string | null;
  versao: number | null;
  motivo: string | null;
};

const ROTULOS: Record<TipoEvento, string> = {
  criado: "Turno criado",
  liberado: "Link liberado para o campo",
  novo_link: "Novo link gerado (o anterior parou de funcionar)",
  enviado: "Enviado pelo campo",
  fechado: "Fechado",
  reaberto: "Reaberto",
};

export function rotuloEvento(e: Pick<EventoTurno, "tipo" | "versao">): string {
  if (e.tipo === "fechado" && e.versao !== null) return `Fechado · RDO v${e.versao} emitido`;
  return ROTULOS[e.tipo];
}

export function rotuloAtor(e: Pick<EventoTurno, "atorTipo" | "atorNome">): string {
  if (e.atorTipo === "encarregado") return "Encarregado (link de campo)";
  return e.atorNome ?? "—";
}
