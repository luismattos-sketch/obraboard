"use client";

import { useContext, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import { aplicarRespostas, linhasComRespostas, type Pergunta, type Previa, type Respostas } from "@/lib/dominio/relato";
import { parseNumero } from "@/lib/dominio/entrada";
import { numeroBR } from "@/lib/dominio/formato";
import type { DadosExecucao } from "@/lib/dominio/tipos";
import type { Resultado } from "@/lib/db/resultado";
import { executarLancamento, type ResultadoItem } from "./lancarRelato";
import { ContextoSalvamento, type Registrar } from "./rastreioSalvamento";

const campo =
  "w-full rounded-botao border border-borda bg-superficie px-3 py-2 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";
const opcao = (marcada: boolean) =>
  `min-h-11 rounded-botao border px-3 text-sm font-semibold ${marcada ? "border-operacional bg-operacional text-white" : "border-borda bg-superficie text-texto"}`;

const TEXTO_RESULTADO = (r: ResultadoItem) => (r === "ok" ? "lançado ✓" : r === "mudou" ? "mudou desde a prévia — organize de novo" : r);

export function PreviaRelato({
  previa,
  respostas,
  resultados,
  responder,
}: {
  previa: Previa;
  respostas: Respostas;
  resultados: Record<string, ResultadoItem>;
  responder: (chave: string, valor: string | number | undefined) => void;
}) {
  const linhas = linhasComRespostas(previa, respostas);
  const { avisos } = aplicarRespostas(previa, respostas);
  if (previa.semNada) return <Aviso tom="neutro">Não achei nada para lançar — escreva o que foi feito.</Aviso>;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">A IA entendeu:</p>
      <ul className="flex flex-col gap-1 text-sm">
        {previa.itens.map((i) => (
          <li key={i.chave}>
            • {linhas[i.chave] ?? i.linha}
            {i.atividadeId && resultados[i.atividadeId] && (
              <span className={resultados[i.atividadeId] === "ok" ? " text-sucesso" : " text-perigo"}> — {TEXTO_RESULTADO(resultados[i.atividadeId])}</span>
            )}
          </li>
        ))}
        {previa.semCitar.map((t, i) => (
          <li key={`sc${i}`} className="text-texto-suave">• {t} — você não falou nada (fica como está)</li>
        ))}
      </ul>
      {previa.perguntas.map((q) => (
        <PerguntaRelato key={q.chave} q={q} valor={respostas[q.chave]} responder={responder} />
      ))}
      {previa.faltas.map((f, i) => (
        <p key={`f${i}`} className="text-sm text-alerta-escura">Falta: {f}</p>
      ))}
      {avisos.map((a, i) => (
        <p key={`a${i}`} className="text-sm text-alerta-escura">Não vai ser lançado: {a}</p>
      ))}
    </div>
  );
}

function PerguntaRelato({ q, valor, responder }: { q: Pergunta; valor: string | number | undefined; responder: (c: string, v: string | number | undefined) => void }) {
  const [digitado, setDigitado] = useState("");
  const botoes: { valor: string | number; rotulo: string }[] =
    q.tipo === "atividade" ? q.opcoes.map((o) => ({ valor: o.id, rotulo: o.rotulo }))
    : q.tipo === "causa" ? q.opcoes.map((o) => ({ valor: o.causa, rotulo: o.rotulo }))
    : q.tipo === "modo" ? [{ valor: "somar", rotulo: `Somar (${numeroBR(q.somar)})` }, { valor: "trocar", rotulo: `Trocar (${numeroBR(q.trocar)})` }]
    : q.tudo !== null ? [{ valor: q.tudo, rotulo: `Tudo (${numeroBR(q.tudo)})` }] : [];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{q.texto}</legend>
      <div className="flex flex-wrap gap-2">
        {botoes.map((b) => (
          <button key={String(b.valor)} type="button" aria-pressed={valor === b.valor} className={opcao(valor === b.valor)} onClick={() => responder(q.chave, b.valor)}>
            {b.rotulo}
          </button>
        ))}
        {q.tipo === "quantidade" && (
          <input
            inputMode="decimal"
            aria-label={q.texto}
            placeholder="Quantidade"
            className={`${campo} max-w-32`}
            value={digitado}
            onChange={(e) => {
              setDigitado(e.target.value);
              const n = parseNumero(e.target.value);
              responder(q.chave, n !== null && n > 0 ? n : undefined);
            }}
          />
        )}
      </div>
    </fieldset>
  );
}

type Fase = "editando" | "organizando" | "previa" | "lancando" | "lancado";

export function ContarDia({
  textoInicial,
  relatoIdInicial,
  organizar,
  salvar,
  marcarLancado,
  aoLancar,
}: {
  textoInicial: string;
  relatoIdInicial: string | null;
  organizar: (texto: string, relatoId: string | null) => Promise<Resultado<{ relatoId: string; previa: Previa }>>;
  salvar: (atividadeId: string, dados: DadosExecucao, esperado: DadosExecucao) => Promise<Resultado<ValoresExecucao>>;
  marcarLancado: (relatoId: string) => Promise<Resultado>;
  aoLancar: () => void;
}) {
  const registrarCtx = useContext(ContextoSalvamento);
  const registrar: Registrar = registrarCtx ?? (() => {});
  const [texto, setTexto] = useState(textoInicial);
  const [relatoId, setRelatoId] = useState(relatoIdInicial);
  const [fase, setFase] = useState<Fase>("editando");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [resultados, setResultados] = useState<Record<string, ResultadoItem>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function aoOrganizar() {
    if (!texto.trim()) return;
    setErro(null);
    setFase("organizando");
    try {
      const r = await organizar(texto, relatoId);
      if (!r.ok) {
        setErro(r.erro);
        setFase("editando");
        return;
      }
      setRelatoId(r.dados.relatoId);
      setPrevia(r.dados.previa);
      setRespostas({});
      setResultados({});
      setFase("previa");
    } catch {
      setErro("Não deu para organizar agora — tente de novo ou lance nos cards.");
      setFase("editando");
    }
  }

  const aplicado = previa ? aplicarRespostas(previa, respostas) : null;
  const pendentes = previa ? previa.perguntas.filter((q) => respostas[q.chave] === undefined).length : 0;
  const podeLancar = fase === "previa" && aplicado !== null && aplicado.gravar.length > 0 && pendentes === 0;

  async function aoLancarClique() {
    if (!aplicado || !relatoId) return;
    setFase("lancando");
    const r = await executarLancamento(aplicado.gravar, salvar, {
      registrar,
      esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      online: () => typeof navigator === "undefined" || navigator.onLine,
    });
    setResultados(r);
    void marcarLancado(relatoId).catch(() => {});
    aoLancar();
    if (aplicado.avisos.length === 0 && Object.values(r).every((x) => x === "ok")) {
      setTexto("");
      setRelatoId(null);
      setFase("lancado");
    } else setFase("previa");
  }

  return (
    <section aria-labelledby="titulo-contar-dia" className="flex flex-col gap-3 rounded-cartao border border-borda bg-superficie p-4">
      <h2 id="titulo-contar-dia" className="text-lg font-semibold text-primaria">Conte como foi o dia</h2>
      {(fase === "editando" || fase === "organizando" || fase === "lancado") && (
        <>
          {fase === "lancado" && <Aviso tom="sucesso">Lançado ✓ — confira nos cards abaixo.</Aviso>}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-texto-suave">Escreva do seu jeito o que foi feito e o que faltou. Dá para ditar pelo microfone do teclado.</span>
            <textarea
              className={campo}
              rows={3}
              maxLength={1000}
              placeholder="Ex.: fizemos 30 m de tubulação, faltou andaime"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (fase === "lancado") setFase("editando");
              }}
              disabled={fase === "organizando"}
            />
          </label>
          {erro && <Aviso tom="alerta">{erro}</Aviso>}
          <Botao type="button" variante="secundario" onClick={() => void aoOrganizar()} disabled={!texto.trim()} carregando={fase === "organizando"}>
            {fase === "organizando" ? "Organizando…" : "Organizar"}
          </Botao>
        </>
      )}
      {(fase === "previa" || fase === "lancando") && previa && (
        <>
          <PreviaRelato previa={previa} respostas={respostas} resultados={resultados} responder={(c, v) => setRespostas((m) => {
            const novo = { ...m };
            if (v === undefined) delete novo[c];
            else novo[c] = v;
            return novo;
          })} />
          <p className="text-xs text-texto-suave">Nada é gravado até você tocar em Lançar.</p>
          <div className="flex flex-wrap gap-2">
            {!previa.semNada && (
              <Botao type="button" onClick={() => void aoLancarClique()} disabled={!podeLancar} carregando={fase === "lancando"}>
                Lançar
              </Botao>
            )}
            <Botao type="button" variante="secundario" onClick={() => setFase("editando")} disabled={fase === "lancando"}>
              Corrigir texto
            </Botao>
          </div>
        </>
      )}
    </section>
  );
}
