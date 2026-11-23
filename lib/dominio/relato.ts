// "Conte como foi o dia" (backlog 10.1+10.2): confere a resposta da IA contra as atividades do responsável,
// monta a prévia, no máximo 2 perguntas de botão e as gravações. Nunca aceita o que a IA inventou.
import type { ItemIA, RespostaIA } from "@/lib/ia/esquema";
import { statusAtividade } from "./calculos";
import { numeroBR } from "./formato";
import { CAUSAS, type AtividadeExec, type Causa, type DadosExecucao } from "./tipos";

export type AtividadeRelato = AtividadeExec & { unidade: string; local: string | null };

export type Pergunta =
  | { tipo: "atividade"; chave: string; texto: string; opcoes: { id: string; rotulo: string }[] }
  | { tipo: "causa"; chave: string; atividadeId: string; texto: string; opcoes: { causa: Causa; rotulo: string }[] }
  | { tipo: "modo"; chave: string; atividadeId: string; texto: string; somar: number; trocar: number }
  | { tipo: "quantidade"; chave: string; atividadeId: string; texto: string; tudo: number | null };

export type ItemPrevia = {
  /** Chave do item (base das chaves das perguntas dele). */
  chave: string;
  /** null enquanto a atividade é ambígua (pergunta "atividade"). */
  atividadeId: string | null;
  titulo: string;
  antes: DadosExecucao | null;
  /** Provisório enquanto há pergunta pendente (a resposta completa); null = nada muda ou atividade ambígua. */
  depois: DadosExecucao | null;
  linha: string;
  pendenteDe: string[];
  ia: ItemIA;
};

export type Previa = {
  itens: ItemPrevia[];
  perguntas: Pergunta[];
  faltas: string[];
  semCitar: string[];
  semNada: boolean;
  /** Fotografia das atividades citadas (para aplicarRespostas no navegador). */
  atividades: AtividadeRelato[];
};

export type Respostas = Record<string, string | number>;

const MAX_PERGUNTAS = 2;
const QTD_MAX = 1e9;
const OBS_MAX = 500;
const PRIORIDADE: Pergunta["tipo"][] = ["atividade", "causa", "modo", "quantidade"];
const COMPLETE = "complete no card";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const SINONIMOS: Record<string, string[]> = {
  m: ["m", "metro", "metros", "mt", "mts"],
  un: ["un", "und", "unidade", "unidades", "peca", "pecas", "pc", "pcs"],
  kg: ["kg", "quilo", "quilos", "kilo", "kilos"],
  m2: ["m2", "m²", "metro quadrado", "metros quadrados"],
  m3: ["m3", "m³", "metro cubico", "metros cubicos"],
};

function unidadeBate(dita: string, unidade: string): boolean {
  const d = simples(dita);
  const u = simples(unidade);
  if (d === u) return true;
  const grupo = Object.entries(SINONIMOS).find(([k, l]) => k === u || l.includes(u));
  return grupo ? grupo[1].includes(d) || grupo[0] === d : false;
}

export function codigosParaIA(atividades: AtividadeRelato[]): Map<string, AtividadeRelato> {
  return new Map(atividades.map((a, i) => [`A${i + 1}`, a]));
}

const tituloDe = (a: AtividadeRelato) => (a.local ? `${a.descricao} (${a.local})` : a.descricao);
const antesDe = (a: AtividadeRelato): DadosExecucao => ({ qtd_realizada: a.qtd_realizada, causa: a.causa, observacao: a.observacao });
const semCausa = (a: AtividadeRelato) => a.tipo === "extra" || a.tipo === "adiantada";
const concluidaCom = (a: AtividadeRelato, q: number | null) => a.tipo === "extra" ? false : statusAtividade(a.qtd_planejada, q) === "concluida";

type Avaliacao =
  | { tipo: "ok"; depois: DadosExecucao; perguntas: Pergunta[]; linha: string; aviso?: string }
  | { tipo: "falta"; motivo: string }
  | { tipo: "nada"; linha: string };

/** Uma atividade + o que a IA disse + respostas já dadas → depois, perguntas pendentes ou falta. */
function avaliar(ia: ItemIA, a: AtividadeRelato, chave: string, resp: Respostas): Avaliacao {
  const titulo = tituloDe(a);
  if (a.tipo !== "extra" && statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida") {
    return { tipo: "nada", linha: `${titulo} — já estava concluída` };
  }
  if (ia.unidade_dita && !unidadeBate(ia.unidade_dita, a.unidade)) {
    return { tipo: "falta", motivo: `${titulo}: unidade diferente (${ia.unidade_dita}, a atividade é em ${a.unidade}) — ${COMPLETE}` };
  }
  const perguntas: Pergunta[] = [];
  const feito = a.qtd_realizada ?? 0;
  let qtd: number | null = a.qtd_realizada;
  const temMotivo = ia.causa !== null || ia.causas_candidatas.length > 0 || ia.trecho !== null;

  if (ia.concluida && a.tipo !== "extra") {
    qtd = a.qtd_planejada;
  } else if (ia.quantidade !== null) {
    if (!(ia.quantidade > 0) || ia.quantidade > QTD_MAX) return { tipo: "falta", motivo: `${titulo}: quantidade inválida — ${COMPLETE}` };
    const q = r3(ia.quantidade);
    if (feito <= 0 || ia.modo === "total") qtd = q;
    else if (ia.modo === "a_mais") qtd = r3(feito + q);
    else {
      const k = `${chave}:modo`;
      const v = resp[k];
      if (v === "somar") qtd = r3(feito + q);
      else if (v === "trocar") qtd = q;
      else perguntas.push({ tipo: "modo", chave: k, atividadeId: a.id, texto: `${numeroBR(q)} ${a.unidade} a mais ou no total?`, somar: r3(feito + q), trocar: q });
    }
  } else if (!temMotivo) {
    const k = `${chave}:quantidade`;
    const v = resp[k];
    if (typeof v === "number" && v > 0 && v <= QTD_MAX) qtd = r3(v);
    else perguntas.push({ tipo: "quantidade", chave: k, atividadeId: a.id, texto: `Quanto de ${a.descricao}?`, tudo: a.tipo === "extra" ? null : a.qtd_planejada });
  }

  const concluida = qtd !== null && concluidaCom(a, qtd);
  let causa: Causa | null = a.causa;
  if (concluida || semCausa(a)) causa = concluida ? null : a.causa;
  else if (ia.causa) causa = ia.causa;
  else if (ia.causas_candidatas.length === 1) causa = ia.causas_candidatas[0];
  else if (ia.causas_candidatas.length >= 2) {
    const k = `${chave}:causa`;
    const v = resp[k];
    if (typeof v === "string" && v in CAUSAS) causa = v as Causa;
    else {
      const [c1, c2] = ia.causas_candidatas;
      const coisa = ia.coisa_da_causa?.trim();
      perguntas.push({
        tipo: "causa", chave: k, atividadeId: a.id,
        texto: coisa ? `${coisa[0].toUpperCase()}${coisa.slice(1)} é…` : "Qual foi a causa?",
        opcoes: [...new Set<Causa>([c1, c2, "outro"])].map((c) => ({ causa: c, rotulo: c === "outro" ? "Outra" : CAUSAS[c] })),
      });
    }
  }

  let observacao = a.observacao;
  let obsGrande = false;
  const trecho = ia.trecho?.trim();
  if (trecho && !(observacao ?? "").includes(trecho)) {
    const junta = observacao ? `${observacao} · ${trecho}` : trecho;
    if (junta.length > OBS_MAX) obsGrande = true;
    else observacao = junta;
  }

  const depois: DadosExecucao = { qtd_realizada: qtd, causa, observacao };
  const un = a.unidade;
  const de = a.tipo === "extra" ? "" : ` de ${numeroBR(a.qtd_planejada)} ${un}`;
  // Quantidade ainda depende de pergunta (somar/trocar ou quanto): mostra "?" em vez do valor antigo.
  const qtdPendente = perguntas.some((p) => p.tipo === "modo" || p.tipo === "quantidade");
  const situacao = a.tipo === "extra" || qtdPendente ? "" : qtd !== null && concluida ? " (concluída)" : qtd !== null && qtd > 0 ? " (parcial)" : "";
  let linha = `${titulo} — ${numeroBR(feito)} → ${qtd === null || qtdPendente ? "?" : numeroBR(qtd)} ${un}${de}${situacao}`;
  if (causa && causa !== a.causa) linha += ` · ${CAUSAS[causa]}`;
  const aviso = obsGrande ? `${titulo}: observação grande demais — ${COMPLETE}` : undefined;
  const igual = depois.qtd_realizada === a.qtd_realizada && depois.causa === a.causa && depois.observacao === a.observacao;
  if (igual && perguntas.length === 0) return aviso ? { tipo: "falta", motivo: aviso } : { tipo: "nada", linha: `${titulo} — sem mudança` };
  return { tipo: "ok", depois, perguntas, linha, aviso };
}

/** Motivo da falta de um item que precisaria de uma pergunta além do limite. */
function motivoSemPergunta(q: Pergunta, titulo: string): string {
  if (q.tipo === "quantidade") return `${titulo}: diga quanto foi feito — ${COMPLETE}`;
  if (q.tipo === "causa") return `${titulo}: escolha a causa — ${COMPLETE}`;
  if (q.tipo === "modo") return `${titulo}: diga o total feito hoje — ${COMPLETE}`;
  return `Não deu para saber qual atividade — ${COMPLETE}`;
}

export function conferirRelato(resposta: RespostaIA, atividades: AtividadeRelato[]): Previa {
  const codigos = codigosParaIA(atividades);
  const itens: ItemPrevia[] = [];
  const faltas: string[] = [];
  const citadas = new Set<string>();
  type Candidata = { item: number; q: Pergunta };
  const candidatas: Candidata[] = [];

  resposta.itens.forEach((ia, i) => {
    const chave = `i${i}`;
    const alvo = ia.atividade ? codigos.get(ia.atividade) : undefined;
    if (!alvo) {
      const opcoes = [...new Set(ia.candidatas)].map((c) => codigos.get(c)).filter((a): a is AtividadeRelato => !!a).slice(0, 3);
      if (opcoes.length >= 2) {
        opcoes.forEach((a) => citadas.add(a.id));
        const q: Pergunta = { tipo: "atividade", chave: `${chave}:atividade`, texto: "Qual atividade?", opcoes: opcoes.map((a) => ({ id: a.id, rotulo: tituloDe(a) })) };
        itens.push({ chave, atividadeId: null, titulo: "Qual atividade?", antes: null, depois: null, linha: "Qual atividade? Responda abaixo.", pendenteDe: [q.chave], ia });
        candidatas.push({ item: itens.length - 1, q });
        return;
      }
      const unica = opcoes[0];
      if (!unica) {
        faltas.push(`Não achei a atividade citada — ${COMPLETE}`);
        return;
      }
      ia = { ...ia, atividade: [...codigos.entries()].find(([, a]) => a === unica)![0] };
      return avaliarItem(ia, unica, chave);
    }
    avaliarItem(ia, alvo, chave);
  });

  function avaliarItem(ia: ItemIA, a: AtividadeRelato, chave: string) {
    citadas.add(a.id);
    const r = avaliar(ia, a, chave, {});
    if (r.tipo === "falta") return void faltas.push(r.motivo);
    const base = { chave, atividadeId: a.id, titulo: tituloDe(a), antes: antesDe(a), ia };
    if (r.tipo === "nada") return void itens.push({ ...base, depois: null, linha: r.linha, pendenteDe: [] });
    if (r.aviso) faltas.push(r.aviso);
    itens.push({ ...base, depois: r.depois, linha: r.linha, pendenteDe: r.perguntas.map((q) => q.chave) });
    for (const q of r.perguntas) candidatas.push({ item: itens.length - 1, q });
  }

  // Prioridade global; acima do limite, o item inteiro vira falta.
  const ordenadas = [...candidatas].sort((x, y) => PRIORIDADE.indexOf(x.q.tipo) - PRIORIDADE.indexOf(y.q.tipo) || x.item - y.item);
  const perguntas: Pergunta[] = [];
  const derrubados = new Set<number>();
  for (const c of ordenadas) {
    if (derrubados.has(c.item)) continue;
    if (perguntas.length < MAX_PERGUNTAS) perguntas.push(c.q);
    else {
      derrubados.add(c.item);
      faltas.push(motivoSemPergunta(c.q, itens[c.item].titulo));
    }
  }
  const mantidas = perguntas.filter((q) => !derrubados.has(candidatas.find((c) => c.q === q)!.item));
  const itensFinais = itens.filter((_, i) => !derrubados.has(i));

  const semCitar = atividades.filter((a) => !citadas.has(a.id)).map(tituloDe);
  const semNada = itensFinais.length === 0 && faltas.length === 0;
  const usadas = atividades.filter((a) => citadas.has(a.id));
  return { itens: itensFinais, perguntas: mantidas, faltas, semCitar: semNada ? [] : semCitar, semNada, atividades: usadas };
}

export function aplicarRespostas(
  previa: Previa,
  respostas: Respostas,
): { gravar: { atividadeId: string; dados: DadosExecucao; esperado: DadosExecucao }[]; faltam: string[] } {
  const porId = new Map(previa.atividades.map((a) => [a.id, a]));
  const perguntadas = new Set(previa.perguntas.map((q) => q.chave));
  const gravar: { atividadeId: string; dados: DadosExecucao; esperado: DadosExecucao }[] = [];
  const faltam: string[] = [];
  for (const item of previa.itens) {
    let id = item.atividadeId;
    if (id === null) {
      const v = respostas[`${item.chave}:atividade`];
      if (typeof v !== "string" || !porId.has(v)) {
        faltam.push(`${item.chave}:atividade`);
        continue;
      }
      id = v;
    }
    const a = porId.get(id);
    if (!a) continue;
    const r = avaliar(item.ia, a, item.chave, respostas);
    if (r.tipo !== "ok") continue;
    if (r.perguntas.length > 0) {
      // Pergunta que não estava na prévia (surgiu após escolher a atividade) não tem botão: fica para o card.
      faltam.push(...r.perguntas.map((q) => q.chave).filter((k) => perguntadas.has(k) || item.atividadeId === null));
      continue;
    }
    gravar.push({ atividadeId: id, dados: r.depois, esperado: antesDe(a) });
  }
  return { gravar, faltam };
}

/** Linha de cada item já com as respostas dadas (a prévia se atualiza ao tocar os botões). */
export function linhasComRespostas(previa: Previa, respostas: Respostas): Record<string, string> {
  const porId = new Map(previa.atividades.map((a) => [a.id, a]));
  const linhas: Record<string, string> = {};
  for (const item of previa.itens) {
    const escolhida = respostas[`${item.chave}:atividade`];
    const a = porId.get(item.atividadeId ?? (typeof escolhida === "string" ? escolhida : ""));
    const r = a ? avaliar(item.ia, a, item.chave, respostas) : null;
    linhas[item.chave] = r && r.tipo !== "falta" ? r.linha : item.linha;
  }
  return linhas;
}
