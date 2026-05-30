"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../components/DesktopLayout";
import { supabase } from "../lib/supabase";
import type { Atividade, RecursoDisponivelTurno } from "../lib/types";
import {
  cadastroBaseEvento,
  cadastroDadosObraInicial,
  carregarCadastroBase,
  getContextoAtual,
  obterDadosObra,
  type FuncaoPrevistaCadastrada,
  type TurnoCadastrado,
} from "../lib/cadastro-base";
import {
  calcularTempoTurno,
  carregarObjetoLocal as carregarOperacaoLocal,
  checkoutFechamentosStorageKey,
  encerrarControleTurno,
  pertenceAoTurno,
  type FechamentosTurno,
  chaveTurno,
  type ControlesTurno,
  iniciarControleTurno,
  listarRestricoesHistorico,
  obterControleTurno,
  pausarControleTurno,
  salvarObjetoLocal,
  turnoEstaEncerrado,
  turnosOperacaoStorageKey,
  type RestricaoHistorico,
} from "../lib/operacao";
import { gerarCampoUrl } from "../lib/rotas";

type MaoObraReal = {
  id: number;
  obra_id?: number | null;
  turno_id?: number | null;
  atividade_id?: number | null;
  funcao: string | null;
  quantidade: number | null;
  turno: string | null;
  data_turno: string | null;
};

const maoObraLocalStorageKey = "obraboard:mao-obra-local";
const recursosDisponiveisStorageKey = "obraboard:recursos-disponiveis-local";
const dataHoje = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [obraAtivaNome, setObraAtivaNome] = useState("Sem obra selecionada");
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const [turnoAtivo, setTurnoAtivo] = useState("");
  const [turnoAtivoDados, setTurnoAtivoDados] = useState<TurnoCadastrado | null>(null);
  const [clientePronto, setClientePronto] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const [historicoRestricoes, setHistoricoRestricoes] = useState<RestricaoHistorico[]>([]);
  const [funcoesPrevistas, setFuncoesPrevistas] = useState<
    FuncaoPrevistaCadastrada[]
  >([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<
    RecursoDisponivelTurno[]
  >([]);
  const [fechamentos, setFechamentos] = useState<FechamentosTurno>(() =>
    carregarOperacaoLocal(checkoutFechamentosStorageKey, {})
  );
  const [controlesTurno, setControlesTurno] = useState<ControlesTurno>(() =>
    carregarOperacaoLocal(turnosOperacaoStorageKey, {})
  );
  const [mensagem, setMensagem] = useState("");

  const turnoAtual = turnoAtivo;

  const atividadesDoTurnoAtual = useMemo(() => {
    if (!turnoAtual) {
      return atividadesBanco;
    }

    return atividadesBanco.filter((item) => {
      const mesmaObra =
        !obraAtivaId || Number(item.obra_id) === Number(obraAtivaId);

      const mesmoTurnoPorId =
        turnoAtivoDados?.id &&
        item.turno_id &&
        Number(item.turno_id) === Number(turnoAtivoDados.id);

      const mesmoTurnoPorNome =
        item.turno &&
        String(item.turno).trim().toLowerCase() ===
          String(turnoAtual).trim().toLowerCase();

      return mesmaObra && (mesmoTurnoPorId || mesmoTurnoPorNome);
    });
  }, [atividadesBanco, obraAtivaId, turnoAtivoDados, turnoAtual]);

  const dataTurnoAtual = obterDataTurnoAtual(atividadesDoTurnoAtual);
  const dataTurnoOperacional = dataTurnoAtual ?? dataHoje();

  const atividadesDaData = useMemo(
    () =>
      dataTurnoAtual
        ? atividadesBanco.filter((item) => item.data_turno === dataTurnoAtual)
        : atividadesBanco,
    [atividadesBanco, dataTurnoAtual]
  );

  const turnoIdCampo = useMemo(() => {
    const atividadeComTurnoId = atividadesDoTurnoAtual.find(
      (item) => item.turno_id
    );

    if (atividadeComTurnoId?.turno_id) {
      return Number(atividadeComTurnoId.turno_id);
    }

    if (turnoAtivoDados?.id) {
      return Number(turnoAtivoDados.id);
    }

    return null;
  }, [atividadesDoTurnoAtual, turnoAtivoDados]);

  const campoObraAtivaUrl =
    clientePronto && obraAtivaId && turnoIdCampo && dataTurnoAtual
      ? gerarCampoUrl({
          obraId: obraAtivaId,
          turnoId: turnoIdCampo,
          dataTurno: dataTurnoAtual,
        })
      : null;

  const atividades = useMemo(() => {
    if (!turnoAtual) {
      return [];
    }

    return atividadesDaData.filter((item) => {
      const mesmaObra =
        !obraAtivaId || Number(item.obra_id) === Number(obraAtivaId);

      const mesmoTurnoPorId =
        turnoIdCampo &&
        item.turno_id &&
        Number(item.turno_id) === Number(turnoIdCampo);

      const mesmoTurnoPorNome =
        item.turno &&
        String(item.turno).trim().toLowerCase() ===
          String(turnoAtual).trim().toLowerCase();

      const mesmaData =
        !dataTurnoAtual || item.data_turno === dataTurnoAtual;

      return mesmaObra && mesmaData && (mesmoTurnoPorId || mesmoTurnoPorNome);
    });
  }, [atividadesDaData, dataTurnoAtual, obraAtivaId, turnoAtual, turnoIdCampo]);

  const recursosReaisPorFuncao = useMemo(() => {
    const mapa = new Map<string, number>();
    const atividadesIds = new Set(atividades.map((item) => item.id));

    maoObraReal
      .filter((item) =>
        item.atividade_id
          ? atividadesIds.has(item.atividade_id)
          : pertenceAoTurno(item, {
              obraId: obraAtivaId,
              turnoId: turnoAtivoDados?.id ?? null,
              turno: turnoAtual || null,
              dataTurno: dataTurnoAtual,
            })
      )
      .forEach((item) => {
        const funcao = item.funcao || "";

        if (funcao) {
          mapa.set(funcao, (mapa.get(funcao) ?? 0) + Number(item.quantidade || 0));
        }
      });

    return mapa;
  }, [atividades, dataTurnoAtual, maoObraReal, obraAtivaId, turnoAtivoDados, turnoAtual]);

  const recursosPrevistosPorFuncao = useMemo(() => {
    const mapa = new Map<string, { quantidade: number; hh: number }>();

    recursosDisponiveis.forEach((item) => {
      const atual = mapa.get(item.funcao) ?? { quantidade: 0, hh: 0 };
      atual.quantidade += Number(item.quantidade || 0);
      atual.hh += Number(item.quantidade || 0) * Number(item.cargaHoraria || 0);
      mapa.set(item.funcao, atual);
    });

    return mapa;
  }, [recursosDisponiveis]);

  const funcoesRecursos = useMemo(() => {
    const nomes = new Set([
      ...funcoesPrevistas.map((item) => item.nome),
      ...Array.from(recursosPrevistosPorFuncao.keys()),
      ...Array.from(recursosReaisPorFuncao.keys()),
    ]);

    return Array.from(nomes).filter(Boolean);
  }, [funcoesPrevistas, recursosPrevistosPorFuncao, recursosReaisPorFuncao]);

  const dataTurnoFormatada = dataTurnoAtual
    ? formatarDataTurno(dataTurnoAtual)
    : "Turno sem data";

  const controleTurno = obterControleTurno(
    controlesTurno,
    obraAtivaId,
    dataTurnoOperacional,
    turnoAtual || null
  );

  const tempoDecorridoMs = calcularTempoTurno(controleTurno, agora.getTime());

  const turnoEncerrado = turnoEstaEncerrado(
    fechamentos,
    obraAtivaId,
    dataTurnoOperacional,
    turnoAtual || null
  );

  const statusOperacao = turnoEncerrado
    ? "encerrado"
    : controleTurno?.status ?? "planejado";

  const indicadorTurnoExibido = obterIndicadorOperacao(statusOperacao);


  const qrCodeUrl = campoObraAtivaUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
        campoObraAtivaUrl
      )}&size=180x180&margin=8`
    : null;

  const qrCodeRenderKey = campoObraAtivaUrl
    ? `${campoObraAtivaUrl}:${statusOperacao}:${turnoIdCampo ?? ""}:${dataTurnoAtual ?? ""}`
    : null;

  const executando = contarStatus(atividades, "Execução");
  const restricoes = contarStatus(atividades, "Restrição");
  const finalizadas = contarStatus(atividades, "Finalizada");
  const parciais = contarStatus(atividades, "Parcial");

  const restricoesPainel = useMemo(() => {
    const restricoesAtivas = atividades
      .filter(
        (item) =>
          item.status.toLowerCase().startsWith("restri") &&
          !historicoRestricoes.some(
            (historico) =>
              historico.atividadeId === item.id &&
              historico.dataTurno === item.data_turno &&
              (historico.turnoId
                ? historico.turnoId === item.turno_id
                : historico.turno === item.turno)
          )
      )
      .map((item) => ({
        codigo: `R${item.id}`,
        titulo: item.atividade,
        responsavel: item.responsavel,
        observacao: "Sem observação registrada.",
        criticidade: item.prioridade === "A" ? "Alta" : "Média",
        status: "aberta",
      }));

    const historico = historicoRestricoes.map((item) => ({
      codigo: `R${item.atividadeId}`,
      titulo: item.atividade,
      responsavel: item.responsavel,
      observacao: item.texto || "Sem observação registrada.",
      criticidade: item.status === "aberta" ? "Alta" : "Encerrada",
      status: item.status === "aberta" ? "aberta" : "Encerrada",
    }));

    return [...restricoesAtivas, ...historico];
  }, [atividades, historicoRestricoes]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 1000);
    queueMicrotask(() => setClientePronto(true));

    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    async function carregarAtividades(obraId: number | null) {
      if (!obraId) {
        setAtividadesBanco([]);
        return;
      }

      const { data } = await supabase
        .from("atividades")
        .select("*")
        .eq("obra_id", obraId)
        .order("id", { ascending: true });

      setAtividadesBanco((data || []) as Atividade[]);
    }

    async function carregarMaoObraReal() {
      const { data } = await supabase
        .from("mao_obra")
        .select("*")
        .order("id", { ascending: true });

      setMaoObraReal([
        ...((data || []) as MaoObraReal[]),
        ...carregarListaLocal<MaoObraReal>(maoObraLocalStorageKey),
      ]);
    }

    function carregarContexto() {
      const cadastro = carregarCadastroBase();
      const contexto = getContextoAtual(cadastro);
      const obraAtiva = contexto.obraAtiva;
      const obraResolvidaId = contexto.obraAtivaId;
      const dadosObra = obraAtiva
        ? obterDadosObra(cadastro, obraAtiva.id)
        : cadastroDadosObraInicial;

      setObraAtivaNome(
        obraAtiva?.nome ||
          (obraResolvidaId ? "Obra informada no link" : "Sem obra selecionada")
      );
      setObraAtivaId(obraResolvidaId);
      setFuncoesPrevistas(dadosObra.funcoesPrevistas);
      setTurnoAtivo(contexto.turnoAtivo?.nome ?? "");
      setTurnoAtivoDados(contexto.turnoAtivo);
      setFechamentos(carregarOperacaoLocal(checkoutFechamentosStorageKey, {}));
      setControlesTurno(carregarOperacaoLocal(turnosOperacaoStorageKey, {}));
      void carregarAtividades(obraResolvidaId);
      void carregarMaoObraReal();
    }

    carregarContexto();
    const intervaloAtualizacao = window.setInterval(carregarContexto, 60000);
    window.addEventListener(cadastroBaseEvento, carregarContexto);
    window.addEventListener("storage", carregarContexto);

    return () => {
      window.clearInterval(intervaloAtualizacao);
      window.removeEventListener(cadastroBaseEvento, carregarContexto);
      window.removeEventListener("storage", carregarContexto);
    };
  }, []);

  useEffect(() => {
    void carregarRecursosPainel();

    async function carregarRecursosPainel() {
      if (!obraAtivaId || !dataTurnoAtual || !turnoAtual || !turnoAtivoDados?.id) {
        setRecursosDisponiveis([]);
        return;
      }

      const locais = carregarListaLocal<RecursoDisponivelTurno>(
        recursosDisponiveisStorageKey
      ).filter((item) =>
        pertenceAoTurno(item, {
          obraId: obraAtivaId,
          turnoId: turnoAtivoDados.id,
          turno: turnoAtual,
          dataTurno: dataTurnoAtual,
        })
      );

      const { data, error } = await supabase
        .from("recursos_disponiveis")
        .select("*")
        .eq("obra_id", obraAtivaId)
        .eq("data_turno", dataTurnoAtual)
        .eq("turno", turnoAtual)
        .order("id", { ascending: true });

      if (error) {
        setRecursosDisponiveis(locais);
        return;
      }

      setRecursosDisponiveis([
        ...((data || []) as Array<Record<string, unknown>>).map((item) => ({
          id: Number(item.id),
          obra_id: Number(item.obra_id),
          turno_id:
            item.turno_id === null || item.turno_id === undefined
              ? null
              : Number(item.turno_id),
          data_turno: String(item.data_turno),
          turno: String(item.turno),
          funcao: String(item.funcao),
          quantidade: Number(item.quantidade || 0),
          cargaHoraria: Number(item.carga_horaria || 0),
        })),
        ...locais,
      ]);
    }
  }, [dataTurnoAtual, obraAtivaId, turnoAtivoDados, turnoAtual]);

  useEffect(() => {
    queueMicrotask(() =>
      setHistoricoRestricoes(
        listarRestricoesHistorico(
          obraAtivaId,
          dataTurnoAtual,
          turnoAtual || null
        )
      )
    );
  }, [dataTurnoAtual, obraAtivaId, turnoAtual]);

  function iniciarTurnoPainel() {
    if (!obraAtivaId || !dataTurnoOperacional || !turnoAtual) {
      return;
    }

    gravarControlesTurno(
      iniciarControleTurno(
        controlesTurno,
        obraAtivaId,
        dataTurnoOperacional,
        turnoAtual
      )
    );
    setMensagem("Turno iniciado.");
  }

  function pararTurnoPainel() {
    if (!obraAtivaId || !dataTurnoOperacional || !turnoAtual) {
      return;
    }

    gravarControlesTurno(
      pausarControleTurno(
        controlesTurno,
        obraAtivaId,
        dataTurnoOperacional,
        turnoAtual
      )
    );
    setMensagem("Turno pausado.");
  }

  function continuarTurnoPainel() {
    iniciarTurnoPainel();
    setMensagem("Turno retomado.");
  }

  function encerrarTurnoPainel() {
    if (!obraAtivaId || !dataTurnoOperacional || !turnoAtual) {
      return;
    }

    const novosControles = encerrarControleTurno(
      controlesTurno,
      obraAtivaId,
      dataTurnoOperacional,
      turnoAtual
    );

    const controleEncerrado = obterControleTurno(
      novosControles,
      obraAtivaId,
      dataTurnoOperacional,
      turnoAtual
    );

    const chave = chaveTurno(obraAtivaId, dataTurnoOperacional, turnoAtual);

    const novosFechamentos = {
      ...fechamentos,
      [chave]: {
        encerradoEm: controleEncerrado?.encerradoEm ?? new Date().toISOString(),
        rdoGeradoEm: controleEncerrado?.rdoGeradoEm ?? new Date().toISOString(),
        tempoFinalMs: controleEncerrado?.elapsedMs ?? tempoDecorridoMs,
      },
    };

    gravarControlesTurno(novosControles);
    setFechamentos(novosFechamentos);
    salvarObjetoLocal(checkoutFechamentosStorageKey, novosFechamentos);
    window.dispatchEvent(new Event("storage"));
    setMensagem("Turno encerrado e RDO gerado automaticamente.");
  }

  function gravarControlesTurno(novosControles: ControlesTurno) {
    setControlesTurno(novosControles);
    salvarObjetoLocal(turnosOperacaoStorageKey, novosControles);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <DesktopLayout
      titulo="Painel Check-in / Check-out"
      subtitulo={`Obra: ${obraAtivaNome} - Turno ${turnoAtual || "-"} - Data: ${dataTurnoFormatada}`}
      status={indicadorTurnoExibido.texto}
      statusTom={indicadorTurnoExibido.tom}
      infoCentral={formatarRelogioTurno(agora)}
      detalheCentral={`Decorrido ${formatarDuracao(tempoDecorridoMs)} - ${indicadorTurnoExibido.detalhe}`}
    >
      <div className="space-y-4">
        {mensagem && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {mensagem}
          </div>
        )}

        {!obraAtivaId ? (
          <EstadoVazio texto="Selecione uma obra no menu lateral para continuar." />
        ) : !turnoAtual ? (
          <EstadoVazio texto="Selecione ou publique um turno no Checkin para continuar." />
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,360px)_auto_1fr] lg:items-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">
                Turno ativo
              </p>
              <p className="mt-1 font-bold text-slate-900">
                {turnoAtual || "-"}
              </p>
              {turnoAtivoDados && (
                <p className="text-xs font-semibold text-slate-500">
                  Planejado: {turnoAtivoDados.horaInicio} - {turnoAtivoDados.horaFim}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {statusOperacao === "em_andamento" ? (
                <button
                  type="button"
                  onClick={pararTurnoPainel}
                  className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-yellow-600"
                >
                  Parar Turno
                </button>
              ) : statusOperacao === "pausado" ? (
                <>
                  <button
                    type="button"
                    onClick={continuarTurnoPainel}
                    className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    Continuar Turno
                  </button>
                  <button
                    type="button"
                    onClick={encerrarTurnoPainel}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Encerrar Turno
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={iniciarTurnoPainel}
                  disabled={!obraAtivaId || !turnoAtual || statusOperacao === "encerrado"}
                  className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {statusOperacao === "encerrado" ? "Turno encerrado" : "Iniciar Turno"}
                </button>
              )}
            </div>

            <p className="text-sm font-semibold text-slate-500">
              A contagem e manual: iniciar, parar, continuar e encerrar nao dependem do horario planejado.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard titulo="Atividades" valor={String(atividades.length)} />
          <KpiCard titulo="Execucao" valor={String(executando)} />
          <KpiCard
            titulo="Restricoes"
            valor={String(restricoes)}
            destaque="text-red-500"
          />
          <KpiCard
            titulo="Parciais"
            valor={String(parciais)}
            destaque="text-yellow-500"
          />
          <KpiCard
            titulo="Validadas"
            valor={String(finalizadas)}
            destaque="text-green-600"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <section className="rounded-2xl bg-white shadow-sm">
              <CabecalhoSecao titulo="Recursos" texto="Previsto x real" />

              <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-4">
                {funcoesRecursos.length === 0 ? (
                  <EstadoVazio texto="Nenhum recurso previsto cadastrado para a obra ativa." />
                ) : (
                  funcoesRecursos.map((funcao) => {
                    const previsto = recursosPrevistosPorFuncao.get(funcao);

                    return (
                      <RecursoCard
                        key={funcao}
                        nome={funcao}
                        previsto={previsto?.quantidade ?? 0}
                        real={recursosReaisPorFuncao.get(funcao) ?? 0}
                        hhDisponivel={previsto?.hh ?? 0}
                      />
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white shadow-sm">
              <CabecalhoSecao
                titulo="Gestão operacional"
                texto="Frentes, tarefas e oportunidades"
              />

              {atividades.length === 0 ? (
                <div className="p-4">
                  <EstadoVazio texto="Nenhuma atividade carregada para a obra, data e turno atuais." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full">
                    <thead className="bg-slate-50 text-sm">
                      <tr>
                        <th className="p-3 text-left">Pri</th>
                        <th className="p-3 text-left">Disc</th>
                        <th className="p-3 text-left">Atividade</th>
                        <th className="p-3 text-left">Local</th>
                        <th className="p-3 text-left">Resp</th>
                        <th className="p-3 text-center">Prev</th>
                        <th className="p-3 text-center">Real</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {atividades.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t text-sm hover:bg-slate-50"
                        >
                          <td className="p-3 font-bold text-red-500">
                            {item.prioridade}
                          </td>
                          <td className="p-3 font-semibold">{item.disciplina}</td>
                          <td className="p-3 font-medium">{item.atividade}</td>
                          <td className="p-3">{item.local}</td>
                          <td className="p-3">{item.responsavel}</td>
                          <td className="p-3 text-center">{item.previsto}</td>
                          <td className="p-3 text-center">{item.realizado ?? 0}</td>
                          <td className="p-3 text-center">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-xl font-bold">Campo da obra ativa</h3>
              <p className="mb-4 text-sm text-slate-500">
                Acesso direto para {obraAtivaNome}
                {turnoAtual ? ` - Turno ${turnoAtual}` : ""}.
              </p>

              {campoObraAtivaUrl && qrCodeUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <a href={campoObraAtivaUrl} aria-label="Abrir tela Campo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={qrCodeRenderKey}
                      src={qrCodeUrl}
                      alt="QR Code para abrir a tela Campo"
                      className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
                    />
                  </a>
                  <a
                    href={campoObraAtivaUrl}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    Abrir Campo
                  </a>
                </div>
              ) : (
                <EstadoVazio
                  texto={
                    !obraAtivaId
                      ? "Selecione uma obra no menu lateral para continuar."
                      : "Selecione ou publique um turno no Checkin para gerar o acesso ao Campo."
                  }
                />
              )}
            </section>

            <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
              <h3 className="text-xl font-bold text-red-600">
                Atenção do Turno
              </h3>
              <p className="mb-4 text-sm text-slate-500">
                Histórico das restrições do turno
              </p>

              <div className="space-y-3">
                {restricoesPainel.length === 0 ? (
                  <EstadoVazio texto="Nenhuma restrição registrada no turno atual." />
                ) : (
                  restricoesPainel.map((restricao) => (
                    <RestricaoCard
                      key={`${restricao.codigo}-${restricao.status}-${restricao.observacao}`}
                      codigo={restricao.codigo}
                      titulo={restricao.titulo}
                      responsavel={restricao.responsavel}
                      observacao={restricao.observacao}
                      prazo={dataTurnoFormatada}
                      criticidade={restricao.criticidade}
                      status={restricao.status}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xl font-bold">Observacoes</h3>
              <p className="text-sm leading-7 text-slate-600">
                {atividades.length === 0
                  ? "Nenhuma atividade registrada para o turno atual."
                  : `${atividades.length} atividades carregadas para acompanhamento do turno.`}
              </p>
            </section>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}

function contarStatus(atividades: Atividade[], status: string) {
  return atividades.filter((item) => item.status === status).length;
}

function obterDataTurnoAtual(
  atividades: Array<{ data_turno?: string | null }>
) {
  const datas = atividades
    .map((item) => item.data_turno)
    .filter((data): data is string => Boolean(data))
    .sort();

  return datas.at(-1) ?? null;
}

function formatarDataTurno(dataTurno: string) {
  const [ano, mes, dia] = dataTurno.split("-");

  if (!ano || !mes || !dia) {
    return dataTurno;
  }

  return `${dia}/${mes}/${ano}`;
}

function obterIndicadorOperacao(status: string): {
  texto: string;
  detalhe: string;
  tom: "planejado" | "andamento" | "encerrado";
} {
  if (status === "encerrado") {
    return { texto: "Turno encerrado", detalhe: "Tempo final", tom: "encerrado" };
  }

  if (status === "em_andamento") {
    return { texto: "Turno em andamento", detalhe: "Tempo real", tom: "andamento" };
  }

  if (status === "pausado") {
    return { texto: "Turno pausado", detalhe: "Tempo pausado", tom: "planejado" };
  }

  if (status === "publicado") {
    return { texto: "Turno publicado", detalhe: "Pronto para iniciar", tom: "planejado" };
  }

  return { texto: "Turno planejado", detalhe: "Aguardando inicio", tom: "planejado" };
}

function formatarDuracao(ms: number) {
  const segundosTotais = Math.floor(ms / 1000);
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.floor((segundosTotais % 3600) / 60);
  const segundos = segundosTotais % 60;

  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(
    2,
    "0"
  )}:${String(segundos).padStart(2, "0")}`;
}

function formatarRelogioTurno(data: Date) {
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
}

function carregarListaLocal<T>(chave: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const valor = JSON.parse(window.localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? (valor as T[]) : [];
  } catch {
    return [];
  }
}

function CabecalhoSecao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="border-b p-4">
      <h3 className="text-lg font-bold">{titulo}</h3>
      <p className="text-sm text-slate-500">{texto}</p>
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return (
    <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
      {texto}
    </p>
  );
}

function KpiCard({
  titulo,
  valor,
  destaque = "text-slate-900",
}: {
  titulo: string;
  valor: string;
  destaque?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{titulo}</p>
      <h3 className={`text-4xl font-bold ${destaque}`}>{valor}</h3>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classe =
    status === "Finalizada"
      ? "bg-green-100 text-green-700"
      : status === "Restrição"
      ? "bg-red-100 text-red-700"
      : status === "Parcial"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-blue-100 text-blue-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classe}`}>
      {status}
    </span>
  );
}

function RecursoCard({
  nome,
  previsto,
  real,
  hhDisponivel,
}: {
  nome: string;
  previsto: number;
  real: number;
  hhDisponivel: number;
}) {
  const percentual = previsto > 0 ? Math.round((real / previsto) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-bold">{nome}</h4>
        <span className="text-sm font-bold">{percentual}%</span>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${
            percentual >= 100
              ? "bg-green-500"
              : percentual >= 80
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>

      <p className="text-xs text-slate-500">
        Prev {previsto} - Real {real}
      </p>
      <p className="mt-1 text-xs font-semibold text-teal-700">
        HH disponivel: {formatarHoras(hhDisponivel)}
      </p>
    </div>
  );
}

function RestricaoCard({
  codigo,
  titulo,
  responsavel,
  observacao,
  prazo,
  criticidade,
  status,
}: {
  codigo: string;
  titulo: string;
  responsavel: string;
  observacao: string;
  prazo: string;
  criticidade: string;
  status: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-600">
          {codigo}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-red-500">
          {criticidade}
        </span>
      </div>
      <h4 className="mb-3 text-lg font-bold">{titulo}</h4>
      <p className="mb-3 rounded-lg bg-white p-2 text-sm font-semibold text-red-700">
        {observacao}
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white p-2">
          <p className="text-xs text-slate-500">Responsável</p>
          <p className="font-semibold">{responsavel}</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-xs text-slate-500">Status</p>
          <p className="font-semibold">{status}</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-xs text-slate-500">Data</p>
          <p className="font-semibold">{prazo}</p>
        </div>
      </div>
    </div>
  );
}