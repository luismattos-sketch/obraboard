import { normalizarAtividade } from "@/lib/db/atividades";
import type { Clima, Efetivo, TurnoCompleto } from "@/lib/db/turnos";
import type { Periodo } from "@/lib/dominio/tipos";
import { dataHoraBrasilia } from "./formatar";

/** Linha de `rdo_versoes` como o app a lê. */
export type VersaoRdo = {
  id: string;
  turno_id: string;
  obra_id: string;
  numero: number;
  emitido_em: string;
  retroativa: boolean;
  formato: number;
  dados: unknown;
};

export class FormatoRdoDesconhecido extends Error {
  constructor(formato: number) {
    super(`Formato de foto do RDO desconhecido: ${formato}`);
    this.name = "FormatoRdoDesconhecido";
  }
}

/** Formato 1 da foto, montado por `public.foto_rdo` no banco. */
type FotoV1 = {
  obra: { id: string; empresa_id: string; nome: string; cliente: string | null; endereco: string | null };
  turno: {
    id: string; obra_id: string; data: string; periodo: Periodo;
    hora_inicio_prevista: string | null; hora_fim_prevista: string | null;
    hora_inicio_real: string | null; hora_fim_real: string | null;
    enviado_em: string | null; fechado_em: string | null;
  };
  atividades: Record<string, unknown>[];
  efetivo: Omit<Efetivo, "turno_id">[];
  clima: Omit<Clima, "turno_id">[];
};

/** Transforma a foto guardada nos dados que o PDF usa. Nunca adivinha formatos que não conhece. */
export function lerFoto(v: Pick<VersaoRdo, "formato" | "dados">): TurnoCompleto {
  if (v.formato !== 1) throw new FormatoRdoDesconhecido(v.formato);
  const f = v.dados as FotoV1;
  const turnoId = f.turno.id;
  return {
    ...f.turno,
    status: "fechado",
    token_hash: null,
    obra: { ...f.obra, created_at: "" },
    atividades: (f.atividades ?? [])
      .map((a) => normalizarAtividade({ ...a, turno_id: turnoId }))
      .sort((a, b) => a.ordem - b.ordem),
    efetivo: (f.efetivo ?? []).map((e) => ({ ...e, turno_id: turnoId })),
    clima: (f.clima ?? []).map((c) => ({ ...c, turno_id: turnoId })),
  };
}

/** Como o PDF se identifica: versão oficial ou prévia. */
export type Emissao =
  | { tipo: "oficial"; numero: number; emitidoEm: Date; retroativa: boolean; anterior?: { numero: number; emitidoEm: Date } }
  | { tipo: "rascunho"; geradoEm: Date };

export function emissaoDaVersao(v: VersaoRdo, anterior?: { numero: number; emitido_em: string }): Emissao {
  const base = { tipo: "oficial" as const, numero: v.numero, emitidoEm: new Date(v.emitido_em), retroativa: v.retroativa };
  return anterior ? { ...base, anterior: { numero: anterior.numero, emitidoEm: new Date(anterior.emitido_em) } } : base;
}

const BRASILIA = "(horário de Brasília)";

/** Textos do PDF: `destaque` no topo da 1ª página, `rodape` em todas. */
export function linhasEmissao(e: Emissao): { destaque: string; rodape: string } {
  if (e.tipo === "rascunho") {
    const gerado = `Gerado em ${dataHoraBrasilia(e.geradoEm)} ${BRASILIA}`;
    return { destaque: `Rascunho — não é o RDO oficial · ${gerado}`, rodape: `Rascunho · ${gerado}` };
  }
  const emitido = `Emitido em ${dataHoraBrasilia(e.emitidoEm)} ${BRASILIA}`;
  const substitui = e.anterior
    ? ` · substitui a versão ${e.anterior.numero}, emitida em ${dataHoraBrasilia(e.anterior.emitidoEm)}`
    : "";
  const retro = e.retroativa ? " · versão registrada retroativamente" : "";
  return {
    destaque: `RDO oficial · Versão ${e.numero}${substitui} · ${emitido}${retro}`,
    rodape: `Versão ${e.numero} · ${emitido}`,
  };
}
