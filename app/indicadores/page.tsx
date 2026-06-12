"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import {
  GraficoBarras,
  GraficoLinha,
  GraficoRosca,
} from "../../components/IndicadoresCharts";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  getContextoAtual,
  sincronizarCadastroBaseRemoto,
} from "../../lib/cadastro-base";
import {
  calcularResumoIndicadores,
  formatarDuracao,
  formatarNumero,
  obterMotivoRestricao,
  restricaoAberta,
  type AtividadeIndicador,
  type DadosIndicadores,
  type MaoObraIndicador,
  type TurnoOperacaoIndicador,
} from "../../lib/indicadores";
import type { RestricaoHistorico } from "../../lib/operacao";
import { supabase } from "../../lib/supabase";
import type { AtividadeRecurso } from "../../lib/types";

type TipoVisao =
  | "turno-atual"
  | "turno-especifico"
  | "geral"
  | "periodo"
  | "hoje"
  | "7-dias"
  | "30-dias"
  | "mes";

const dadosVazios: DadosIndicadores = {
  atividades: [],
  maoObra: [],
  recursosPlanejados: [],
  restricoes: [],
  turnos: [],
};

const opcoesVisao: Array<{ valor: TipoVisao; rotulo: string }> = [
  { valor: "turno-atual", rotulo: "Turno atual" },
  { valor: "turno-especifico", rotulo: "Turno específico" },
  { valor: "geral", rotulo: "Geral da frente" },
  { valor: "periodo", rotulo: "Período personalizado" },
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7-dias", rotulo: "Últimos 7 dias" },
  { valor: "30-dias", rotulo: "Últimos 30 dias" },
  { valor: "mes", rotulo: "Mês atual" },
];

export default function IndicadoresPage() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [obraNome, setObraNome] = useState("");
  const [turnoAtivoId, setTurnoAtivoId] = useState<number | null>(null);
  const [tipoVisao, setTipoVisao] = useState<TipoVisao>("turno-atual");
  const [turnoSelecionado, setTurnoSelecionado] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [status, setStatus] = useState("");
  const [tipoRestricao, setTipoRestricao] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [dados, setDados] = useState<DadosIndicadores>(dadosVazios);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [agora] = useState(() => Date.now());

  const carregarDados = useCallback(async (id: number | null) => {
    if (!id) {
      setDados(dadosVazios);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro("");

    const [atividadesResp, turnosResp, restricoesResp] = await Promise.all([
      supabase.from("atividades").select("*").eq("obra_id", id).order("data_turno"),
      supabase
        .from("turnos_operacao")
        .select("*")
        .eq("obra_id", id)
        .order("data_turno", { ascending: false }),
      supabase
        .from("restricoes_historico")
        .select("*")
        .eq("obra_id", id)
        .order("registrada_em", { ascending: false }),
    ]);

    const atividades = (atividadesResp.data || []) as AtividadeIndicador[];
    const ids = atividades.map((item) => item.id);
    const [maoObraResp, recursosResp] =
      ids.length > 0
        ? await Promise.all([
            supabase.from("mao_obra").select("*").in("atividade_id", ids),
            supabase
              .from("atividade_recursos")
              .select("*")
              .in("atividade_id", ids),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

    const primeiroErro = [
      atividadesResp.error,
      turnosResp.error,
      restricoesResp.error,
      maoObraResp.error,
      recursosResp.error,
    ].find(Boolean);

    if (primeiroErro) {
      console.error("Erro ao carregar indicadores.", primeiroErro);
      setErro("Não foi possível carregar todos os indicadores do Supabase.");
    }

    setDados({
      atividades,
      maoObra: (maoObraResp.data || []) as MaoObraIndicador[],
      recursosPlanejados: (recursosResp.data || []) as AtividadeRecurso[],
      restricoes: ((restricoesResp.data || []) as Array<Record<string, unknown>>).map(
        normalizarRestricao
      ),
      turnos: (turnosResp.data || []) as TurnoOperacaoIndicador[],
    });
    setCarregando(false);
  }, []);

  useEffect(() => {
    function aplicarContexto(cadastro = carregarCadastroBase()) {
      const contexto = getContextoAtual(cadastro);
      const novoId = contexto.obraAtivaId;

      setObraId(novoId);
      setObraNome(contexto.obraAtiva?.nome || "");
      setTurnoAtivoId(contexto.turnoAtivoId);
      setTurnoSelecionado("");
      void carregarDados(novoId);
    }

    void sincronizarCadastroBaseRemoto().then(aplicarContexto);
    const atualizar = () => aplicarContexto();
    window.addEventListener(cadastroBaseEvento, atualizar);

    return () => window.removeEventListener(cadastroBaseEvento, atualizar);
  }, [carregarDados]);

  const turnosDisponiveis = useMemo(() => {
    const mapa = new Map<string, TurnoOperacaoIndicador>();
    dados.turnos.forEach((item) => {
      mapa.set(chaveTurno(item), item);
    });
    dados.atividades.forEach((item) => {
      const chave = `${item.data_turno || ""}|${item.turno_id || ""}|${item.turno || ""}`;
      if (!mapa.has(chave) && item.data_turno && item.turno) {
        mapa.set(chave, {
          id: chave,
          obra_id: obraId ?? 0,
          turno_id: item.turno_id,
          data_turno: item.data_turno,
          turno: item.turno,
          status: "planejado",
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) =>
      `${b.data_turno}${b.turno}`.localeCompare(`${a.data_turno}${a.turno}`)
    );
  }, [dados.atividades, dados.turnos, obraId]);

  const turnoPadrao = useMemo(() => {
    const ativo =
      dados.turnos.find((item) => item.status === "em_andamento") ||
      dados.turnos.find(
        (item) => turnoAtivoId && Number(item.turno_id) === turnoAtivoId
      );
    return ativo ?? turnosDisponiveis[0] ?? null;
  }, [dados.turnos, turnoAtivoId, turnosDisponiveis]);

  const periodo = useMemo(
    () => obterPeriodo(tipoVisao, dataInicial, dataFinal),
    [dataFinal, dataInicial, tipoVisao]
  );

  const dadosEscopo = useMemo(() => {
    let atividades = [...dados.atividades];
    let turnos = [...dados.turnos];
    const turnoEscolhido =
      tipoVisao === "turno-especifico"
        ? turnosDisponiveis.find((item) => chaveTurno(item) === turnoSelecionado)
        : turnoPadrao;

    if (tipoVisao === "turno-atual" || tipoVisao === "turno-especifico") {
      atividades = turnoEscolhido
        ? atividades.filter((item) => pertenceAoTurno(item, turnoEscolhido))
        : [];
      turnos = turnoEscolhido
        ? turnos.filter((item) => chaveTurno(item) === chaveTurno(turnoEscolhido))
        : [];
    } else if (tipoVisao !== "geral") {
      atividades = atividades.filter((item) =>
        dataNoPeriodo(item.data_turno, periodo.inicio, periodo.fim)
      );
      turnos = turnos.filter((item) =>
        dataNoPeriodo(item.data_turno, periodo.inicio, periodo.fim)
      );
    }

    const ids = new Set(atividades.map((item) => item.id));
    return {
      atividades,
      turnos,
      restricoes: dados.restricoes.filter((item) => ids.has(item.atividadeId)),
      maoObra: dados.maoObra.filter(
        (item) => item.atividade_id && ids.has(item.atividade_id)
      ),
      recursosPlanejados: dados.recursosPlanejados.filter((item) =>
        ids.has(item.atividade_id)
      ),
    } satisfies DadosIndicadores;
  }, [
    dados,
    periodo,
    tipoVisao,
    turnoPadrao,
    turnoSelecionado,
    turnosDisponiveis,
  ]);

  const dadosVisao = useMemo(() => {
    let atividades = [...dadosEscopo.atividades];

    if (responsavel) {
      atividades = atividades.filter((item) => item.responsavel === responsavel);
    }
    if (status) {
      if (status === "Reprogramadas") {
        const reprogramadas = new Set(
          dadosEscopo.restricoes
            .filter((item) => item.status === "reprogramada")
            .map((item) => item.atividadeId)
        );
        atividades = atividades.filter((item) => reprogramadas.has(item.id));
      } else {
        atividades = atividades.filter((item) => normalizarStatus(item) === status);
      }
    }

    const ids = new Set(atividades.map((item) => item.id));
    let restricoes = dadosEscopo.restricoes.filter((item) =>
      ids.has(item.atividadeId)
    );
    if (tipoRestricao) {
      restricoes = restricoes.filter(
        (item) => obterMotivoRestricao(item.texto) === tipoRestricao
      );
      const idsRestricao = new Set(restricoes.map((item) => item.atividadeId));
      atividades = atividades.filter((item) => idsRestricao.has(item.id));
    }

    const idsFinais = new Set(atividades.map((item) => item.id));
    return {
      atividades,
      turnos: dadosEscopo.turnos,
      restricoes: restricoes.filter((item) => idsFinais.has(item.atividadeId)),
      maoObra: dadosEscopo.maoObra.filter(
        (item) => item.atividade_id && idsFinais.has(item.atividade_id)
      ),
      recursosPlanejados: dadosEscopo.recursosPlanejados.filter((item) =>
        idsFinais.has(item.atividade_id)
      ),
    } satisfies DadosIndicadores;
  }, [
    dadosEscopo,
    responsavel,
    status,
    tipoRestricao,
  ]);

  const resumo = useMemo(
    () => calcularResumoIndicadores(dadosVisao, agora),
    [agora, dadosVisao]
  );
  const resumoHistorico = useMemo(
    () => calcularResumoIndicadores(dadosEscopo, agora),
    [agora, dadosEscopo]
  );
  const responsaveis = useMemo(
    () =>
      Array.from(
        new Set(dados.atividades.map((item) => item.responsavel).filter(Boolean))
      ).sort(),
    [dados.atividades]
  );
  const planejadoReal = resumoHistorico.linhas
    .slice()
    .sort((a, b) => Number(b.atividade.previsto) - Number(a.atividade.previsto))
    .slice(0, 10)
    .map((item) => ({
      nome: abreviar(item.atividade.atividade),
      planejado: Number(item.atividade.previsto || 0),
      realizado: Number(item.atividade.realizado || 0),
    }));
  const hhAtividade = resumoHistorico.linhas
    .filter((item) => item.hhConsumido > 0)
    .sort((a, b) => b.hhConsumido - a.hhConsumido)
    .slice(0, 10)
    .map((item) => ({
      nome: abreviar(item.atividade.atividade),
      hh: arredondar(item.hhConsumido),
    }));
  const statusAtividades = agruparQuantidade(
    dadosEscopo.atividades.map((atividade) =>
      dadosEscopo.restricoes.some(
        (item) =>
          item.atividadeId === atividade.id && item.status === "reprogramada"
      )
        ? "Reprogramadas"
        : normalizarStatus(atividade)
    )
  );
  const restricoesMotivo = agruparQuantidade(
    dadosEscopo.restricoes.map(
      (item) => item.texto.trim() || "Sem descrição"
    )
  );
  const ppcPorTurno = montarPpcPorTurno(dadosEscopo.atividades);
  const produtividadeResponsavel = montarProdutividadeResponsavel(
    resumoHistorico.linhas
  );
  const restricoesPorDia = agruparQuantidade(
    dadosEscopo.restricoes.map((item) =>
      (item.abertaEm || item.registradaEm || "").slice(0, 10)
    )
  );
  const restricoesAbertas = dadosVisao.restricoes.filter(restricaoAberta);
  const alertas = montarAlertas(resumo, dadosVisao.atividades);

  function limparFiltros() {
    setTipoVisao("turno-atual");
    setTurnoSelecionado("");
    setDataInicial("");
    setDataFinal("");
    setResponsavel("");
    setStatus("");
    setTipoRestricao("");
  }

  if (!obraId && !carregando) {
    return (
      <DesktopLayout
        titulo="Indicadores"
        subtitulo="Painel visual de produtividade, HH, avanço físico e restrições da frente."
      >
        <EstadoVazio texto="Selecione uma frente para visualizar os indicadores." />
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout
      titulo="Indicadores"
      subtitulo="Painel visual de produtividade, HH, avanço físico e restrições da frente."
      status={obraNome || "Frente ativa"}
    >
      <div className="space-y-3 pb-6">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((valor) => !valor)}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-left font-bold text-white lg:hidden"
        >
          Filtros {filtrosAbertos ? "−" : "+"}
        </button>

        <section
          className={`${filtrosAbertos ? "block" : "hidden"} rounded-xl bg-white p-3 shadow-sm lg:block`}
        >
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Filtro label="Tipo de visão">
              <select
                value={tipoVisao}
                onChange={(event) => {
                  setTipoVisao(event.target.value as TipoVisao);
                  setTurnoSelecionado("");
                }}
                className="campo-filtro"
              >
                {opcoesVisao.map((item) => (
                  <option key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </option>
                ))}
              </select>
            </Filtro>

            {tipoVisao === "turno-especifico" && (
              <Filtro label="Turno">
                <select
                  value={turnoSelecionado}
                  onChange={(event) => setTurnoSelecionado(event.target.value)}
                  className="campo-filtro"
                >
                  <option value="">Selecione</option>
                  {turnosDisponiveis.map((item) => (
                    <option key={chaveTurno(item)} value={chaveTurno(item)}>
                      {formatarData(item.data_turno)} · {item.turno}
                    </option>
                  ))}
                </select>
              </Filtro>
            )}

            {tipoVisao === "periodo" && (
              <>
                <Filtro label="Data inicial">
                  <input
                    type="date"
                    value={dataInicial}
                    onChange={(event) => setDataInicial(event.target.value)}
                    className="campo-filtro"
                  />
                </Filtro>
                <Filtro label="Data final">
                  <input
                    type="date"
                    value={dataFinal}
                    onChange={(event) => setDataFinal(event.target.value)}
                    className="campo-filtro"
                  />
                </Filtro>
              </>
            )}

            <Filtro label="Responsável">
              <select
                value={responsavel}
                onChange={(event) => setResponsavel(event.target.value)}
                className="campo-filtro"
              >
                <option value="">Todos</option>
                {responsaveis.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Filtro>

            <Filtro label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="campo-filtro"
              >
                <option value="">Todos</option>
                {["Não iniciadas", "Em execução", "Com restrição", "Finalizadas", "Parciais", "Reprogramadas"].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  )
                )}
              </select>
            </Filtro>

            <Filtro label="Tipo de restrição">
              <select
                value={tipoRestricao}
                onChange={(event) => setTipoRestricao(event.target.value)}
                className="campo-filtro"
              >
                <option value="">Todas</option>
                {["Material", "Acesso", "Equipamento", "Projeto/desenho", "Segurança/liberação", "Mão de obra", "Outros"].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  )
                )}
              </select>
            </Filtro>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {erro}
          </div>
        )}

        {carregando ? (
          <Skeleton />
        ) : tipoVisao === "periodo" && (!dataInicial || !dataFinal) ? (
          <EstadoVazio texto="Selecione um período para visualizar os indicadores." />
        ) : dadosVisao.atividades.length === 0 ? (
          <EstadoVazio
            texto={
              tipoVisao === "turno-atual" && !turnoPadrao
                ? "Não há turno ativo para esta frente. Selecione outro turno ou altere o filtro de período."
                : "Nenhuma atividade encontrada para os filtros selecionados."
            }
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
              <Kpi titulo="Status" valor={resumo.status} tom="azul" />
              <Kpi titulo="Tempo decorrido" valor={formatarDuracao(resumo.tempoDecorridoMs)} />
              <Kpi titulo="Tempo produtivo" valor={formatarDuracao(resumo.tempoProdutivoMs)} tom="verde" />
              <Kpi titulo="Tempo parado" valor={formatarDuracao(resumo.tempoParadoMs)} tom="amarelo" />
              <Kpi titulo="HH planejado" valor={formatarNumero(resumo.hhPlanejado)} />
              <Kpi titulo="HH consumido" valor={formatarNumero(resumo.hhConsumido)} tom={resumo.hhConsumido > resumo.hhPlanejado ? "vermelho" : "azul"} />
              <Kpi titulo="HH perdido" valor={formatarNumero(resumo.hhPerdido)} tom={resumo.hhPerdido > 0 ? "vermelho" : "verde"} />
              <Kpi titulo="Avanço real" valor={`${formatarNumero(resumo.avancoReal, 0)}%`} tom="verde" />
              <Kpi titulo="PPC" valor={`${formatarNumero(resumo.ppc, 0)}%`} tom={resumo.ppc >= 80 ? "verde" : "amarelo"} />
              <Kpi titulo="Restrições abertas" valor={String(resumo.restricoesAbertas)} tom={resumo.restricoesAbertas ? "vermelho" : "verde"} />
              <Kpi titulo="Produtividade real" valor={formatarNumero(resumo.produtividade, 2)} tom="azul" />
              <Kpi titulo="Restrições resolvidas" valor={String(resumo.restricoesResolvidas)} tom="verde" />
            </section>

            <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <Bloco titulo="Planejado x Real">
                <GraficoBarras dados={planejadoReal} chaves={[{ chave: "planejado", nome: "Planejado" }, { chave: "realizado", nome: "Realizado", cor: "#ff6b00" }]} />
              </Bloco>
              <Bloco titulo="Distribuição do Tempo">
                <GraficoRosca
                  total={formatarDuracao(resumoHistorico.tempoDecorridoMs)}
                  dados={[
                    { nome: "Produtivo", valor: resumoHistorico.tempoProdutivoMs / 3_600_000, cor: "#2e7d32" },
                    { nome: "Parado por restrição", valor: resumoHistorico.tempoParadoMs / 3_600_000, cor: "#c62828" },
                  ]}
                />
              </Bloco>
              <Bloco titulo="HH Consumido por Atividade">
                <GraficoBarras dados={hhAtividade} chaves={[{ chave: "hh", nome: "HH consumido", cor: "#ff6b00" }]} layout="vertical" />
              </Bloco>
              <Bloco titulo="Status das Atividades">
                <GraficoRosca dados={statusAtividades.map((item) => ({ ...item, valor: item.quantidade }))} />
              </Bloco>
              <Bloco titulo="Restrições por Motivo">
                <GraficoBarras dados={restricoesMotivo.map((item) => ({ nome: item.nome, quantidade: item.quantidade }))} chaves={[{ chave: "quantidade", nome: "Restrições", cor: "#c62828" }]} layout="vertical" />
              </Bloco>
              <Bloco titulo="HH Planejado x HH Consumido">
                <GraficoBarras dados={resumoHistorico.linhas.slice(0, 10).map((item) => ({ nome: abreviar(item.atividade.atividade), planejado: arredondar(item.hhPlanejado), consumido: arredondar(item.hhConsumido) }))} chaves={[{ chave: "planejado", nome: "HH planejado" }, { chave: "consumido", nome: "HH consumido", cor: "#ff6b00" }]} />
              </Bloco>
              <Bloco titulo="PPC por Turno">
                <GraficoLinha dados={ppcPorTurno} chave="ppc" nome="PPC (%)" />
              </Bloco>
              <Bloco titulo="Avanço Acumulado">
                <GraficoLinha dados={montarAvancoPorData(dadosEscopo.atividades)} chave="avanco" nome="Avanço (%)" />
              </Bloco>
              <Bloco titulo="Produtividade por Responsável">
                <GraficoBarras dados={produtividadeResponsavel} chaves={[{ chave: "produtividade", nome: "Produtividade", cor: "#2e7d32" }]} layout="vertical" />
              </Bloco>
              <Bloco titulo="Restrições por Dia">
                <GraficoBarras dados={restricoesPorDia.map((item) => ({ nome: formatarData(item.nome), quantidade: item.quantidade }))} chaves={[{ chave: "quantidade", nome: "Restrições", cor: "#c62828" }]} />
              </Bloco>
            </section>

            <section className="grid gap-3 xl:grid-cols-2">
              <Bloco titulo="Restrições Abertas">
                {restricoesAbertas.length === 0 ? (
                  <EstadoInterno texto="Nenhuma restrição aberta no momento." />
                ) : (
                  <div className="space-y-2">
                    {restricoesAbertas.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-xl border border-red-100 bg-red-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{item.atividade}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.texto}</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                            {obterMotivoRestricao(item.texto)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.responsavel || "Sem responsável"} · aberta há {formatarDuracao(agora - new Date(item.abertaEm || item.registradaEm).getTime())}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>

              <Bloco titulo={tipoVisao === "turno-atual" ? "Alertas do Turno" : "Alertas da Análise"}>
                <div className="space-y-2">
                  {alertas.map((item) => (
                    <div key={item.texto} className={`rounded-xl border p-3 text-sm font-semibold ${item.classe}`}>
                      {item.texto}
                    </div>
                  ))}
                </div>
              </Bloco>
            </section>

            <Bloco titulo="Linha do Tempo">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {montarTimeline(dadosVisao).slice(0, 18).map((evento) => (
                  <div key={evento.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 pl-5">
                    <span className="absolute left-0 top-3 h-7 w-1 rounded-r bg-teal-600" />
                    <p className="text-xs font-bold uppercase text-slate-500">{evento.data}</p>
                    <p className="mt-1 font-bold text-slate-900">{evento.titulo}</p>
                    <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>
                  </div>
                ))}
              </div>
            </Bloco>

            <Bloco titulo="Atividades Detalhadas">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Data / turno</th>
                      <th className="p-3">Atividade</th>
                      <th className="p-3">Responsável</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Planejado</th>
                      <th className="p-3">Executado</th>
                      <th className="p-3">HH planejado</th>
                      <th className="p-3">HH consumido</th>
                      <th className="p-3">Produtividade</th>
                      <th className="p-3">Restrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.linhas.map((linha) => (
                      <tr key={linha.atividade.id} className="border-t border-slate-100">
                        <td className="p-3">{formatarData(linha.atividade.data_turno)}<br /><span className="text-xs text-slate-500">{linha.atividade.turno}</span></td>
                        <td className="p-3 font-semibold">{linha.atividade.atividade}</td>
                        <td className="p-3">{linha.atividade.responsavel || "—"}</td>
                        <td className="p-3">{normalizarStatus(linha.atividade)}</td>
                        <td className="p-3">{formatarNumero(Number(linha.atividade.previsto || 0))} {linha.atividade.unidade}</td>
                        <td className="p-3">{formatarNumero(Number(linha.atividade.realizado || 0))} {linha.atividade.unidade}</td>
                        <td className="p-3">{formatarNumero(linha.hhPlanejado)}</td>
                        <td className="p-3">{formatarNumero(linha.hhConsumido)}</td>
                        <td className="p-3">{formatarNumero(linha.produtividade, 2)}</td>
                        <td className="p-3">{linha.restricaoAberta?.texto || "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {resumo.linhas.map((linha) => (
                  <div key={linha.atividade.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex justify-between gap-3">
                      <p className="font-bold">{linha.atividade.atividade}</p>
                      <span className="text-xs font-bold text-blue-700">{normalizarStatus(linha.atividade)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{formatarData(linha.atividade.data_turno)} · {linha.atividade.turno}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <span>Planejado: <b>{formatarNumero(Number(linha.atividade.previsto || 0))}</b></span>
                      <span>Executado: <b>{formatarNumero(Number(linha.atividade.realizado || 0))}</b></span>
                      <span>HH plan.: <b>{formatarNumero(linha.hhPlanejado)}</b></span>
                      <span>HH cons.: <b>{formatarNumero(linha.hhConsumido)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </Bloco>
          </>
        )}
      </div>
    </DesktopLayout>
  );
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Kpi({
  titulo,
  valor,
  tom = "cinza",
}: {
  titulo: string;
  valor: string;
  tom?: "cinza" | "azul" | "verde" | "amarelo" | "vermelho";
}) {
  const tons = {
    cinza: "border-slate-200 bg-white",
    azul: "border-blue-100 bg-blue-50",
    verde: "border-green-100 bg-green-50",
    amarelo: "border-yellow-100 bg-yellow-50",
    vermelho: "border-red-100 bg-red-50",
  };
  return (
    <article className={`min-h-20 rounded-xl border p-3 shadow-sm ${tons[tom]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 break-words text-xl font-black text-slate-900">{valor}</p>
    </article>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl bg-white p-3 shadow-sm">
      <h3 className="mb-2 text-base font-bold text-slate-900">{titulo}</h3>
      {children}
    </section>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-sm">
      <p className="font-semibold text-slate-500">{texto}</p>
    </div>
  );
}

function EstadoInterno({ texto }: { texto: string }) {
  return <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{texto}</div>;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, indice) => (
        <div key={indice} className="h-20 animate-pulse rounded-xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

function normalizarRestricao(item: Record<string, unknown>): RestricaoHistorico {
  return {
    id: String(item.id),
    atividadeId: Number(item.atividade_id),
    obraId: item.obra_id ? Number(item.obra_id) : null,
    turnoId: item.turno_id ? Number(item.turno_id) : null,
    dataTurno: item.data_turno ? String(item.data_turno) : null,
    turno: item.turno ? String(item.turno) : null,
    atividade: String(item.atividade || ""),
    responsavel: String(item.responsavel || ""),
    texto: String(item.texto || item.descricao || item.observacao || ""),
    status: String(item.status || "aberta") as RestricaoHistorico["status"],
    registradaEm: String(item.registrada_em || item.aberta_em || ""),
    abertaEm: item.aberta_em ? String(item.aberta_em) : null,
    paradaEm: item.parada_em ? String(item.parada_em) : null,
    retomadaEm: item.retomada_em ? String(item.retomada_em) : null,
    encerradaEm: item.encerrada_em ? String(item.encerrada_em) : null,
    resolvidaEm: item.resolvida_em ? String(item.resolvida_em) : null,
    duracaoMs: item.duracao_ms === null || item.duracao_ms === undefined ? null : Number(item.duracao_ms),
  };
}

function chaveTurno(item: Pick<TurnoOperacaoIndicador, "data_turno" | "turno_id" | "turno">) {
  return `${item.data_turno}|${item.turno_id || ""}|${item.turno}`;
}

function pertenceAoTurno(atividade: AtividadeIndicador, turno: TurnoOperacaoIndicador) {
  return (
    atividade.data_turno === turno.data_turno &&
    ((atividade.turno_id && turno.turno_id && Number(atividade.turno_id) === Number(turno.turno_id)) ||
      atividade.turno === turno.turno)
  );
}

function obterPeriodo(tipo: TipoVisao, inicio: string, fim: string) {
  const hoje = new Date();
  const hojeTexto = dataLocal(hoje);
  if (tipo === "periodo") return { inicio, fim };
  if (tipo === "hoje") return { inicio: hojeTexto, fim: hojeTexto };
  if (tipo === "7-dias" || tipo === "30-dias") {
    const data = new Date(hoje);
    data.setDate(data.getDate() - (tipo === "7-dias" ? 6 : 29));
    return { inicio: dataLocal(data), fim: hojeTexto };
  }
  if (tipo === "mes") {
    return {
      inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      fim: hojeTexto,
    };
  }
  return { inicio: "", fim: "" };
}

function dataNoPeriodo(data: string | null | undefined, inicio: string, fim: string) {
  return Boolean(data && inicio && fim && data >= inicio && data <= fim);
}

function dataLocal(data: Date) {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 10);
}

function normalizarStatus(atividade: AtividadeIndicador) {
  if (atividade.status === "Planejada") return "Não iniciadas";
  if (atividade.status === "Execução") return "Em execução";
  if (atividade.status === "Restrição") return "Com restrição";
  if (atividade.status === "Finalizada") return "Finalizadas";
  if (atividade.status === "Parcial") return "Parciais";
  return atividade.status;
}

function agruparQuantidade(valores: string[]) {
  const mapa = new Map<string, number>();
  valores.filter(Boolean).forEach((valor) => mapa.set(valor, (mapa.get(valor) || 0) + 1));
  return Array.from(mapa, ([nome, quantidade]) => ({ nome, quantidade }));
}

function montarPpcPorTurno(atividades: AtividadeIndicador[]) {
  const mapa = new Map<string, AtividadeIndicador[]>();
  atividades.forEach((item) => {
    const chave = `${item.data_turno || ""} · ${item.turno || ""}`;
    mapa.set(chave, [...(mapa.get(chave) || []), item]);
  });
  return Array.from(mapa, ([nome, itens]) => ({
    nome,
    ppc: arredondar(
      (itens.filter(
        (item) =>
          item.status === "Finalizada" &&
          Number(item.realizado || 0) >= Number(item.previsto || 0)
      ).length /
        Math.max(1, itens.length)) *
        100
    ),
  })).sort((a, b) => a.nome.localeCompare(b.nome));
}

function montarAvancoPorData(atividades: AtividadeIndicador[]) {
  const mapa = new Map<string, { planejado: number; realizado: number }>();
  atividades.forEach((item) => {
    const data = item.data_turno || "";
    const atual = mapa.get(data) || { planejado: 0, realizado: 0 };
    atual.planejado += Number(item.previsto || 0);
    atual.realizado += Number(item.realizado || 0);
    mapa.set(data, atual);
  });
  let planejado = 0;
  let realizado = 0;
  return Array.from(mapa)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, item]) => {
      planejado += item.planejado;
      realizado += item.realizado;
      return {
        nome: formatarData(nome),
        avanco: planejado > 0 ? arredondar(Math.min(100, (realizado / planejado) * 100)) : 0,
      };
    });
}

function montarProdutividadeResponsavel(
  linhas: ReturnType<typeof calcularResumoIndicadores>["linhas"]
) {
  const mapa = new Map<string, { realizado: number; hh: number }>();
  linhas.forEach((linha) => {
    const nome = linha.atividade.responsavel;
    if (!nome) return;
    const atual = mapa.get(nome) || { realizado: 0, hh: 0 };
    atual.realizado += Number(linha.atividade.realizado || 0);
    atual.hh += linha.hhConsumido;
    mapa.set(nome, atual);
  });
  return Array.from(mapa, ([nome, item]) => ({
    nome,
    produtividade: item.hh > 0 ? arredondar(item.realizado / item.hh) : 0,
  })).sort((a, b) => b.produtividade - a.produtividade);
}

function montarTimeline(dados: DadosIndicadores) {
  const eventos: Array<{ id: string; data: string; titulo: string; descricao: string; ordem: number }> = [];
  dados.turnos.forEach((turno) => {
    adicionarEvento(
      eventos,
      `${turno.id}-iniciado`,
      turno.iniciado_em,
      "Turno iniciado",
      turno.turno
    );
    adicionarEvento(
      eventos,
      `${turno.id}-pausado`,
      turno.pausado_em,
      "Turno pausado",
      turno.turno
    );
    adicionarEvento(
      eventos,
      `${turno.id}-encerrado`,
      turno.encerrado_em,
      "Turno encerrado",
      turno.turno
    );
  });
  dados.atividades.forEach((atividade) => {
    adicionarEvento(
      eventos,
      `${atividade.id}-iniciada`,
      atividade.iniciado_em,
      "Atividade iniciada",
      atividade.atividade
    );
    adicionarEvento(
      eventos,
      `${atividade.id}-finalizada`,
      atividade.finalizado_em,
      "Atividade finalizada",
      atividade.atividade
    );
  });
  dados.restricoes.forEach((item) => {
    if (item.abertaEm || item.registradaEm) {
      const data = item.abertaEm || item.registradaEm;
      eventos.push({ id: `${item.id}-aberta`, data: formatarDataHora(data), titulo: "Restrição aberta", descricao: `${item.atividade}: ${item.texto}`, ordem: new Date(data).getTime() });
    }
    if (item.resolvidaEm) {
      eventos.push({ id: `${item.id}-resolvida`, data: formatarDataHora(item.resolvidaEm), titulo: "Restrição resolvida", descricao: item.atividade, ordem: new Date(item.resolvidaEm).getTime() });
    }
  });
  return eventos.sort((a, b) => b.ordem - a.ordem);
}

function adicionarEvento(
  eventos: Array<{
    id: string;
    data: string;
    titulo: string;
    descricao: string;
    ordem: number;
  }>,
  id: string,
  data: string | null | undefined,
  titulo: string,
  descricao: string
) {
  if (!data) {
    return;
  }

  eventos.push({
    id,
    data: formatarDataHora(data),
    titulo,
    descricao,
    ordem: new Date(data).getTime(),
  });
}

function montarAlertas(
  resumo: ReturnType<typeof calcularResumoIndicadores>,
  atividades: AtividadeIndicador[]
) {
  const alertas: Array<{ texto: string; classe: string }> = [];
  if (resumo.hhConsumido > resumo.hhPlanejado && resumo.hhPlanejado > 0)
    alertas.push({ texto: "HH consumido acima do planejado.", classe: "border-red-200 bg-red-50 text-red-700" });
  if (resumo.restricoesAbertas > 0)
    alertas.push({ texto: "Existem restrições abertas impactando a execução.", classe: "border-red-200 bg-red-50 text-red-700" });
  if (resumo.status === "Em andamento" && !atividades.some((item) => item.status === "Execução"))
    alertas.push({ texto: "Turno iniciado sem atividade em execução.", classe: "border-yellow-200 bg-yellow-50 text-yellow-700" });
  if (atividades.filter((item) => item.status === "Parcial").length > Math.max(2, atividades.length * 0.3))
    alertas.push({ texto: "Alto volume de atividades parciais ou reprogramadas.", classe: "border-yellow-200 bg-yellow-50 text-yellow-700" });
  if (alertas.length === 0)
    alertas.push({ texto: "Nenhum alerta crítico identificado nesta análise.", classe: "border-green-200 bg-green-50 text-green-700" });
  return alertas;
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${valor}T12:00:00`));
}

function formatarDataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

function abreviar(valor: string) {
  return valor.length > 18 ? `${valor.slice(0, 18)}…` : valor;
}

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}
