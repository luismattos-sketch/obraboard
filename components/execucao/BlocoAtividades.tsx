"use client";

import { textoEquipe } from "@/lib/dominio/equipePrevista";
import { textoHHExtra, textoMateriais } from "@/lib/dominio/extraApontamento";
import { qtdComUnidade } from "@/lib/dominio/plural";
import { Fragment, useCallback, useContext, useRef, useState } from "react";
import { Selo } from "@/components/ui/Selo";
import type { Atividade } from "@/lib/db/atividades";
import type { Resultado } from "@/lib/db/resultado";
import { tuplaExecucao } from "@/lib/dominio/assinatura";
import {
  mesmaExecucao,
  normalizarExecucao,
  notaDigitadoExecucao,
  textoConflitoExecucao,
  type ValoresExecucao,
} from "@/lib/dominio/conflito";
import { statusAtividade } from "@/lib/dominio/calculos";
import { parseNumero } from "@/lib/dominio/entrada";
import {
  CAUSAS,
  ROTULO_STATUS_ATIVIDADE,
  ROTULO_TIPO,
  type Causa,
  type DadosExecucao,
  type StatusAtividade,
  type Tom,
} from "@/lib/dominio/tipos";
import { camposAbertos } from "@/lib/dominio/cardCausa";
import { acumularSomado, perguntaConcluida, somarLancamento, textoSoma, textoTotal } from "@/lib/dominio/lancamento";
import { criarFila } from "./fila";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { ContextoSincronia, Sincronizar } from "./Sincronizar";
import { useAutoSalvar } from "./useAutoSalvar";

const TOM: Record<StatusAtividade, Tom> = { concluida: "sucesso", parcial: "alerta", nao_iniciada: "neutro" };
const botaoSecundario =
  "min-h-12 rounded-botao border border-operacional bg-superficie px-4 font-semibold text-primaria hover:bg-primaria-clara";
const campoBase =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional disabled:opacity-70";

const tuplaServidor = (a: Atividade) => tuplaExecucao(a.qtd_planejada, a.qtd_realizada, a.causa, a.observacao);

/** Edição local por atividade, válida só enquanto o servidor ainda mostra a versão de onde ela partiu. */
type Local = { base: string; qtd_realizada: number | null; causa: Causa | null; observacao: string | null };
export type MudarExecucao = (atividade: Atividade, local: Omit<Local, "base">) => void;

/**
 * Estado das atividades para validar o envio (causas pendentes): o que o usuário editou por cima
 * dos dados do servidor. Quando o servidor muda (revalidação), vale o servidor.
 */
export function useExecucaoLocal(atividades: Atividade[]): { lista: Atividade[]; mudar: MudarExecucao } {
  const [locais, setLocais] = useState<Record<string, Local>>({});
  const lista = atividades.map((a) => {
    const l = locais[a.id];
    if (!l || l.base !== JSON.stringify(tuplaServidor(a))) return a;
    return { ...a, qtd_realizada: l.qtd_realizada, causa: l.causa, observacao: l.observacao };
  });
  const mudar = useCallback<MudarExecucao>((a, local) => {
    setLocais((m) => ({ ...m, [a.id]: { base: JSON.stringify(tuplaServidor(a)), ...local } }));
  }, []);
  return { lista, mudar };
}

type Props = {
  atividades: Atividade[];
  somenteLeitura?: boolean;
  /** `esperado`: a execução como esta tela a viu/gravou por último (checagem otimista no servidor). */
  salvar: (atividadeId: string, dados: DadosExecucao, esperado: ValoresExecucao) => Promise<Resultado<ValoresExecucao>>;
  /** Avisa cada edição (ver useExecucaoLocal). */
  onMudar?: MudarExecucao;
  erros?: Record<string, string>;
  /** Agrupa por responsável: subtítulo antes da 1ª atividade de cada grupo (na ordem recebida). */
  grupoDe?: (a: Atividade) => string | null;
  /** Linha "lançado por você" / "lançado pelo campo — Nome" (null = nada). */
  autorDe?: (a: Atividade) => string | null;
  /** Botão "Remover" nas atividades que `podeRemover` aceitar. */
  remover?: (a: Atividade) => void;
  podeRemover?: (a: Atividade) => boolean;
};

export function BlocoAtividades({ atividades, somenteLeitura, salvar, onMudar, erros = {}, grupoDe, autorDe, remover, podeRemover }: Props) {
  return (
    <section aria-labelledby="titulo-atividades" className="flex flex-col gap-3">
      <h2 id="titulo-atividades" className="text-lg font-semibold text-primaria">Atividades</h2>
      {atividades.map((a, i) => (
        <Fragment key={a.id}>
        {grupoDe && (i === 0 || grupoDe(atividades[i - 1]) !== grupoDe(a)) && (
          <h3 className="mt-2 font-semibold text-texto">{grupoDe(a) ?? "Sem responsável"}</h3>
        )}
        <Sincronizar servidor={tuplaServidor(a)}>
          <ItemExecucao
            atividade={a}
            somenteLeitura={somenteLeitura}
            erro={erros[a.id]}
            salvar={salvar}
            onMudar={onMudar}
            autor={autorDe?.(a) ?? null}
            remover={!somenteLeitura && remover && podeRemover?.(a) ? () => remover(a) : undefined}
          />
        </Sincronizar>
        </Fragment>
      ))}
    </section>
  );
}

function ItemExecucao({
  atividade: a,
  somenteLeitura,
  erro,
  salvar,
  onMudar,
  autor,
  remover,
}: {
  atividade: Atividade;
  somenteLeitura?: boolean;
  erro?: string;
  salvar: Props["salvar"];
  onMudar?: MudarExecucao;
  autor?: string | null;
  remover?: () => void;
}) {
  const [texto, setTexto] = useState(a.qtd_realizada === null ? "" : String(a.qtd_realizada).replace(".", ","));
  const [causa, setCausa] = useState<Causa | "">(a.causa ?? "");
  const [obs, setObs] = useState(a.observacao ?? "");
  const [abriuCausa, setAbriuCausa] = useState(false);
  const [abriuObs, setAbriuObs] = useState(false);
  const [perguntando, setPerguntando] = useState(false);
  const [somando, setSomando] = useState(false);
  const [mais, setMais] = useState("");
  const [erroSoma, setErroSoma] = useState<string | null>(null);

  const qtd = texto.trim() === "" ? null : parseNumero(texto);
  const qtdInvalida = texto.trim() !== "" && qtd === null;
  const extra = a.tipo === "extra";
  // Extra não tem meta: o banco iguala o planejado ao que foi feito.
  const plan = extra ? (qtd !== null && qtd > 0 ? qtd : a.qtd_planejada) : a.qtd_planejada;
  const status = statusAtividade(plan, qtd);
  // Extra e adiantada não pedem causa (não contam no dia).
  const naoConcluida = !a.tipo && status !== "concluida";

  const sincronia = useContext(ContextoSincronia);
  // O que o banco tem segundo esta tela; em série para um salvamento lento não gerar conflito falso.
  const esperado = useRef<ValoresExecucao>({ qtd_realizada: a.qtd_realizada, causa: a.causa, observacao: a.observacao });
  const digitado = useRef<ValoresExecucao | null>(null);
  // Último valor veio de "+ Somar": quanto foi somado (o aviso de conflito fala do trecho, não do total).
  const somadoAgora = useRef<number | undefined>(undefined);
  const somadoNoEnvio = useRef<number | undefined>(undefined);
  // Envios que caíram sem resposta (podem ter sido gravados mesmo assim), no formato do banco.
  const semResposta = useRef<ValoresExecucao[]>([]);
  const [fila] = useState(criarFila);
  const estado = useAutoSalvar(
    async () => {
      if (qtdInvalida) return { ok: false as const, erro: "Digite um número válido" };
      const dados: ValoresExecucao = {
        qtd_realizada: qtd,
        causa: naoConcluida && causa ? causa : null,
        observacao: obs.trim() ? obs : null,
      };
      digitado.current = dados;
      somadoNoEnvio.current = somadoAgora.current;
      return fila(async () => {
        const enviar = async (base: ValoresExecucao) => {
          try {
            return await salvar(a.id, dados, base);
          } catch (e) {
            const n = normalizarExecucao(plan, dados);
            semResposta.current = [...semResposta.current.filter((d) => !mesmaExecucao(d, n)), n].slice(-5);
            throw e;
          }
        };
        let r = await enviar(esperado.current);
        // Um envio anterior sem resposta pode ter sido gravado: se o banco tem exatamente ele, não é
        // conflito — reenvia tomando-o como base (o servidor confere de novo, atomicamente).
        const atual = !r.ok ? (r.conflito?.atual as ValoresExecucao | undefined) : undefined;
        if (atual && semResposta.current.some((d) => mesmaExecucao(d, atual))) r = await enviar(atual);
        if (r.ok) {
          // Gravado: a próxima soma começa do zero (a menos que outra tenha vindo depois deste envio).
          if (somadoAgora.current === somadoNoEnvio.current) somadoAgora.current = undefined;
          esperado.current = r.dados;
          semResposta.current = [];
        }
        else if (r.conflito?.atual) return { ...r, erro: textoConflitoExecucao(r.conflito.atual as ValoresExecucao, dados, a.unidade, somadoNoEnvio.current) };
        return r;
      });
    },
    tuplaExecucao(plan, qtdInvalida ? texto : qtd, causa, obs),
  );
  const verAtual = () => {
    if (digitado.current) sincronia?.recarregar(notaDigitadoExecucao(digitado.current, somadoNoEnvio.current));
  };

  function atualizar(t: string, c: Causa | "", o: string) {
    setTexto(t);
    setCausa(c);
    setObs(o);
    const q = t.trim() === "" ? null : parseNumero(t);
    if (t.trim() !== "" && q === null) return;
    onMudar?.(a, { qtd_realizada: q, causa: c || null, observacao: o || null });
  }

  const aberto = camposAbertos({ naoConcluida, causa, obs, erro, abriuCausa, abriuObs });
  const meta = textoTotal(a.qtd_planejada);
  const pergunta = perguntando ? perguntaConcluida(qtd, a.qtd_planejada) : null;
  const maisNum = parseNumero(mais);
  const previa = !qtdInvalida && maisNum !== null && maisNum > 0 ? textoSoma(qtd ?? 0, maisNum) : null;

  function concluir() {
    fecharSoma();
    if (perguntaConcluida(qtd, a.qtd_planejada)) setPerguntando(true);
    else {
      somadoAgora.current = undefined;
      atualizar(meta, causa, obs);
    }
  }
  function fecharSoma() {
    setSomando(false);
    setMais("");
    setErroSoma(null);
  }
  function somar() {
    const r = somarLancamento(texto, mais);
    if (!r.ok) {
      setErroSoma(r.erro);
      return;
    }
    setPerguntando(false);
    somadoAgora.current = acumularSomado(somadoAgora.current, parseNumero(mais) ?? 0);
    atualizar(textoTotal(r.total), causa, obs);
    fecharSoma();
  }

  return (
    <div className="flex flex-col gap-3 rounded-cartao border border-borda bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{a.descricao}</p>
          {autor && <p className="text-sm text-texto-suave">{autor}</p>}
          {(a.local || !extra) && (
            <p className="text-sm text-texto-suave">
              {a.local ?? ""}
              {a.local && !extra ? " · " : ""}
              {extra ? "" : `Previsto: ${qtdComUnidade(a.qtd_planejada, a.unidade)}`}
              {!extra && a.meta_origem ? ` · ${a.meta_origem}` : ""}
            </p>
          )}
          {textoEquipe(a.equipe) && <p className="text-sm text-texto-suave">{textoEquipe(a.equipe)}</p>}
          {extra && a.solicitado_por && <p className="text-sm text-texto-suave">Pedido por: {a.solicitado_por}</p>}
          {extra && textoHHExtra(a) && <p className="text-sm text-texto-suave">{textoHHExtra(a)}</p>}
          {extra && textoMateriais(a.materiais) && <p className="text-sm text-texto-suave">Material: {textoMateriais(a.materiais)}</p>}
        </div>
        {/* Cor só depois de o banco confirmar: antes disso, cinza. */}
        <div className="flex flex-col items-end gap-1">
          {a.tipo && <Selo tom="info">{ROTULO_TIPO[a.tipo]}</Selo>}
          {!extra && (
            <Selo tom={estado.estado === "ocioso" || estado.estado === "salvo" ? TOM[status] : "neutro"}>
              {ROTULO_STATUS_ATIVIDADE[status]}
            </Selo>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <label htmlFor={`qtd-${a.id}`} className="text-sm font-medium">Total feito hoje ({a.unidade})</label>
          <input
            id={`qtd-${a.id}`}
            className={campoBase}
            inputMode="decimal"
            autoComplete="off"
            value={texto}
            disabled={somenteLeitura}
            aria-invalid={qtdInvalida || undefined}
            onChange={(e) => {
              setPerguntando(false);
              somadoAgora.current = undefined;
              atualizar(e.target.value, causa, obs);
            }}
          />
        </div>
        {pergunta ? (
          <div className="flex flex-wrap items-center gap-2 rounded-botao border border-alerta bg-alerta-clara p-3">
            <p className="font-medium text-texto">{pergunta}</p>
            <button
              type="button"
              className={botaoSecundario}
              onClick={() => {
                setPerguntando(false);
                somadoAgora.current = undefined;
                atualizar(meta, causa, obs);
              }}
            >
              Sim
            </button>
            <button type="button" className={botaoSecundario} onClick={() => setPerguntando(false)}>
              Não
            </button>
          </div>
        ) : (
          !somenteLeitura && (
            <div className="flex flex-wrap gap-2">
              {!somando && (
                <button type="button" className={botaoSecundario} onClick={() => setSomando(true)}>
                  + Somar
                </button>
              )}
              {!extra && naoConcluida && (
                <button
                  type="button"
                  aria-label={`Marcar como concluída: ${a.descricao}`}
                  className={botaoSecundario}
                  onClick={concluir}
                >
                  ✓ Concluída
                </button>
              )}
            </div>
          )
        )}
        {somando && (
          <div className="flex flex-col gap-2 rounded-botao border border-borda p-3">
            <label htmlFor={`mais-${a.id}`} className="text-sm font-medium">Quanto a mais?</label>
            <input
              id={`mais-${a.id}`}
              className={campoBase}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={mais}
              onChange={(e) => {
                setMais(e.target.value);
                setErroSoma(null);
              }}
            />
            {previa && <p className="text-sm text-texto">{`${previa} ${a.unidade}`}</p>}
            {erroSoma && <p className="text-sm text-perigo">{erroSoma}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botaoSecundario} onClick={somar}>Somar</button>
              <button type="button" className="min-h-12 px-2 text-texto-suave underline" onClick={fecharSoma}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {qtdInvalida && <p className="text-sm text-perigo">Digite um número válido</p>}

      {aberto.causa && (
        <div>
          <label htmlFor={`causa-${a.id}`} className="text-sm font-medium">Causa do não cumprimento</label>
          <select
            id={`causa-${a.id}`}
            className={campoBase}
            value={causa}
            disabled={somenteLeitura}
            onChange={(e) => atualizar(texto, e.target.value as Causa | "", obs)}
          >
            <option value="">Selecione…</option>
            {(Object.keys(CAUSAS) as Causa[]).map((k) => (
              <option key={k} value={k}>{CAUSAS[k]}</option>
            ))}
          </select>
        </div>
      )}
      {aberto.obs && (
        <div>
          <label htmlFor={`obs-${a.id}`} className="text-sm font-medium">Observação</label>
          <textarea
            id={`obs-${a.id}`}
            className={`${campoBase} py-2`}
            rows={2}
            maxLength={500}
            value={obs}
            disabled={somenteLeitura}
            onChange={(e) => atualizar(texto, causa, e.target.value)}
          />
        </div>
      )}
      {!somenteLeitura && (!aberto.causa && naoConcluida || !aberto.obs) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {naoConcluida && !aberto.causa && (
            <button type="button" className="min-h-11 text-left text-sm text-texto-suave underline" onClick={() => setAbriuCausa(true)}>
              Não vai dar para concluir? Informar causa
            </button>
          )}
          {!aberto.obs && (
            <button type="button" className="min-h-11 text-left text-sm text-texto-suave underline" onClick={() => setAbriuObs(true)}>
              + Observação
            </button>
          )}
        </div>
      )}
      {naoConcluida && erro && <p className="text-sm font-medium text-alerta-escura">{erro}</p>}
      {!somenteLeitura && <IndicadorSalvo {...estado} onVerAtual={verAtual} nota={sincronia?.nota} dica="salva sozinho" />}
      {remover && (
        <button type="button" className="self-start text-sm text-texto-suave underline" onClick={remover}>
          Remover
        </button>
      )}
    </div>
  );
}
