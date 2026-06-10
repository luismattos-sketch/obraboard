"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade, AtividadeRecurso, PrioridadeAtividade } from "../../lib/types";
import {
  cadastroBaseEvento,
  cadastroDadosObraInicial,
  carregarCadastroBase,
  getContextoAtual,
  obterDadosObra,
  sincronizarCadastroBaseRemoto,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";
import {
  calcularAvancoReal,
  calcularPpc,
  calcularTempoTurno,
  chaveTurno,
  encerrarControleTurno,
  definirStatusPorAvanco,
  iniciarControleTurno,
  obterControleTurno,
  obterFarolOperacional,
  pertenceAoTurno,
  pausarControleTurno,
  turnoEstaEncerrado,
  type ControlesTurno,
  type FechamentosTurno,
  type RestricaoHistorico,
} from "../../lib/operacao";
import {
  carregarControlesTurnoRemotos,
  carregarFechamentosTurnoRemotos,
  carregarValidacoesCheckoutRemotas,
  listarRestricoesHistoricoRemoto,
  registrarRestricaoHistoricoRemoto,
  salvarControleTurnoRemoto,
  salvarValidacaoCheckoutRemota,
} from "../../lib/operacao-remota";

const dataHoje = () => new Date().toISOString().slice(0, 10);
const unidades = ["un", "m", "m2", "m3", "kg", "t", "peca", "suporte", "base", "equipamento", "linha", "lance"];

type TratativaRestricao = {
  prioridade: PrioridadeAtividade;
  disciplina: string;
  atividade: string;
  local: string;
  responsavel: string;
  previsto: string;
  unidade: string;
  tempoPrevistoHoras: string;
};

export default function CheckoutPage() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem frente selecionada");
  const [turnosCadastrados, setTurnosCadastrados] = useState<
    TurnoCadastrado[]
  >([]);
  const [turno, setTurno] = useState("");
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [atividadeEditandoId, setAtividadeEditandoId] = useState<number | null>(null);
  const [recursosPorAtividade, setRecursosPorAtividade] = useState<
    Record<number, AtividadeRecurso[]>
  >({});
  const [validacoes, setValidacoes] = useState<Record<string, true>>({});
  const [fechamentos, setFechamentos] = useState<FechamentosTurno>({});
  const [controlesTurno, setControlesTurno] = useState<ControlesTurno>({});
  const [agora, setAgora] = useState(() => new Date());
  const [restricoesHistorico, setRestricoesHistorico] = useState<RestricaoHistorico[]>([]);
  const [tratativasRestricoes, setTratativasRestricoes] = useState<
    Record<string, TratativaRestricao>
  >({});
  const [edicao, setEdicao] = useState({
    previsto: "",
    realizado: "",
    tempoPrevistoHoras: "",
    responsavel: "",
  });

  const turnoSelecionado = useMemo(
    () => turnosCadastrados.find((item) => item.nome === turno) ?? null,
    [turno, turnosCadastrados]
  );
  const dataTurnoAtual = obterDataTurnoAtual(
    turno
      ? atividadesBanco.filter((item) =>
          pertenceAoTurno(item, {
            obraId,
            turnoId: turnoSelecionado?.id ?? null,
            turno,
          })
        )
      : atividadesBanco
  );
  const dataTurnoOperacional = dataTurnoAtual ?? dataHoje();
  const atividades = useMemo(
    () =>
      atividadesBanco.filter(
        (item) =>
          (!dataTurnoAtual || item.data_turno === dataTurnoAtual) &&
          (!turno ||
            pertenceAoTurno(item, {
              obraId,
              turnoId: turnoSelecionado?.id ?? null,
              turno,
              dataTurno: dataTurnoAtual,
            }))
      ),
    [atividadesBanco, dataTurnoAtual, obraId, turno, turnoSelecionado]
  );
  const restricoesAtivas = useMemo(
    () =>
      restricoesHistorico.filter((item) =>
        ["aberta", "parada"].includes(item.status)
      ),
    [restricoesHistorico]
  );
  const restricoesTratativa = useMemo(
    () =>
      restricoesAtivas.map((restricao) => ({
        restricao,
        atividade:
          atividades.find((item) => item.id === restricao.atividadeId) ?? null,
      })),
    [atividades, restricoesAtivas]
  );
  const farois = atividades.map((item) =>
    obterFarolOperacional(
      item.status,
      calcularAvancoReal(item.previsto, item.realizado)
    )
  );
  const finalizadas = farois.filter((farol) => farol.startsWith("Conclu")).length;
  const parciais = farois.filter((farol) => farol === "Parcial").length;
  const totalPlanejadas = atividades.length;
  const ppc = calcularPpc(atividades);
  const turnoEncerrado = turnoEstaEncerrado(
    fechamentos,
    obraId,
    dataTurnoOperacional,
    turno
  );
  const controleTurno = obterControleTurno(
    controlesTurno,
    obraId,
    dataTurnoOperacional,
    turno
  );
  const tempoDecorridoMs = calcularTempoTurno(controleTurno, agora.getTime());
  const statusOperacao = turnoEncerrado
    ? "encerrado"
    : controleTurno?.status ?? "planejado";
  const statusTurno = turnoEncerrado
    ? "Turno encerrado"
    : controleTurno?.status === "pausado"
    ? "Turno pausado"
    : controleTurno?.status === "em_andamento"
    ? "Turno em andamento"
    : controleTurno?.status === "publicado"
    ? "Turno publicado"
    : "Turno planejado";

  async function carregarRecursosAtividades(atividadesCarregadas: Atividade[]) {
    const ids = atividadesCarregadas.map((item) => item.id);

    if (ids.length === 0) {
      setRecursosPorAtividade({});
      return;
    }

    const { data, error } = await supabase
      .from("atividade_recursos")
      .select("*")
      .in("atividade_id", ids);

    if (error) {
      console.warn("Recursos planejados indisponiveis no checkout.", error);
      setRecursosPorAtividade({});
      return;
    }

    setRecursosPorAtividade(
      ((data || []) as AtividadeRecurso[]).reduce<Record<number, AtividadeRecurso[]>>(
        (mapa, recurso) => {
          mapa[recurso.atividade_id] = [
            ...(mapa[recurso.atividade_id] ?? []),
            recurso,
          ];
          return mapa;
        },
        {}
      )
    );
  }

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 1000);

    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    async function carregarAtividades(obraAtualId: number | null) {
      if (!obraAtualId) {
        setAtividadesBanco([]);
        setCarregando(false);
        return;
      }

      setCarregando(true);

      const { data } = await supabase
        .from("atividades")
        .select("*")
        .eq("obra_id", obraAtualId)
        .order("id", { ascending: true });

      const carregadas = (data || []) as Atividade[];
      setAtividadesBanco(carregadas);
      setValidacoes(
        await carregarValidacoesCheckoutRemotas(carregadas.map((item) => item.id))
      );
      await carregarRecursosAtividades(carregadas);
      setCarregando(false);
    }

    async function carregarEstadoOperacaoRemoto(obraIdAtual: number | null) {
      const [controles, fechamentosRemotos] = await Promise.all([
        carregarControlesTurnoRemotos(obraIdAtual),
        carregarFechamentosTurnoRemotos(obraIdAtual),
      ]);

      setControlesTurno(controles);
      setFechamentos(fechamentosRemotos);
    }

    function carregarContextoObra(cadastro = carregarCadastroBase()) {
      const parametros = new URLSearchParams(window.location.search);
      const contexto = getContextoAtual(cadastro, {
        obraId: parametros.get("obraId"),
        turnoId: parametros.get("turnoId"),
      });
      const obraAtiva = contexto.obraAtiva;
      const obraResolvidaId = contexto.obraAtivaId ?? contexto.obraIdParametro ?? null;
      const dadosObra = obraAtiva
        ? obterDadosObra(cadastro, obraAtiva.id)
        : cadastroDadosObraInicial;

      setObraId(obraResolvidaId);
      setObra(
        obraAtiva?.nome ??
          (obraResolvidaId ? "Frente informada no link" : "Sem frente selecionada")
      );
      setTurnosCadastrados(dadosObra.turnos);
      setTurno(contexto.turnoAtivo?.nome ?? "");
      void carregarAtividades(obraResolvidaId);
      void carregarEstadoOperacaoRemoto(obraResolvidaId);
    }

    async function carregarContextoObraRemoto() {
      carregarContextoObra(await sincronizarCadastroBaseRemoto());
    }

    function carregarContextoObraLocal() {
      carregarContextoObra();
    }

    queueMicrotask(() => {
      void carregarContextoObraRemoto();
    });
    window.addEventListener(cadastroBaseEvento, carregarContextoObraLocal);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObraLocal);
    };
  }, []);

  useEffect(() => {
    async function carregarRestricoesCheckout() {
      if (!obraId || !dataTurnoAtual || !turno) {
        setRestricoesHistorico([]);
        return;
      }

      setRestricoesHistorico(
        await listarRestricoesHistoricoRemoto(
          obraId,
          dataTurnoAtual,
          turno,
          turnoSelecionado?.id ?? null
        )
      );
    }

    void carregarRestricoesCheckout();
  }, [obraId, dataTurnoAtual, turno, turnoSelecionado]);

  useEffect(() => {
    queueMicrotask(() => {
      setTratativasRestricoes((atuais) => {
        const proximo = { ...atuais };

        restricoesTratativa.forEach(({ restricao, atividade }) => {
          if (!proximo[restricao.id]) {
            proximo[restricao.id] = criarTratativaRestricao(restricao, atividade);
          }
        });

        return proximo;
      });
    });
  }, [restricoesTratativa]);

  async function recarregarAtividades() {
    if (!obraId) {
      return;
    }

    const { data } = await supabase
      .from("atividades")
      .select("*")
      .eq("obra_id", obraId)
      .order("id", { ascending: true });

    const carregadas = (data || []) as Atividade[];
    setAtividadesBanco(carregadas);
    setValidacoes(
      await carregarValidacoesCheckoutRemotas(carregadas.map((item) => item.id))
    );
    await carregarRecursosAtividades(carregadas);
  }

  function iniciarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");
    setValidacoes((atuais) => {
      const novos = { ...atuais };
      delete novos[String(item.id)];
      void salvarValidacaoCheckoutRemota(item, false);
      return novos;
    });
    setAtividadeEditandoId(item.id);
    setEdicao({
      previsto: String(item.previsto || ""),
      realizado: String(item.realizado || ""),
      tempoPrevistoHoras: String(item.tempo_previsto_horas || ""),
      responsavel: item.responsavel || "",
    });
  }

  function atualizarTratativaRestricao(
    restricaoId: string,
    campo: keyof TratativaRestricao,
    valor: string
  ) {
    setTratativasRestricoes((atuais) => ({
      ...atuais,
      [restricaoId]: {
        ...atuais[restricaoId],
        [campo]: valor,
      } as TratativaRestricao,
    }));
  }

  async function salvarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");

    const previsto = normalizarNumeroCheckout(edicao.previsto);
    const realizado = normalizarNumeroCheckout(edicao.realizado);
    const tempoPrevistoHoras = normalizarNumeroCheckout(edicao.tempoPrevistoHoras);
    const progresso =
      calcularAvancoReal(previsto, realizado);
    const status = definirStatusPorAvanco(previsto, realizado);

    const { error } = await supabase
      .from("atividades")
      .update({
        previsto,
        realizado,
        progresso,
        status,
        responsavel: edicao.responsavel,
        tempo_previsto_horas: tempoPrevistoHoras,
      })
      .eq("id", item.id)
      .eq("obra_id", obraId)
      .eq("turno", turno);

    if (error) {
      console.error(error);
      setErro("Erro ao salvar ajuste do planejado.");
      return;
    }

    setAtividadeEditandoId(null);
    setMensagem("Planejado ajustado.");
    await recarregarAtividades();
  }

  async function validarAtividade(item: Atividade) {
    setMensagem("");
    setErro("");

    const realizado = normalizarNumeroCheckout(item.realizado);
    const previsto = normalizarNumeroCheckout(item.previsto);
    const progresso = calcularAvancoReal(previsto, realizado);
    const status = definirStatusPorAvanco(previsto, realizado);

    const { error } = await supabase
      .from("atividades")
      .update({
        realizado,
        progresso,
        status,
      })
      .eq("id", item.id)
      .eq("obra_id", obraId)
      .eq("turno", turno);

    if (error) {
      console.error(error);
      setErro("Erro ao validar atividade.");
      return;
    }

    const novasValidacoes = { ...validacoes, [String(item.id)]: true as const };
    setValidacoes(novasValidacoes);
    await salvarValidacaoCheckoutRemota(item, true);
    setMensagem("Atividade validada.");
    await recarregarAtividades();
  }

  async function reprogramarPendencias() {
    setMensagem("");
    setErro("");

    if (!obraId || !dataTurnoAtual || !turno) {
      setErro("Selecione frente, data e turno antes de reprogramar.");
      return;
    }

    const destinoReprogramacao = obterDestinoReprogramacao(
      turno,
      dataTurnoAtual,
      turnosCadastrados
    );

    if (!destinoReprogramacao) {
      setErro("Não existe próximo turno cadastrado.");
      return;
    }

    const { turno: proximoTurno, dataTurno: dataTurnoDestino } =
      destinoReprogramacao;

    const pendentes = atividades.filter(
      (item) => calcularAvancoReal(item.previsto, item.realizado) < 100
    );
    let criadas = 0;

    for (const item of pendentes) {
      const restante = Math.max(
        normalizarNumeroCheckout(item.previsto) - normalizarNumeroCheckout(item.realizado),
        0
      );

      if (restante <= 0) {
        continue;
      }

      const { data: existente } = await supabase
        .from("atividades")
        .select("id")
        .eq("obra_id", obraId)
        .eq("origem_atividade_id", item.id)
        .eq("turno_id", proximoTurno.id)
        .eq("turno", proximoTurno.nome)
        .eq("data_turno", dataTurnoDestino)
        .maybeSingle();

      if (existente?.id) {
        continue;
      }

      const { data: nova, error } = await supabase
        .from("atividades")
        .insert([
          {
            obra_id: obraId,
            turno_id: proximoTurno.id,
            prioridade: item.prioridade,
            disciplina: item.disciplina,
            atividade: `${item.atividade} (reprogramada)`,
            local: item.local,
            responsavel: item.responsavel,
            previsto: restante,
            realizado: 0,
            unidade: item.unidade,
            tempo_previsto_horas: item.tempo_previsto_horas,
            status: "Planejada",
            progresso: 0,
            turno: proximoTurno.nome,
            data_turno: dataTurnoDestino,
            origem_atividade_id: item.id,
          },
        ])
        .select("id")
        .single();

      if (error || !nova?.id) {
        console.error(error);
        setErro("Erro ao reprogramar pendências.");
        return;
      }

      const recursos = recursosPorAtividade[item.id] ?? [];
      if (recursos.length > 0) {
        await supabase.from("atividade_recursos").insert(
          recursos.map((recurso) => ({
            atividade_id: nova.id,
            funcao: recurso.funcao,
            quantidade_prevista: recurso.quantidade_prevista,
          }))
        );
      }

      const restricoesRemotas = await listarRestricoesHistoricoRemoto(
        obraId,
        dataTurnoAtual,
        turno,
        turnoSelecionado?.id ?? null
      );
      await Promise.all(
        restricoesRemotas
        .filter(
          (restricao) =>
            restricao.atividadeId === item.id &&
            ["aberta", "reprogramada"].includes(restricao.status)
        )
        .map((restricao) =>
          registrarRestricaoHistoricoRemoto(
            {
              ...item,
              id: nova.id,
              data_turno: dataTurnoDestino,
              turno: proximoTurno.nome,
              turno_id: proximoTurno.id,
            },
            restricao.texto,
            "reprogramada"
          )
        )
      );
      criadas += 1;
    }

    for (const { restricao, atividade: atividadeOriginal } of restricoesTratativa) {
      const tratativa = tratativasRestricoes[restricao.id];

      if (!tratativa) {
        continue;
      }

      const previstoTratativa = normalizarNumeroCheckout(tratativa.previsto);
      const tempoTratativa = normalizarNumeroCheckout(tratativa.tempoPrevistoHoras);

      if (
        !tratativa.atividade ||
        !tratativa.disciplina ||
        !tratativa.local ||
        !tratativa.responsavel ||
        previstoTratativa <= 0 ||
        tempoTratativa <= 0
      ) {
        setErro("Preencha todos os campos da tratativa de restrição antes de reprogramar.");
        return;
      }

      const origemAtividadeId = atividadeOriginal?.id ?? restricao.atividadeId;
      const { data: existente } = await supabase
        .from("atividades")
        .select("id")
        .eq("obra_id", obraId)
        .eq("origem_atividade_id", origemAtividadeId)
        .eq("turno_id", proximoTurno.id)
        .eq("turno", proximoTurno.nome)
        .eq("data_turno", dataTurnoDestino)
        .eq("atividade", tratativa.atividade)
        .maybeSingle();

      if (existente?.id) {
        continue;
      }

      const { data: nova, error } = await supabase
        .from("atividades")
        .insert([
          {
            obra_id: obraId,
            turno_id: proximoTurno.id,
            prioridade: tratativa.prioridade,
            disciplina: tratativa.disciplina,
            atividade: tratativa.atividade,
            local: tratativa.local,
            responsavel: tratativa.responsavel,
            previsto: previstoTratativa,
            realizado: 0,
            unidade: tratativa.unidade,
            tempo_previsto_horas: tempoTratativa,
            status: "Planejada",
            progresso: 0,
            turno: proximoTurno.nome,
            data_turno: dataTurnoDestino,
            origem_atividade_id: origemAtividadeId,
          },
        ])
        .select("id")
        .single();

      if (error || !nova?.id) {
        console.error(error);
        setErro("Erro ao reprogramar tratativa de restrição.");
        return;
      }

      const recursos = atividadeOriginal ? recursosPorAtividade[atividadeOriginal.id] ?? [] : [];
      if (recursos.length > 0) {
        await supabase.from("atividade_recursos").insert(
          recursos.map((recurso) => ({
            atividade_id: nova.id,
            funcao: recurso.funcao,
            quantidade_prevista: recurso.quantidade_prevista,
          }))
        );
      }

      await registrarRestricaoHistoricoRemoto(
        atividadeOriginal ?? criarAtividadeBaseRestricao(restricao),
        restricao.texto,
        "reprogramada",
        restricao.id
      );

      criadas += 1;
    }

    setMensagem(
      `${criadas} pendências reprogramadas para ${proximoTurno.nome} em ${formatarDataTurno(dataTurnoDestino)}.`
    );
    await recarregarAtividades();
  }

  function encerrarTurno() {
    setErro("");

    if (!obraId || !turno) {
      setErro(
        !obraId
          ? "Selecione uma frente no menu lateral para continuar."
          : "Selecione ou publique um turno no Checkin para continuar."
      );
      return;
    }

    const novosControles = encerrarControleTurno(
      controlesTurno,
      obraId,
      dataTurnoOperacional,
      turno
    );
    const controleEncerrado = obterControleTurno(
      novosControles,
      obraId,
      dataTurnoOperacional,
      turno
    );
    const chave = chaveTurno(obraId, dataTurnoOperacional, turno);
    const novosFechamentos = {
      ...fechamentos,
      [chave]: {
        encerradoEm: controleEncerrado?.encerradoEm ?? new Date().toISOString(),
        rdoGeradoEm: controleEncerrado?.rdoGeradoEm ?? new Date().toISOString(),
        tempoFinalMs: calcularTempoTurno(controleEncerrado),
      },
    };

    gravarControlesTurno(novosControles);
    setFechamentos(novosFechamentos);
    setMensagem("Turno encerrado e RDO gerado automaticamente.");
  }

  function gravarControlesTurno(novosControles: ControlesTurno) {
    setControlesTurno(novosControles);
    const controle = obterControleTurno(novosControles, obraId, dataTurnoOperacional, turno);

    if (obraId && dataTurnoOperacional && turno && controle) {
      void salvarControleTurnoRemoto(
        obraId,
        dataTurnoOperacional,
        turno,
        turnoSelecionado?.id ?? null,
        controle
      );
    }
  }

  function pararTurnoCheckout() {
    if (!obraId || !dataTurnoOperacional || !turno) {
      setErro("Selecione ou publique um turno no Checkin para continuar.");
      return;
    }

    gravarControlesTurno(
      pausarControleTurno(controlesTurno, obraId, dataTurnoOperacional, turno)
    );
    setMensagem("Turno pausado.");
  }

  function continuarTurnoCheckout() {
    if (!obraId || !dataTurnoOperacional || !turno) {
      setErro("Selecione ou publique um turno no Checkin para continuar.");
      return;
    }

    gravarControlesTurno(
      iniciarControleTurno(controlesTurno, obraId, dataTurnoOperacional, turno)
    );
    setMensagem("Turno retomado.");
  }

  return (
    <DesktopLayout
      titulo="Check-out do Turno"
      subtitulo={`Frente: ${obra} - Turno ${turno || "-"} - Data: ${
        dataTurnoOperacional ? formatarDataTurno(dataTurnoOperacional) : "-"
      }`}
      status={statusTurno}
      statusTom={turnoEncerrado ? "encerrado" : "andamento"}
      infoCentral={formatarRelogioTurno(agora)}
      detalheCentral={`Decorrido ${formatarDuracao(tempoDecorridoMs)}`}
    >
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Frente ativa: {obra} · {statusTurno}
          </div>

          {mensagem && (
            <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {mensagem}
            </div>
          )}

          {erro && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          {!obraId && (
            <EstadoVazio texto="Selecione uma frente no menu lateral para continuar." />
          )}

          {obraId && !turno && (
            <EstadoVazio texto="Selecione ou publique um turno no Checkin para continuar." />
          )}

          <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Turno ativo</p>
            <p className="mt-1 font-bold text-slate-900">{turno || "-"}</p>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(140px,180px)_minmax(160px,220px)_1fr] md:items-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Hora atual</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatarRelogioTurno(agora)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-500">
                Tempo decorrido
              </p>
              <p className="mt-1 text-xl font-bold text-teal-700">
                {formatarDuracao(tempoDecorridoMs)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
              {statusOperacao === "em_andamento" ? (
                <button
                  type="button"
                  onClick={pararTurnoCheckout}
                  className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-yellow-600"
                >
                  Parar Turno
                </button>
              ) : statusOperacao === "pausado" ? (
                <button
                  type="button"
                  onClick={continuarTurnoCheckout}
                  className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
                >
                  Continuar Turno
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <ResumoCard titulo="Planejadas" valor={String(totalPlanejadas)} />
          <ResumoCard
            titulo="Concluídas"
            valor={String(finalizadas)}
            destaque="text-green-600"
          />
          <ResumoCard
            titulo="Parciais"
            valor={String(parciais)}
            destaque="text-yellow-500"
          />
          <ResumoCard
            titulo="Restrições"
            valor={String(restricoesTratativa.length)}
            destaque="text-red-500"
          />
          <ResumoCard titulo="PPC" valor={`${ppc}%`} destaque="text-blue-600" />
        </div>

        <section className="rounded-2xl bg-white shadow-sm">
          <CabecalhoSecao
            titulo="Validação das atividades"
            texto="Atividades carregadas da frente ativa para o turno selecionado"
          />

          {carregando ? (
            <div className="p-4">
              <EstadoVazio texto="Carregando atividades..." />
            </div>
          ) : atividades.length === 0 ? (
            <div className="p-4">
              <EstadoVazio texto="Nenhuma atividade para fechar nesta frente e turno." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead className="bg-slate-50 text-sm">
                  <tr>
                    <th className="p-3 text-left">Pri</th>
                    <th className="p-3 text-left">Disc</th>
                    <th className="p-3 text-left">Atividade</th>
                    <th className="p-3 text-left">Local</th>
                    <th className="p-3 text-left">Resp</th>
                    <th className="p-3 text-left">Avanço</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Farol</th>
                    <th className="p-3 text-center">Decisão</th>
                  </tr>
                </thead>

                <tbody>
                  {atividades.map((item) => {
                    const progresso = calcularProgresso(item);
                    const farol = obterFarolOperacional(item.status, progresso);
                    const editando = atividadeEditandoId === item.id;
                    const validada = Boolean(validacoes[String(item.id)]);

                    return (
                      <tr
                        key={item.id}
                        className="border-t text-sm hover:bg-slate-50"
                      >
                        <td className="p-3">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold ${
                              item.prioridade === "A"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.prioridade}
                          </span>
                        </td>

                        <td className="p-3 font-semibold">{item.disciplina}</td>
                        <td className="p-3 font-medium">{item.atividade}</td>
                        <td className="p-3">{item.local}</td>
                        <td className="p-3">
                          {editando ? (
                            <input
                              value={edicao.responsavel}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  responsavel: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                            />
                          ) : (
                            item.responsavel
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full ${
                                  progresso >= 100
                                    ? "bg-green-500"
                                    : progresso >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs font-bold">
                              {progresso}%
                            </span>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="p-3 text-center text-xs font-bold">{farol}</td>
                        <td className="p-3">
                          {editando ? (
                            <div className="grid gap-2">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                <label className="block text-left text-[11px] font-bold uppercase text-slate-500">
                                  Previsto
                                  <input
                                    value={edicao.previsto}
                                    onChange={(e) =>
                                      setEdicao((atual) => ({
                                        ...atual,
                                        previsto: e.target.value,
                                      }))
                                    }
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs normal-case text-slate-700"
                                    placeholder="Quantidade prevista"
                                  />
                                </label>
                                <label className="block text-left text-[11px] font-bold uppercase text-slate-500">
                                  Realizado
                                  <input
                                    value={edicao.realizado}
                                    onChange={(e) =>
                                      setEdicao((atual) => ({
                                        ...atual,
                                        realizado: e.target.value,
                                      }))
                                    }
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs normal-case text-slate-700"
                                    placeholder="Quantidade realizada"
                                  />
                                </label>
                                <label className="block text-left text-[11px] font-bold uppercase text-slate-500">
                                  HH previsto
                                  <input
                                    value={edicao.tempoPrevistoHoras}
                                    onChange={(e) =>
                                      setEdicao((atual) => ({
                                        ...atual,
                                        tempoPrevistoHoras: e.target.value,
                                      }))
                                    }
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs normal-case text-slate-700"
                                    placeholder="Horas previstas"
                                  />
                                </label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAtividadeEditandoId(null)}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => salvarEdicao(item)}
                                  className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(item)}
                                disabled={turnoEncerrado}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => validarAtividade(item)}
                                disabled={validada || turnoEncerrado}
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {validada ? "Validado" : "Validar"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <CabecalhoSecao
            titulo="Tratativa de Restrições"
            texto="Pendências reais do turno atual"
          />

          {restricoesTratativa.length === 0 ? (
            <div className="pt-4">
              <EstadoVazio texto="Nenhuma restrição registrada para este turno." />
            </div>
          ) : (
            <div className="grid gap-4 pt-4 lg:grid-cols-2">
              {restricoesTratativa.map(({ restricao, atividade }) => {
                const item = atividade ?? criarAtividadeBaseRestricao(restricao);
                const tratativa = tratativasRestricoes[restricao.id];

                if (!tratativa) {
                  return null;
                }

                return (
                <div
                  key={restricao.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                      R{restricao.atividadeId}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-red-700">
                      Impacto {item.prioridade === "A" ? "Alto" : "Médio"}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900">{item.atividade}</h4>
                  <p className="mt-2 rounded-lg border border-red-200 bg-white p-2 text-sm font-semibold text-red-700">
                    Restrição: {restricao.texto || "Sem descrição"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Responsável atual:{" "}
                    <span className="font-semibold text-red-600">
                      {item.responsavel}
                    </span>
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-6">
                    <label className="block text-xs font-bold uppercase text-slate-500 md:col-span-1">
                      Pri
                      <select
                        value={tratativa.prioridade}
                        onChange={(e) =>
                          atualizarTratativaRestricao(
                            restricao.id,
                            "prioridade",
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm normal-case text-slate-700"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </label>
                    <CampoTratativa
                      label="Disciplina"
                      value={tratativa.disciplina}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(restricao.id, "disciplina", valor)
                      }
                      className="md:col-span-2"
                    />
                    <CampoTratativa
                      label="Atividade"
                      value={tratativa.atividade}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(restricao.id, "atividade", valor)
                      }
                      className="md:col-span-3"
                    />
                    <CampoTratativa
                      label="Local"
                      value={tratativa.local}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(restricao.id, "local", valor)
                      }
                      className="md:col-span-2"
                    />
                    <CampoTratativa
                      label="Responsável"
                      value={tratativa.responsavel}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(restricao.id, "responsavel", valor)
                      }
                      className="md:col-span-2"
                    />
                    <CampoTratativa
                      label="Previsão"
                      value={tratativa.previsto}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(restricao.id, "previsto", valor)
                      }
                      type="number"
                      className="md:col-span-1"
                    />
                    <label className="block text-xs font-bold uppercase text-slate-500 md:col-span-1">
                      Unidade
                      <select
                        value={tratativa.unidade}
                        onChange={(e) =>
                          atualizarTratativaRestricao(
                            restricao.id,
                            "unidade",
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm normal-case text-slate-700"
                      >
                        {unidades.map((unidade) => (
                          <option key={unidade} value={unidade}>
                            {unidade}
                          </option>
                        ))}
                      </select>
                    </label>
                    <CampoTratativa
                      label="Tempo previsto"
                      value={tratativa.tempoPrevistoHoras}
                      onChange={(valor) =>
                        atualizarTratativaRestricao(
                          restricao.id,
                          "tempoPrevistoHoras",
                          valor
                        )
                      }
                      type="number"
                      className="md:col-span-1"
                    />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">Resumo do fechamento</h3>
            <textarea
              className="min-h-[130px] w-full rounded-xl border border-slate-300 p-4 text-sm"
              placeholder="Registrar resumo do checkout, decisões, pendências e pontos para o próximo turno..."
            />
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">Ações finais</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={reprogramarPendencias}
                disabled={turnoEncerrado}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left font-semibold transition-colors hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-inherit"
              >
                Reprogramar para o próximo turno
              </button>
              <button
                type="button"
                onClick={encerrarTurno}
                disabled={turnoEncerrado}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
              >
                {turnoEncerrado ? "Turno encerrado" : "Encerrar turno"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </DesktopLayout>
  );
}

function CampoTratativa({
  label,
  value,
  onChange,
  className = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  type?: "text" | "number";
}) {
  return (
    <label className={`block text-xs font-bold uppercase text-slate-500 ${className}`}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm normal-case text-slate-700"
      />
    </label>
  );
}

function criarTratativaRestricao(
  restricao: RestricaoHistorico,
  atividade: Atividade | null
): TratativaRestricao {
  return {
    prioridade: atividade?.prioridade ?? "A",
    disciplina: atividade?.disciplina ?? "",
    atividade: `${atividade?.atividade ?? restricao.atividade} - tratativa`,
    local: atividade?.local ?? "",
    responsavel: atividade?.responsavel ?? restricao.responsavel ?? "",
    previsto: String(atividade?.previsto || 1),
    unidade: atividade?.unidade || "un",
    tempoPrevistoHoras: String(atividade?.tempo_previsto_horas || 1),
  };
}

function criarAtividadeBaseRestricao(restricao: RestricaoHistorico): Atividade {
  return {
    id: restricao.atividadeId,
    obra_id: restricao.obraId,
    prioridade: "A",
    disciplina: "",
    atividade: restricao.atividade,
    local: "",
    responsavel: restricao.responsavel,
    previsto: 1,
    realizado: 0,
    unidade: "un",
    tempo_previsto_horas: 1,
    origem_atividade_id: null,
    turno_id: restricao.turnoId,
    status: "Planejada",
    progresso: 0,
    turno: restricao.turno,
    data_turno: restricao.dataTurno,
  };
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

function calcularProgresso(item: Atividade) {
  return calcularAvancoReal(item.previsto, item.realizado);
}

function obterDestinoReprogramacao(
  turnoAtual: string,
  dataTurnoAtual: string,
  turnos: TurnoCadastrado[]
) {
  if (turnos.length < 2) {
    return null;
  }

  const indiceAtual = turnos.findIndex((item) => item.nome === turnoAtual);
  const proximoIndice =
    indiceAtual >= 0 ? (indiceAtual + 1) % turnos.length : 0;
  const mudouDia = indiceAtual >= 0 && proximoIndice <= indiceAtual;
  const dataTurno = mudouDia
    ? somarDiasDataIso(dataTurnoAtual, 1)
    : dataTurnoAtual;
  const proximoTurno = turnos[proximoIndice] ?? null;

  if (!proximoTurno) {
    return null;
  }

  return {
    turno: proximoTurno,
    dataTurno,
  };
}

function somarDiasDataIso(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);

  if (!ano || !mes || !dia) {
    return dataIso;
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia + dias, 12));

  return data.toISOString().slice(0, 10);
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

function normalizarNumeroCheckout(valor: string | number | null | undefined) {
  const texto = String(valor ?? "0").trim().replace(",", ".");
  const numero = Number(texto || 0);

  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
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
    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
      {texto}
    </p>
  );
}

function ResumoCard({
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
