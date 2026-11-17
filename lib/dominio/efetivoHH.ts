import { chaveFuncao, horasEntre, minutos } from "./calculos";
import { CAUSAS, type Causa, type Periodo, type StatusTurno } from "./tipos";

/**
 * Regra única de contagem do efetivo e do HH do turno (resumo, quadro, semana e RDO).
 * Simula pessoa a pessoa, minuto a minuto, a partir das linhas de efetivo e das ocorrências
 * (empréstimo, saída antes, parados), descontando o intervalo de refeição do turno.
 */

export type TipoOcorrencia = "emprestimo" | "saida" | "parado";
export type Ocorrencia = {
  id: string;
  responsavel_id: string | null;
  funcao: string;
  tipo: TipoOcorrencia;
  quantidade: number;
  hora_inicio: string;
  hora_fim: string | null;
  destino_responsavel_id: string | null;
  emprestimo_id: string | null;
  causa: Causa | null;
  /** Parada: observação, equipe aguardada (causa "Aguardando outra equipe"), foto e hora do aviso (ausentes = null). */
  observacao?: string | null;
  aguardando_responsavel_id?: string | null;
  foto_path?: string | null;
  avisado_em?: string | null;
  created_at: string;
};
export type Janela = { inicio: string; fim: string };
export type EntradaHH = {
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
  ocorrencias: Ocorrencia[];
  /** Já escolhida: real se completa, senão prevista. */
  janela: Janela | null;
  intervalo: Janela | null;
  /** "HH:MM": parada aberta conta até agora (telas ao vivo). Ausente = até o fim do turno (RDO, fechamento). */
  agora?: string;
};
export type Recebido = { emprestimo_id: string; de: string | null; funcao: string; quantidade: number; inicio: string; fim: string };
export type HHEquipe = {
  responsavel_id: string | null;
  pessoas: number;
  hhProdutivo: number | null;
  hhParado: number | null;
  hhParadoPorCausa: Partial<Record<Causa, number>>;
  recebidos: Recebido[];
  avisos: string[];
};
export type ResultadoHH = {
  equipes: HHEquipe[];
  pessoas: number;
  hh: number | null;
  hhProdutivo: number | null;
  hhParado: number | null;
  hhParadoPorCausa: Partial<Record<Causa, number>>;
  avisos: string[];
};

type JanelaTurno = {
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
};

export function janelaDoTurno(t: JanelaTurno): Janela | null {
  if (t.hora_inicio_real && t.hora_fim_real) return { inicio: t.hora_inicio_real, fim: t.hora_fim_real };
  if (t.hora_inicio_prevista && t.hora_fim_prevista) return { inicio: t.hora_inicio_prevista, fim: t.hora_fim_prevista };
  return null;
}

export function intervaloDoTurno(t: { intervalo_inicio?: string | null; intervalo_fim?: string | null }): Janela | null {
  return t.intervalo_inicio && t.intervalo_fim ? { inicio: t.intervalo_inicio, fim: t.intervalo_fim } : null;
}

export const horaCurta = (h: string) => h.slice(0, 5);

/** Ocorrências vindas do banco ou de uma foto (JSON): ausente = nenhuma; ordenadas por registro. */
export function lerOcorrencias(x: unknown): Ocorrencia[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((r: Record<string, unknown>) => ({
      id: String(r.id),
      responsavel_id: (r.responsavel_id as string | null) ?? null,
      funcao: String(r.funcao ?? ""),
      tipo: r.tipo as TipoOcorrencia,
      quantidade: Number(r.quantidade),
      hora_inicio: String(r.hora_inicio ?? ""),
      hora_fim: (r.hora_fim as string | null) ?? null,
      destino_responsavel_id: (r.destino_responsavel_id as string | null) ?? null,
      emprestimo_id: (r.emprestimo_id as string | null) ?? null,
      causa: (r.causa as Causa | null) ?? null,
      observacao: (r.observacao as string | null) ?? null,
      aguardando_responsavel_id: (r.aguardando_responsavel_id as string | null) ?? null,
      foto_path: (r.foto_path as string | null) ?? null,
      avisado_em: (r.avisado_em as string | null) ?? null,
      created_at: String(r.created_at ?? ""),
    }))
    .sort((a, b) => (a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at)));
}

type Pessoa = {
  /** Equipe (índice) dona de cada minuto do turno; -1 = não trabalhou. */
  dono: Int32Array;
  /** Causa do minuto parado (índice em CAUSAS_LISTA), -1 = produtivo. */
  parado: Int32Array;
  emprestimo: string | null;
  saiu: boolean;
};

const CAUSAS_LISTA = Object.keys(CAUSAS) as Causa[];
const NENHUM = -1;

export function calcularHH(e: EntradaHH): ResultadoHH {
  const inicio = e.janela ? minutos(e.janela.inicio) : null;
  const horas = e.janela ? horasEntre(e.janela.inicio, e.janela.fim) : null;
  const temJanela = inicio !== null && horas !== null;
  const D = temJanela ? Math.round(horas * 60) : 0;

  // Posição relativa ao início do turno; horário fora da janela vai para a ponta mais próxima.
  const rel = (h: string | null): number | null => {
    if (!temJanela || !h) return null;
    const m = minutos(h);
    if (m === null) return null;
    const r = (m - inicio + 1440) % 1440;
    if (r <= D) return r;
    return r > D + (1440 - D) / 2 ? 0 : D;
  };

  // Parada sem fim (aberta): até agora, se informado; senão até o fim do turno.
  const fimParado = (o: Ocorrencia): number => (o.hora_fim ? (rel(o.hora_fim) ?? 0) : e.agora ? (rel(e.agora) ?? D) : D);

  const almoco = new Uint8Array(D);
  if (temJanela && e.intervalo) {
    const a = minutos(e.intervalo.inicio);
    const dur = horasEntre(e.intervalo.inicio, e.intervalo.fim);
    if (a !== null && dur !== null) {
      const ini = (a - inicio + 1440) % 1440;
      for (let k = 0; k < Math.round(dur * 60); k++) {
        const m = (ini + k) % 1440;
        if (m < D) almoco[m] = 1;
      }
    }
  }

  // Equipes na ordem em que aparecem.
  const equipes: (string | null)[] = [];
  const indice = (id: string | null) => {
    let i = equipes.indexOf(id);
    if (i < 0) i = equipes.push(id) - 1;
    return i;
  };
  const pessoasPorEquipe = new Map<number, number>();
  const linhas = new Map<string, Pessoa[]>(); // equipe+função → pessoas
  const chave = (id: string | null, funcao: string) => `${id ?? ""}\u0000${chaveFuncao(funcao)}`;

  for (const l of e.efetivo) {
    const eq = indice(l.responsavel_id);
    pessoasPorEquipe.set(eq, (pessoasPorEquipe.get(eq) ?? 0) + l.quantidade);
    const k = chave(l.responsavel_id, l.funcao);
    const lista = linhas.get(k) ?? [];
    for (let n = 0; n < l.quantidade; n++) {
      lista.push({ dono: new Int32Array(D).fill(eq), parado: new Int32Array(D).fill(NENHUM), emprestimo: null, saiu: false });
    }
    linhas.set(k, lista);
  }

  const avisosPorEquipe = new Map<number, string[]>();
  const avisos: string[] = [];
  const avisar = (id: string | null, texto: string) => {
    const eq = indice(id);
    avisosPorEquipe.set(eq, [...(avisosPorEquipe.get(eq) ?? []), texto]);
    avisos.push(texto);
  };
  const recebidos = new Map<number, Recebido[]>();
  const porEmprestimo = new Map<string, Pessoa[]>();

  const ordenadas = [...e.ocorrencias].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
  );

  for (const o of ordenadas) {
    const doEmprestimo = o.emprestimo_id !== null;
    const grupo = doEmprestimo ? (porEmprestimo.get(o.emprestimo_id!) ?? []) : (linhas.get(chave(o.responsavel_id, o.funcao)) ?? []);
    const h1 = rel(o.hora_inicio) ?? 0;
    const onde = indice(o.responsavel_id);
    // Na origem é quem está nela naquele horário (quem voltou de um empréstimo conta de novo).
    const naOrigem = (p: Pessoa, a: number, b: number) => {
      if (a >= D) return true;
      for (let m = a; m < Math.min(b, D); m++) if (p.dono[m] === onde) return true;
      return false;
    };
    let elegiveis: Pessoa[];
    if (o.tipo === "emprestimo") elegiveis = doEmprestimo ? [] : grupo.filter((p) => !p.emprestimo && !p.saiu);
    else if (o.tipo === "saida") elegiveis = grupo.filter((p) => !p.saiu && (doEmprestimo || naOrigem(p, h1, h1 + 1)));
    else {
      const h2 = fimParado(o);
      const livres = doEmprestimo ? grupo : grupo.filter((p) => naOrigem(p, h1, h2));
      elegiveis = [...livres.filter((p) => !p.saiu), ...livres.filter((p) => p.saiu)];
    }
    const escolhidas = elegiveis.slice(0, o.quantidade);
    if (escolhidas.length < o.quantidade) {
      const tem = escolhidas.length;
      const texto =
        o.tipo === "emprestimo"
          ? `${o.funcao}: ${o.quantidade} emprestados, mas a linha tem ${tem}`
          : o.tipo === "saida"
            ? `${o.funcao}: ${o.quantidade} saíram antes, mas só ${tem} disponíveis`
            : `${o.funcao}: ${o.quantidade} parados, mas só ${tem} disponíveis`;
      avisar(o.responsavel_id, texto);
    }
    if (escolhidas.length === 0) continue;

    if (o.tipo === "emprestimo") {
      const destino = indice(o.destino_responsavel_id);
      const h2 = rel(o.hora_fim) ?? D;
      for (const p of escolhidas) {
        p.emprestimo = o.id;
        for (let m = h1; m < h2; m++) {
          if (p.dono[m] === NENHUM) continue;
          p.dono[m] = destino;
          // Parado registrado pela origem não vale para as horas que passaram ao destino.
          p.parado[m] = NENHUM;
        }
      }
      porEmprestimo.set(o.id, escolhidas);
      recebidos.set(destino, [
        ...(recebidos.get(destino) ?? []),
        {
          emprestimo_id: o.id,
          de: o.responsavel_id,
          funcao: o.funcao,
          quantidade: escolhidas.length,
          inicio: horaCurta(o.hora_inicio),
          fim: horaCurta(o.hora_fim ?? e.janela?.fim ?? ""),
        },
      ]);
    } else if (o.tipo === "saida") {
      for (const p of escolhidas) {
        p.saiu = true;
        for (let m = h1; m < D; m++) p.dono[m] = NENHUM;
      }
    } else {
      const h2 = fimParado(o);
      const causa = o.causa ? CAUSAS_LISTA.indexOf(o.causa) : CAUSAS_LISTA.indexOf("outro");
      for (const p of escolhidas) {
        for (let m = h1; m < h2; m++) if (p.dono[m] === onde && p.parado[m] === NENHUM) p.parado[m] = causa;
      }
    }
  }

  // Soma em minutos por equipe.
  const prod = new Map<number, number>();
  const par = new Map<number, Map<number, number>>();
  for (const lista of linhas.values()) {
    for (const p of lista) {
      for (let m = 0; m < D; m++) {
        const dono = p.dono[m];
        if (dono === NENHUM || almoco[m]) continue;
        if (p.parado[m] === NENHUM) prod.set(dono, (prod.get(dono) ?? 0) + 1);
        else {
          const c = par.get(dono) ?? new Map<number, number>();
          c.set(p.parado[m], (c.get(p.parado[m]) ?? 0) + 1);
          par.set(dono, c);
        }
      }
    }
  }

  const pessoas = [...pessoasPorEquipe.values()].reduce((s, n) => s + n, 0);
  const calcula = temJanela && pessoas > 0;
  const porCausa = (m: Map<number, number> | undefined) => {
    const r: Partial<Record<Causa, number>> = {};
    for (const [c, min] of m ?? []) r[CAUSAS_LISTA[c]] = min / 60;
    return r;
  };
  const totalCausas: Partial<Record<Causa, number>> = {};

  const resultado: HHEquipe[] = equipes.map((id, i) => {
    const causas = porCausa(par.get(i));
    for (const [c, h] of Object.entries(causas) as [Causa, number][]) totalCausas[c] = (totalCausas[c] ?? 0) + h;
    const parado = [...(par.get(i)?.values() ?? [])].reduce((s, n) => s + n, 0) / 60;
    return {
      responsavel_id: id,
      pessoas: pessoasPorEquipe.get(i) ?? 0,
      hhProdutivo: calcula ? (prod.get(i) ?? 0) / 60 : null,
      hhParado: calcula ? parado : null,
      hhParadoPorCausa: calcula ? causas : {},
      recebidos: recebidos.get(i) ?? [],
      avisos: avisosPorEquipe.get(i) ?? [],
    };
  });

  const hhProdutivo = calcula ? resultado.reduce((s, x) => s + (x.hhProdutivo ?? 0), 0) : null;
  const hhParado = calcula ? resultado.reduce((s, x) => s + (x.hhParado ?? 0), 0) : null;
  return {
    equipes: resultado,
    pessoas,
    hh: calcula ? hhProdutivo! + hhParado! : null,
    hhProdutivo,
    hhParado,
    hhParadoPorCausa: calcula ? totalCausas : {},
    avisos,
  };
}

export function descreverOcorrencia(o: Ocorrencia, nome: (id: string | null) => string): string {
  const q = o.quantidade;
  const ini = horaCurta(o.hora_inicio);
  if (o.tipo === "emprestimo") {
    const quando = o.hora_fim ? `de ${ini} até ${horaCurta(o.hora_fim)}` : `a partir de ${ini}`;
    return `${q} ${o.funcao} ${q === 1 ? "emprestado" : "emprestados"} → ${nome(o.destino_responsavel_id)} ${quando}`;
  }
  if (o.tipo === "saida") return `${q} ${q === 1 ? "saiu" : "saíram"} às ${ini}`;
  const aguardando = o.aguardando_responsavel_id ? ` (${nome(o.aguardando_responsavel_id)})` : "";
  const causa = o.causa ? ` · ${CAUSAS[o.causa]}${aguardando}` : "";
  const quando = o.hora_fim ? `${ini}–${horaCurta(o.hora_fim)}` : `desde ${ini}`;
  return `${q} ${q === 1 ? "parado" : "parados"} ${quando}${causa}`;
}

/** Nome da equipe para textos (RDO, quadro): null = "Sem responsável". */
export function nomeDaEquipe(responsaveis: { id: string; nome: string }[]): (id: string | null) => string {
  return (id) => (id === null ? "Sem responsável" : (responsaveis.find((r) => r.id === id)?.nome ?? "Responsável removido"));
}

/** Linha completa (com equipe e função) para relatórios: "Rita: 2 Montador emprestados → Ana a partir de 13:00". */
export function linhaOcorrencia(o: Ocorrencia, nome: (id: string | null) => string): string {
  const d = descreverOcorrencia(o, nome);
  const obs = o.observacao ? ` — ${o.observacao}` : "";
  return o.tipo === "emprestimo" ? `${nome(o.responsavel_id)}: ${d}` : `${nome(o.responsavel_id)} · ${o.funcao}: ${d}${obs}`;
}

/** Paradas ainda sem fim, na ordem de registro. */
export function paradasAbertas(ocorrencias: Ocorrencia[]): Ocorrencia[] {
  return lerOrdenadas(ocorrencias).filter((o) => o.tipo === "parado" && !o.hora_fim);
}

const lerOrdenadas = (xs: Ocorrencia[]) =>
  [...xs].sort((a, b) => (a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at)));

/**
 * "Agora" para a conta ao vivo de um turno: só no turno aberto de hoje (ou no noturno de ontem, de madrugada).
 * Turno esquecido aberto de outro dia conta as paradas abertas até o fim dele.
 */
export function agoraDoTurno(
  turno: { data: string; periodo: Periodo; status: StatusTurno },
  hoje: string,
  hora: string,
): string | undefined {
  if (turno.status === "fechado") return undefined;
  if (turno.data === hoje) return hora;
  const ontem = new Date(`${hoje}T12:00:00Z`);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  if (turno.periodo === "noturno" && turno.data === ontem.toISOString().slice(0, 10) && hora < "12:00") return hora;
  return undefined;
}

/** Fim sugerido ao fechar o turno com a parada aberta: fim do turno; se começou depois dele (ou sem horário), o início. */
export function fimPadraoParada(o: Ocorrencia, janela: Janela | null): string {
  const ini = horaCurta(o.hora_inicio);
  if (!janela) return ini;
  const j0 = minutos(janela.inicio);
  const m = minutos(ini);
  const dur = horasEntre(janela.inicio, janela.fim);
  if (j0 === null || m === null || dur === null) return ini;
  const pos = (m - j0 + 1440) % 1440;
  return pos > dur * 60 ? ini : horaCurta(janela.fim);
}

export type Terminado = { responsavel_id: string; terminou_em: string };

/** Terminados vindos do banco ou de uma foto (JSON): ausente = nenhum; ordem por horário. */
export function lerTerminados(x: unknown): Terminado[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((r: Record<string, unknown>) => ({ responsavel_id: String(r.responsavel_id), terminou_em: String(r.terminou_em ?? "") }))
    .sort((a, b) => a.terminou_em.localeCompare(b.terminou_em) || a.responsavel_id.localeCompare(b.responsavel_id));
}
