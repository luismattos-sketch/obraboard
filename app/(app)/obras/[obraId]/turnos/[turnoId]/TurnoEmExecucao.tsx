"use client";

import { equipePrevista } from "@/lib/dominio/equipePrevista";
import { BlocoAtividades, useExecucaoLocal } from "@/components/execucao/BlocoAtividades";
import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import { ordenarPorResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
import { BlocoHorario } from "@/components/execucao/BlocoHorario";
import { EditarIntervalo } from "@/components/execucao/EditarIntervalo";
import { ProvedorSalvamento, useRastreioSalvamento } from "@/components/execucao/rastreioSalvamento";
import { AvisoPendentes } from "@/components/execucao/AvisoPendentes";
import { useAtualizarAoVoltar } from "@/components/execucao/useAtualizarAoVoltar";
import { Aviso } from "@/components/ui/Aviso";
import type { Atividade } from "@/lib/db/atividades";
import type { Efetivo } from "@/lib/db/turnos";
import { errosDeCausa } from "@/lib/dominio/regras";
import { horaCurta } from "@/lib/dominio/formato";
import { ultimaAlteracao, ultimaAlteracaoEfetivo } from "@/lib/dominio/ultimaAlteracao";
import { ConfirmarFechamento } from "./AcoesTurno";
import { Botao } from "@/components/ui/Botao";
import { Recolhivel } from "@/components/ui/Recolhivel";
import { CausasPendentes } from "@/components/execucao/CausasPendentes";
import { PainelParadas } from "@/components/execucao/PainelParadas";
import { useOcorrencias } from "@/components/execucao/useOcorrencias";
import { agoraDoTurno, paradasAbertas } from "@/lib/dominio/efetivoHH";
import { hojeSaoPaulo, horaAgoraSaoPaulo } from "@/lib/dominio/entrada";
import type { Periodo } from "@/lib/dominio/tipos";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Iniciado, Janela, Ocorrencia, Terminado } from "@/lib/dominio/efetivoHH";
import { ForaDoDia, TEXTO_SEM_ADIANTAR_PLANEJADOR } from "@/components/execucao/ForaDoDia";
import { autorDoLancamento, podeRemoverPlanejador, SEM_OPCOES, type OpcoesPuxar } from "@/lib/dominio/foraDoDia";
import {
  corrigirEfetivo,
  corrigirExecucao,
  corrigirHorario,
  corrigirIntervalo,
  criarOcorrenciaAcao,
  encerrarParadaAcao,
  enviarFotoExtraAcao,
  enviarFotoParadaAcao,
  lancarExtraAcao,
  puxarDaSemanaAcao,
  removerForaDoDiaAcao,
  removerOcorrenciaAcao,
} from "./acoesExecucao";

type Props = {
  turnoId: string;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  atividades: Atividade[];
  efetivo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id" | "created_at" | "lancado_pelo_planejador">[];
  opcoesFuncao: string[];
  obraId: string;
  responsaveis: ResponsavelRef[];
  ocorrencias: Ocorrencia[];
  janela: Janela | null;
  intervalo: Janela | null;
  iniciados?: Iniciado[];
  terminados?: Terminado[];
  /** Para a mensagem do WhatsApp e o "agora" das paradas abertas. */
  contexto: { obra: string; data: string; periodo: Periodo; whatsapp: string | null };
  /** Caminho da foto da parada → URL assinada. */
  fotos: Record<string, string>;
  /** Adiantar / atrasada (todas as equipes). */
  opcoesPuxar?: OpcoesPuxar;
  /** Título, selo, Ver quadro, "?": o botão "Fechar turno" entra ao lado. */
  cabecalho: ReactNode;
  /** Abertos: paradas, O que falta, Resumo. */
  acompanhamento: ReactNode;
  /** Seções recolhidas depois de "Corrigir execução". */
  recolhidos: ReactNode;
};

/**
 * Turno em campo/enviado na visão do planejador. Dono do estado da execução para que o "Fechar turno"
 * do cabeçalho, as pendências no topo e "Corrigir execução" (recolhido) enxerguem a mesma lista.
 */
export function TurnoEmExecucao({
  turnoId,
  hora_inicio_real,
  hora_fim_real,
  atividades,
  efetivo,
  opcoesFuncao,
  obraId,
  responsaveis,
  ocorrencias,
  janela,
  intervalo,
  iniciados,
  terminados,
  contexto,
  fotos,
  opcoesPuxar = SEM_OPCOES,
  cabecalho,
  acompanhamento,
  recolhidos,
}: Props) {
  const agrupar = atividades.some((a) => a.responsavel_id !== null);
  const ordenadas = agrupar ? ordenarPorResponsavel(atividades, responsaveis) : atividades;
  const nomeDe = (id: string | null) => (id === null ? null : (responsaveis.find((r) => r.id === id)?.nome ?? "—"));
  const { ocupado, falhas, tentarTodos, registrar } = useRastreioSalvamento();
  useAtualizarAoVoltar(ocupado);
  const { lista, mudar } = useExecucaoLocal(atividades);
  const erros = errosDeCausa(lista);
  const pendentes = lista.filter((a) => erros[a.id]);
  // Cards só mostram o aviso de causa depois de tentar fechar.
  const [cobrado, setCobrado] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [corrigirAberto, setCorrigirAberto] = useState(false);
  const router = useRouter();
  const mov = useOcorrencias(
    ocorrencias,
    {
      criar: (id, d) => criarOcorrenciaAcao(turnoId, id, d),
      remover: (id) => removerOcorrenciaAcao(turnoId, id),
      encerrar: (id, hora) => encerrarParadaAcao(turnoId, id, hora),
      enviarFoto: (id, form) => enviarFotoParadaAcao(turnoId, id, form),
      atualizar: () => router.refresh(),
    },
    registrar,
  );
  const [agora, setAgora] = useState<string | undefined>(undefined);
  useEffect(() => {
    const tic = () => setAgora(agoraDoTurno({ data: contexto.data, periodo: contexto.periodo, status: "em_campo" }, hojeSaoPaulo(), horaAgoraSaoPaulo()));
    tic();
    const t = setInterval(tic, 60_000);
    return () => clearInterval(t);
  }, [contexto.data, contexto.periodo]);
  const nomeEquipe = (id: string | null) =>
    id === null ? "Sem responsável" : (responsaveis.find((x) => x.id === id)?.nome ?? "Responsável removido");
  const [erroRemover, setErroRemover] = useState<string | null>(null);
  async function removerLancamento(id: string) {
    if (!window.confirm("Remover este lançamento?")) return;
    setErroRemover(null);
    try {
      const r = await removerForaDoDiaAcao(turnoId, id);
      if (!r.ok) setErroRemover(r.erro);
      else router.refresh();
    } catch {
      setErroRemover("Sem conexão — tente de novo.");
    }
  }

  return (
    <ProvedorSalvamento registrar={registrar}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {cabecalho}
          {!fechando && (
            <Botao
              type="button"
              className="min-h-10 px-3 text-sm"
              disabled={ocupado}
              onClick={() => {
                if (pendentes.length > 0) setCobrado(true);
                setFechando(true);
              }}
            >
              {ocupado ? "Salvando…" : "Fechar turno"}
            </Botao>
          )}
        </div>
        <AvisoPendentes falhas={falhas} tentar={tentarTodos} />
        {fechando &&
          (pendentes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <CausasPendentes
                titulo="Antes de fechar, informe a causa em:"
                pendentes={pendentes}
                aoIr={() => {
                  setCobrado(true);
                  setCorrigirAberto(true);
                }}
              />
              <Botao type="button" variante="secundario" className="self-start" onClick={() => setFechando(false)}>
                Cancelar
              </Botao>
            </div>
          ) : (
            <ConfirmarFechamento
              turnoId={turnoId}
              salvando={ocupado}
              abertas={paradasAbertas(mov.lista)}
              janela={janela}
              nome={nomeEquipe}
              aoCancelar={() => setFechando(false)}
            />
          ))}
        {acompanhamento}
        <Recolhivel titulo="Corrigir execução" aberto={corrigirAberto} aoMudar={setCorrigirAberto}>
          <p className="text-sm text-texto-suave">As alterações são salvas automaticamente e atualizam o resumo.</p>
          <section aria-label="Corrigir execução" className="flex min-w-0 flex-col gap-6">
        <BlocoHorario
          inicio={horaCurta(hora_inicio_real)}
          fim={horaCurta(hora_fim_real)}
          salvar={(d) => corrigirHorario(turnoId, d)}
        />
        <EditarIntervalo
          rotulo="Intervalo de refeição"
          ajuda="Descontado do HH. Só deste turno; o padrão fica na página da obra. Vazio = sem intervalo."
          inicial={intervalo}
          salvar={(j) => corrigirIntervalo(turnoId, j)}
        />
        <PainelParadas
          responsavelId={null}
          planejador
          ocorrencias={mov.lista}
          nome={nomeEquipe}
          fotos={fotos}
          estadoFoto={mov.estadoFoto}
          contexto={contexto}
          funcoes={[]}
          destinos={responsaveis}
          criar={() => {}}
          encerrar={(id, hora) => void mov.encerrar(id, hora)}
          tentarFoto={mov.tentarFoto}
          anexarFoto={(id, f) => void mov.anexarFoto(id, f)}
        />
        {mov.erro && <Aviso tom="alerta">{mov.erro}</Aviso>}
        <BlocoAtividades
          atividades={ordenadas}
          grupoDe={agrupar ? (a) => nomeDe(a.responsavel_id) : undefined}
          salvar={(id, d, esperado) => corrigirExecucao(turnoId, id, d, esperado)}
          onMudar={mudar}
          erros={cobrado ? erros : {}}
          autorDe={(a) => {
            const ult = ultimaAlteracao(a, nomeEquipe);
            return [autorDoLancamento(a, nomeEquipe, null), ult && `Última alteração: ${ult}`].filter(Boolean).join(" · ") || null;
          }}
          podeRemover={podeRemoverPlanejador}
          remover={(a) => void removerLancamento(a.id)}
        />
        {erroRemover && <Aviso tom="perigo">{erroRemover}</Aviso>}
        <ForaDoDia
          adiantar={opcoesPuxar.adiantar}
          atrasadas={opcoesPuxar.atrasadas}
          funcoes={opcoesFuncao}
          responsaveis={responsaveis}
          textoSemAdiantar={TEXTO_SEM_ADIANTAR_PLANEJADOR}
          puxar={(id, modo) => puxarDaSemanaAcao(turnoId, id, modo)}
          lancarExtra={(d) => lancarExtraAcao(turnoId, d)}
          enviarFoto={(id, form) => enviarFotoExtraAcao(turnoId, id, form)}
          aoConcluir={() => router.refresh()}
        />
        <EfetivoPorEquipe
          obraId={obraId}
          previsto={equipePrevista(atividades)}
          responsaveis={responsaveis}
          efetivo={efetivo}
          opcoesFuncao={opcoesFuncao}
          equipesIniciais={[...new Set(atividades.map((a) => a.responsavel_id))]}
          salvar={(id, l, esperado) => corrigirEfetivo(turnoId, id, l, esperado)}
          notaDe={(id) => {
            const linhas = efetivo.flatMap((e) =>
              e.responsavel_id === id && e.created_at ? [{ created_at: e.created_at, lancado_pelo_planejador: e.lancado_pelo_planejador === true }] : [],
            );
            const ult = ultimaAlteracaoEfetivo(linhas, nomeEquipe(id));
            return ult && `Última alteração: ${ult}`;
          }}
          movimentacoes={{
            ocorrencias,
            janela,
            intervalo,
            iniciados,
            terminados,
            criar: (id, d) => criarOcorrenciaAcao(turnoId, id, d),
            remover: (id) => removerOcorrenciaAcao(turnoId, id),
            estado: mov,
            agora,
          }}
        />
          </section>
        </Recolhivel>
        {recolhidos}
      </div>
    </ProvedorSalvamento>
  );
}
