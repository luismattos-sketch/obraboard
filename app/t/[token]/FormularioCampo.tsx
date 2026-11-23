"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { Atividade } from "@/lib/db/atividades";
import type { Clima, Efetivo } from "@/lib/db/turnos";
import { errosDeCausa } from "@/lib/dominio/regras";
import { horaCurta } from "@/lib/dominio/formato";
import type { Periodo, StatusTurno } from "@/lib/dominio/tipos";
import { agoraDoTurno, paradasAbertas, type Terminado } from "@/lib/dominio/efetivoHH";
import { hojeSaoPaulo, horaAgoraSaoPaulo } from "@/lib/dominio/entrada";
import { linkWhatsapp, mensagemTerminou } from "@/lib/dominio/whatsapp";
import { PainelParadas } from "@/components/execucao/PainelParadas";
import { BotaoTerminei } from "@/components/execucao/BotaoTerminei";
import { CausasPendentes } from "@/components/execucao/CausasPendentes";
import { ERRO_CAUSA_TERMINEI } from "@/lib/db/mensagens";
import { useOcorrencias } from "@/components/execucao/useOcorrencias";
import { useRouter } from "next/navigation";
import type { Janela, Ocorrencia } from "@/lib/dominio/efetivoHH";
import {
  criarOcorrencia,
  desfazerTerminou,
  encerrarParada,
  enviarFotoParada,
  enviarFotoExtra,
  enviarTurno,
  lancarExtra,
  marcarTerminou,
  puxarDaSemana,
  removerForaDoDia,
  limparClima,
  removerOcorrencia,
  salvarClima,
  salvarEfetivo,
  salvarExecucao,
  salvarHorarioReal,
  organizarRelato,
  lancarRelato,
} from "./acoes";
import { ContarDia } from "@/components/execucao/ContarDia";
import { ProvedorSalvamento, useRastreioSalvamento } from "@/components/execucao/rastreioSalvamento";
import { AvisoPendentes } from "@/components/execucao/AvisoPendentes";
import { useAtualizarAoVoltar } from "@/components/execucao/useAtualizarAoVoltar";
import { BlocoAtividades, useExecucaoLocal } from "@/components/execucao/BlocoAtividades";
import { BlocoClima } from "@/components/execucao/BlocoClima";
import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import { ordenarPorResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
import { BlocoHorario } from "@/components/execucao/BlocoHorario";
import { ForaDoDia } from "@/components/execucao/ForaDoDia";
import { SEM_OPCOES, type OpcoesPuxar } from "@/lib/dominio/foraDoDia";
import { mensagemExtra } from "@/lib/dominio/whatsapp";

export type DadosTurnoCampo = {
  status: StatusTurno;
  data: string;
  periodo: Periodo;
  obraNome: string;
  /** WhatsApp do planejador (null = escolher o contato). */
  whatsapp: string | null;
  terminados: Terminado[];
  /** Caminho da foto da parada → URL assinada. */
  fotos: Record<string, string>;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  atividades: Atividade[];
  efetivo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id">[];
  /** Efetivo de todas as equipes e todas as ocorrências do turno (conta de HH; a tela mostra só a equipe). */
  efetivoTodo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id">[];
  ocorrencias: Ocorrencia[];
  janela: Janela | null;
  intervalo: Janela | null;
  clima: Clima[];
};

export function FormularioCampo({
  token,
  turno,
  opcoesFuncao,
  responsaveis = [],
  responsavelId = null,
  opcoesPuxar = SEM_OPCOES,
  contarDia = null,
}: {
  token: string;
  turno: DadosTurnoCampo;
  opcoesFuncao: string[];
  responsaveis?: ResponsavelRef[];
  /** Adiantar / atrasada do responsável escolhido. */
  opcoesPuxar?: OpcoesPuxar;
  /** "Conte como foi o dia" (null = não mostra): texto guardado da rodada não lançada. */
  contarDia?: { texto: string; relatoId: string | null } | null;
  /** Responsável escolhido no link (null = "Ver tudo"): sem botão Enviar. */
  responsavelId?: string | null;
}) {
  const agrupar = responsavelId === null && turno.atividades.some((a) => a.responsavel_id !== null);
  const ordenadas = agrupar ? ordenarPorResponsavel(turno.atividades, responsaveis) : turno.atividades;
  const nomeDe = (id: string | null) => (id === null ? null : (responsaveis.find((r) => r.id === id)?.nome ?? "—"));
  const somenteLeitura = turno.status !== "em_campo" && turno.status !== "enviado";
  const { lista: atividades, mudar } = useExecucaoLocal(turno.atividades);
  const [status, setStatus] = useState<StatusTurno>(turno.status);
  const { ocupado: salvando, falhas, tentarTodos, registrar } = useRastreioSalvamento();
  useAtualizarAoVoltar(salvando);
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const mov = useOcorrencias(
    turno.ocorrencias,
    {
      criar: (id, d) => criarOcorrencia(token, d, id),
      remover: (id) => removerOcorrencia(token, id, responsavelId),
      encerrar: (id, hora) => encerrarParada(token, id, hora, responsavelId),
      enviarFoto: (id, form) => enviarFotoParada(token, id, responsavelId, form),
      atualizar: () => router.refresh(),
    },
    registrar,
  );
  // Conta ao vivo das paradas abertas: atualiza a cada minuto (só no navegador).
  const [agora, setAgora] = useState<string | undefined>(undefined);
  useEffect(() => {
    const tic = () => setAgora(agoraDoTurno({ data: turno.data, periodo: turno.periodo, status }, hojeSaoPaulo(), horaAgoraSaoPaulo()));
    tic();
    const t = setInterval(tic, 60_000);
    return () => clearInterval(t);
  }, [turno.data, turno.periodo, status]);
  const [terminouEm, setTerminouEm] = useState<string | null>(
    turno.terminados.find((x) => x.responsavel_id === responsavelId)?.terminou_em ?? null,
  );
  const [salvandoTerminei, setSalvandoTerminei] = useState(false);
  const [erroTerminei, setErroTerminei] = useState<string | null>(null);
  const abertas = paradasAbertas(mov.lista);
  const minhasAbertas = abertas.filter((o) => o.responsavel_id === responsavelId);
  const nomeEquipe = (id: string | null) =>
    id === null ? "Sem responsável" : (responsaveis.find((x) => x.id === id)?.nome ?? "Responsável removido");
  const contexto = { obra: turno.obraNome, data: turno.data, periodo: turno.periodo, whatsapp: turno.whatsapp };

  async function terminei(hora: string, encerrarAbertas: boolean) {
    if (responsavelId === null) return;
    setErroTerminei(null);
    setTerminouEm(hora);
    setSalvandoTerminei(true);
    if (encerrarAbertas) for (const o of minhasAbertas) void mov.encerrar(o.id, hora);
    try {
      const res = await marcarTerminou(token, responsavelId, hora);
      if (!res.ok && res.erro === ERRO_CAUSA_TERMINEI) {
        // A tela achava que estava tudo certo (ex.: outro celular baixou a quantidade): relê e cobra.
        setTerminouEm(null);
        setCobrado(true);
        router.refresh();
      } else if (!res.ok) {
        setTerminouEm(null);
        setErroTerminei(res.erro);
      }
    } catch {
      setTerminouEm(null);
      setErroTerminei("Sem conexão — tente de novo.");
    } finally {
      setSalvandoTerminei(false);
    }
  }

  async function desfazer() {
    if (responsavelId === null) return;
    const antes = terminouEm;
    setErroTerminei(null);
    setTerminouEm(null);
    try {
      const res = await desfazerTerminou(token, responsavelId);
      if (!res.ok) {
        setTerminouEm(antes);
        setErroTerminei(res.erro);
      }
    } catch {
      setTerminouEm(antes);
      setErroTerminei("Sem conexão — tente de novo.");
    }
  }

  const [erroRemover, setErroRemover] = useState<string | null>(null);
  async function removerLancamento(id: string) {
    if (responsavelId === null || !window.confirm("Remover este lançamento?")) return;
    setErroRemover(null);
    try {
      const r = await removerForaDoDia(token, id, responsavelId);
      if (!r.ok) setErroRemover(r.erro);
      else router.refresh();
    } catch {
      setErroRemover("Sem conexão — tente de novo.");
    }
  }

  const erros = errosDeCausa(atividades);
  const pendentes = atividades.filter((a) => erros[a.id]);
  // Causa só é cobrada ao tocar Terminei / Enviar: antes disso, nada de aviso nos cards.
  const [cobrado, setCobrado] = useState(false);

  async function enviar() {
    if (pendentes.length > 0) {
      setCobrado(true);
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarTurno(token);
      if (r.ok) setStatus(r.dados.status);
      else setErroEnvio(r.erro);
    } catch {
      setErroEnvio("Sem conexão — tente enviar de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ProvedorSalvamento registrar={registrar}>
    <div className="flex flex-col gap-8">
      <AvisoPendentes falhas={falhas} tentar={tentarTodos} />
      <BlocoHorario
        inicio={horaCurta(turno.hora_inicio_real)}
        fim={horaCurta(turno.hora_fim_real)}
        somenteLeitura={somenteLeitura}
        salvar={(d) => salvarHorarioReal(token, d)}
      />
      {turno.intervalo && (
        <p className="-mt-6 text-sm text-texto-suave">
          Intervalo: {turno.intervalo.inicio.slice(0, 5)}–{turno.intervalo.fim.slice(0, 5)} (descontado do HH)
        </p>
      )}
      <PainelParadas
        responsavelId={responsavelId}
        ocorrencias={mov.lista}
        nome={nomeEquipe}
        fotos={turno.fotos}
        estadoFoto={mov.estadoFoto}
        contexto={contexto}
        funcoes={[...new Set(turno.efetivo.map((e) => e.funcao))]}
        destinos={responsaveis}
        somenteLeitura={somenteLeitura || responsavelId === null}
        criar={(d, foto) => void mov.criar(responsavelId, d, foto)}
        encerrar={(id, hora) => void mov.encerrar(id, hora)}
        tentarFoto={mov.tentarFoto}
        anexarFoto={(id, f) => void mov.anexarFoto(id, f)}
      />
      {mov.erro && <Aviso tom="alerta">{mov.erro}</Aviso>}
      {contarDia && responsavelId !== null && !somenteLeitura && (
        <ContarDia
          textoInicial={contarDia.texto}
          relatoIdInicial={contarDia.relatoId}
          organizar={(t, id) => organizarRelato(token, responsavelId, t, id)}
          salvar={(id, d, esperado) => salvarExecucao(token, id, d, esperado, responsavelId)}
          marcarLancado={(id) => lancarRelato(token, responsavelId, id)}
          aoLancar={() => router.refresh()}
        />
      )}
      <BlocoAtividades
        atividades={ordenadas}
        grupoDe={agrupar ? (a) => nomeDe(a.responsavel_id) : undefined}
        somenteLeitura={somenteLeitura}
        salvar={(id, d, esperado) => salvarExecucao(token, id, d, esperado, responsavelId)}
        onMudar={mudar}
        erros={cobrado ? erros : {}}
        autorDe={(a) => (a.criada_por_id && a.criada_por_id === responsavelId ? "lançado por você" : a.criada_por_id ? `lançado pelo campo — ${nomeEquipe(a.criada_por_id)}` : null)}
        podeRemover={(a) => responsavelId !== null && a.criada_por_id === responsavelId}
        remover={(a) => void removerLancamento(a.id)}
      />
      {erroRemover && <Aviso tom="perigo">{erroRemover}</Aviso>}
      {!somenteLeitura && responsavelId !== null && (
        <ForaDoDia
          adiantar={opcoesPuxar.adiantar}
          atrasadas={opcoesPuxar.atrasadas}
          puxar={(id, modo) => puxarDaSemana(token, id, modo, responsavelId)}
          lancarExtra={(d) => lancarExtra(token, d, responsavelId)}
          enviarFoto={(id, form) => enviarFotoExtra(token, id, responsavelId, form)}
          linkWhats={(d) => linkWhatsapp(turno.whatsapp, mensagemExtra({ ...contexto, equipe: nomeEquipe(responsavelId), descricao: d.descricao, qtd: d.qtd, unidade: d.unidade }))}
          aoConcluir={() => router.refresh()}
        />
      )}
      <EfetivoPorEquipe
        obraId=""
        responsaveis={responsaveis}
        efetivo={turno.efetivo}
        opcoesFuncao={opcoesFuncao}
        somenteLeitura={somenteLeitura}
        adicionarEquipe={false}
        equipesIniciais={responsavelId !== null ? [responsavelId] : [...new Set(turno.atividades.map((a) => a.responsavel_id))]}
        salvar={(id, l, esperado) => salvarEfetivo(token, l, esperado, id)}
        movimentacoes={{
          ocorrencias: turno.ocorrencias,
          efetivoTodo: turno.efetivoTodo,
          janela: turno.janela,
          intervalo: turno.intervalo,
          criar: (id, d) => criarOcorrencia(token, d, id),
          remover: (id) => removerOcorrencia(token, id, responsavelId),
          atualizar: () => router.refresh(),
          estado: mov,
          agora,
        }}
      />
      <BlocoClima inicial={turno.clima} somenteLeitura={somenteLeitura} salvar={(d) => salvarClima(token, d)}
        limpar={(p) => limparClima(token, p)}
      />

      {!somenteLeitura && responsavelId !== null && (
        <section className="flex flex-col gap-2 pb-8">
          {cobrado && <CausasPendentes titulo="Antes de terminar, informe a causa em:" pendentes={pendentes} />}
          <BotaoTerminei
            terminouEm={terminouEm}
            abertasDaEquipe={minhasAbertas.length}
            marcar={(h, enc) => void terminei(h, enc)}
            desfazer={() => void desfazer()}
            salvando={salvandoTerminei || salvando}
            bloqueado={pendentes.length > 0}
            aoBloquear={() => setCobrado(true)}
            linkWhats={(hora) => linkWhatsapp(turno.whatsapp, mensagemTerminou({ ...contexto, equipe: nomeEquipe(responsavelId), hora }))}
          />
          {erroTerminei && <Aviso tom="perigo">{erroTerminei}</Aviso>}
        </section>
      )}
      {!somenteLeitura && responsavelId === null && (
        <section className="flex flex-col gap-3 pb-8">
          {cobrado && <CausasPendentes titulo="Antes de enviar, informe a causa em:" pendentes={pendentes} />}
          {abertas.length > 0 && <Aviso tom="alerta">Há parada sem fim; o planejador vai encerrar.</Aviso>}
          {erroEnvio && <Aviso tom="perigo">{erroEnvio}</Aviso>}
          {status === "enviado" && (
            <Aviso tom="sucesso">Turno enviado ✓ — você ainda pode corrigir até o planejador fechar</Aviso>
          )}
          <Botao type="button" onClick={enviar} disabled={salvando} carregando={enviando}>
            {salvando ? "Salvando…" : status === "enviado" ? "Reenviar turno" : "Enviar turno"}
          </Botao>
        </section>
      )}
    </div>
    </ProvedorSalvamento>
  );
}
