"use client";

import { useContext, useRef, useState } from "react";
import { qtdComUnidade } from "@/lib/dominio/plural";
import { Aviso } from "@/components/ui/Aviso";
import type { Resultado } from "@/lib/db/resultado";
import { parseNumero } from "@/lib/dominio/entrada";
import { linhasParaEquipe } from "@/lib/dominio/equipePrevista";
import { validarExtra, type DadosExtra, type ModoPuxar, type OpcaoPuxar } from "@/lib/dominio/foraDoDia";
import { resumoDias } from "@/lib/dominio/programacao";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { EditorEquipe, LINHA_VAZIA, type LinhaEquipe } from "./EditorEquipe";
import { ContextoSalvamento } from "./rastreioSalvamento";
import { reduzirFoto } from "./reduzirFoto";
import { decidirRepeticao } from "./repeticao";

/** Botões "+ Adiantar atividade da semana", "Continuar atividade atrasada" e "+ Serviço extra (fora da programação)". */

export const TEXTO_SEM_ADIANTAR = "Nenhuma atividade sua para adiantar nesta semana. Fale com o planejador.";
export const TEXTO_SEM_ADIANTAR_PLANEJADOR = "Nenhuma atividade da semana para adiantar.";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";
const botao =
  "min-h-12 rounded-botao border border-operacional bg-superficie px-3 text-left font-semibold text-primaria hover:bg-primaria-clara";

export type FormExtra = { descricao: string; qtd: string; unidade: string; observacao: string; responsavel: string; equipe?: LinhaEquipe[] };

export const rotuloOpcao = (o: OpcaoPuxar) =>
  `${o.descricao} — ${resumoDias(o.dias)} — saldo ${qtdComUnidade(o.saldo, o.unidade)}`;

/** Formulário → dados do extra (mesma validação do servidor). */
export function montarExtra(f: FormExtra, id: string): Resultado<DadosExtra> {
  if (!f.qtd.trim()) return { ok: false, erro: "Informe a quantidade", campos: { qtd: "Informe a quantidade" } };
  const qtd = parseNumero(f.qtd);
  if (qtd === null) return { ok: false, erro: "Digite um número válido", campos: { qtd: "Digite um número válido" } };
  return validarExtra({ id, descricao: f.descricao, unidade: f.unidade, qtd, observacao: f.observacao, responsavel_id: f.responsavel || null, equipe: linhasParaEquipe(f.equipe ?? []) });
}

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const VAZIO: FormExtra = { descricao: "", qtd: "", unidade: "", observacao: "", responsavel: "", equipe: [LINHA_VAZIA] };

type Props = {
  adiantar: OpcaoPuxar[];
  atrasadas: OpcaoPuxar[];
  /** Só no planejador: escolher a equipe do extra. */
  responsaveis?: ResponsavelRef[];
  textoSemAdiantar?: string;
  /** Funções sugeridas para a equipe do extra. */
  funcoes?: string[];
  puxar: (programacaoAtividadeId: string, modo: ModoPuxar) => Promise<Resultado<unknown>>;
  lancarExtra: (d: DadosExtra) => Promise<Resultado<unknown>>;
  enviarFoto?: (atividadeId: string, form: FormData) => Promise<Resultado<unknown>>;
  /** Link do WhatsApp do planejador com a mensagem pronta (campo). */
  linkWhats?: (d: DadosExtra) => string;
  /** Pede ao servidor os dados novos (router.refresh). */
  aoConcluir: () => void;
  /** Estado inicial (testes). */
  abertoInicial?: Aberto;
};
type Aberto = null | ModoPuxar | "extra";

export function ForaDoDia({
  adiantar,
  atrasadas,
  responsaveis,
  textoSemAdiantar = TEXTO_SEM_ADIANTAR,
  funcoes = [],
  puxar,
  lancarExtra,
  enviarFoto,
  linkWhats,
  aoConcluir,
  abertoInicial = null,
}: Props) {
  const [aberto, setAberto] = useState<Aberto>(abertoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lancado, setLancado] = useState<DadosExtra | null>(null);
  const [f, setF] = useState<FormExtra>(VAZIO);
  const [foto, setFoto] = useState<File | null>(null);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  // Mesmo id em todas as tentativas do mesmo extra: reenviar após sinal fraco não duplica.
  const idExtra = useRef<string | null>(null);
  const registrar = useContext(ContextoSalvamento);

  async function executar(chave: string, fn: () => Promise<Resultado<unknown>>): Promise<Resultado<unknown>> {
    let falhas = 0;
    registrar?.(chave, "salvando");
    for (;;) {
      try {
        const r = await fn();
        registrar?.(chave, null);
        return r;
      } catch {
        const d = decidirRepeticao(falhas, online());
        falhas = d.falhas;
        await new Promise<void>((pronto) => {
          const t = setTimeout(pronto, d.emMs);
          registrar?.(chave, "falhou", () => {
            clearTimeout(t);
            pronto();
          });
        });
        registrar?.(chave, "salvando");
      }
    }
  }

  const abrir = (x: Aberto) => {
    setErro(null);
    setLancado(null);
    setAberto((atual) => (atual === x ? null : x));
  };

  async function escolher(o: OpcaoPuxar, modo: ModoPuxar) {
    setOcupado(true);
    setErro(null);
    const r = await executar(`puxar-${o.programacaoAtividadeId}`, () => puxar(o.programacaoAtividadeId, modo));
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    setAberto(null);
    aoConcluir();
  }

  async function enviarExtra() {
    idExtra.current ??= crypto.randomUUID();
    const m = montarExtra(f, idExtra.current);
    if (!m.ok) {
      setErrosCampo(m.campos ?? {});
      return setErro(m.erro);
    }
    setErrosCampo({});
    setErro(null);
    setOcupado(true);
    const d = m.dados;
    const r = await executar(`extra-${d.id}`, () => lancarExtra(d));
    if (!r.ok) {
      setOcupado(false);
      return setErro(r.erro);
    }
    if (foto && enviarFoto) {
      try {
        const blob = await reduzirFoto(foto);
        const form = new FormData();
        form.set("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        const rf = await executar(`extra-foto-${d.id}`, () => enviarFoto(d.id, form));
        if (!rf.ok) setErro(`Extra lançado, mas a foto não foi enviada: ${rf.erro}`);
      } catch {
        setErro("Extra lançado, mas não foi possível preparar a foto.");
      }
    }
    setOcupado(false);
    idExtra.current = null;
    setF(VAZIO);
    setFoto(null);
    setAberto(null);
    setLancado(d);
    aoConcluir();
  }

  const lista = (opcoes: OpcaoPuxar[], modo: ModoPuxar, vazio: string) => (
    <div className="flex flex-col gap-2 rounded-botao border border-borda p-3">
      {opcoes.length === 0 ? (
        <p className="text-sm text-texto-suave">{vazio}</p>
      ) : (
        <>
          <p className="text-sm text-texto-suave">
            {modo === "adiantar" ? "Toque na atividade para trazer para hoje:" : "Toque na atividade para continuar hoje:"}
          </p>
          {opcoes.map((o) => (
            <button key={o.programacaoAtividadeId} type="button" disabled={ocupado} className={botao} onClick={() => void escolher(o, modo)}>
              {rotuloOpcao(o)}
            </button>
          ))}
        </>
      )}
    </div>
  );

  return (
    <section aria-label="Fora da programação do dia" className="flex flex-col gap-2">
      <button type="button" className={botao} aria-expanded={aberto === "adiantar"} onClick={() => abrir("adiantar")}>
        + Adiantar atividade da semana
      </button>
      {aberto === "adiantar" && lista(adiantar, "adiantar", textoSemAdiantar)}
      {atrasadas.length > 0 && (
        <button type="button" className={botao} aria-expanded={aberto === "atrasada"} onClick={() => abrir("atrasada")}>
          Continuar atividade atrasada
        </button>
      )}
      {aberto === "atrasada" && lista(atrasadas, "atrasada", "")}
      <button type="button" className={botao} aria-expanded={aberto === "extra"} onClick={() => abrir("extra")}>
        + Serviço extra (fora da programação)
      </button>
      {aberto === "extra" && (
        <form
          className="flex flex-col gap-2 rounded-botao border border-borda p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void enviarExtra();
          }}
        >
          <label className="flex flex-col text-sm font-medium">
            Descrição
            <input className={campo} maxLength={200} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          </label>
          {errosCampo.descricao && <p className="text-sm text-perigo">{errosCampo.descricao}</p>}
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-sm font-medium">
              Quantidade feita
              <input className={campo} inputMode="decimal" autoComplete="off" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
            </label>
            <label className="flex w-28 flex-col text-sm font-medium">
              Unidade
              <input className={campo} maxLength={20} placeholder="un, m, m²" value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} />
            </label>
          </div>
          {(errosCampo.qtd || errosCampo.unidade) && <p className="text-sm text-perigo">{errosCampo.qtd ?? errosCampo.unidade}</p>}
          {responsaveis && (
            <label className="flex flex-col text-sm font-medium">
              Responsável
              <select className={campo} value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })}>
                <option value="">Sem responsável</option>
                {responsaveis.filter((r) => r.ativo).map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </label>
          )}
          <EditorEquipe linhas={f.equipe ?? [LINHA_VAZIA]} aoMudar={(equipe) => setF({ ...f, equipe })} sugestoes={funcoes} erro={errosCampo.equipe} legenda="Equipe (opcional)" />
          <label className="flex flex-col text-sm font-medium">
            Observação (opcional)
            <textarea className={`${campo} py-2`} rows={2} maxLength={500} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
          </label>
          {enviarFoto && (
            <label className="flex flex-col text-sm font-medium">
              📷 Foto (opcional)
              <input type="file" accept="image/*" capture="environment" className="text-base text-texto" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <button type="submit" disabled={ocupado} className={botao}>{ocupado ? "Salvando…" : "Lançar serviço extra"}</button>
        </form>
      )}
      {lancado && (
        <Aviso tom="sucesso">
          Serviço extra lançado.
          {linkWhats && (
            <>
              {" "}
              <a href={linkWhats(lancado)} target="_blank" rel="noreferrer" className="font-semibold underline">
                Avisar o planejador no WhatsApp
              </a>
            </>
          )}
        </Aviso>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </section>
  );
}
