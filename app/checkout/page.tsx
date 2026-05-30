"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade, AtividadeRecurso } from "../../lib/types";
import {
  cadastroBaseEvento,
  cadastroDadosObraInicial,
  carregarCadastroBase,
  getContextoAtual,
  obterDadosObra,
  salvarTurnoAtivo,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";
import {
  calcularAvancoReal,
  calcularPpc,
  calcularTempoTurno,
  chaveTurno,
  checkoutFechamentosStorageKey,
  checkoutValidacoesStorageKey,
  encerrarControleTurno,
  definirStatusPorAvanco,
  iniciarControleTurno,
  listarRestricoesHistorico,
  obterControleTurno,
  obterFarolOperacional,
  pertenceAoTurno,
  pausarControleTurno,
  registrarRestricaoHistorico,
  salvarObjetoLocal,
  carregarObjetoLocal,
  turnoEstaEncerrado,
  turnosOperacaoStorageKey,
  type ControlesTurno,
  type FechamentosTurno,
} from "../../lib/operacao";

const dataHoje = () => new Date().toISOString().slice(0, 10);

export default function CheckoutPage() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
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
  const [validacoes, setValidacoes] = useState<Record<string, true>>(() =>
    carregarObjetoLocal(checkoutValidacoesStorageKey, {})
  );
  const [fechamentos, setFechamentos] = useState<FechamentosTurno>(() =>
    carregarObjetoLocal(checkoutFechamentosStorageKey, {})
  );
  const [controlesTurno, setControlesTurno] = useState<ControlesTurno>(() =>
    carregarObjetoLocal(turnosOperacaoStorageKey, {})
  );
  const [agora, setAgora] = useState(() => new Date());
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
  const restricoes = atividades.filter((item) => item.status === "Restrição");
  const finalizadas = atividades.filter((item) => calcularAvancoReal(item.previsto, item.realizado) >= 100).length;
  const parciais = contarStatus(atividades, "Parcial");
  const planejadas = contarStatus(atividades, "Planejada");
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
      await carregarRecursosAtividades(carregadas);
      setCarregando(false);
    }

    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const contexto = getContextoAtual(cadastro);
      const obraAtiva = contexto.obraAtiva;
      const obraResolvidaId = contexto.obraAtivaId;
      const dadosObra = obraAtiva
        ? obterDadosObra(cadastro, obraAtiva.id)
        : cadastroDadosObraInicial;

      setObraId(obraResolvidaId);
      setObra(
        obraAtiva?.nome ??
          (obraResolvidaId ? "Obra informada no link" : "Sem obra selecionada")
      );
      setTurnosCadastrados(dadosObra.turnos);
      setTurno(contexto.turnoAtivo?.nome ?? "");
      setFechamentos(carregarObjetoLocal(checkoutFechamentosStorageKey, {}));
      setControlesTurno(carregarObjetoLocal(turnosOperacaoStorageKey, {}));
      void carregarAtividades(obraResolvidaId);
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
  }, []);

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
    await carregarRecursosAtividades(carregadas);
  }

  function iniciarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");
    setValidacoes((atuais) => {
      const novos = { ...atuais };
      delete novos[String(item.id)];
      salvarObjetoLocal(checkoutValidacoesStorageKey, novos);
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

  async function salvarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");

    const previsto = Number(edicao.previsto || 0);
    const realizado = Number(edicao.realizado || 0);
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
        tempo_previsto_horas: Number(edicao.tempoPrevistoHoras || 0),
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

    const realizado = Number(item.realizado || 0);
    const previsto = Number(item.previsto || 0);
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
    salvarObjetoLocal(checkoutValidacoesStorageKey, novasValidacoes);
    setMensagem("Atividade validada.");
    await recarregarAtividades();
  }

  async function reprogramarPendencias() {
    setMensagem("");
    setErro("");

    if (!obraId || !dataTurnoAtual || !turno) {
      setErro("Selecione obra, data e turno antes de reprogramar.");
      return;
    }

    const proximoTurno = obterProximoTurno(turno, turnosCadastrados);

    if (!proximoTurno) {
      setErro("Nao existe proximo turno cadastrado.");
      return;
    }

    const pendentes = atividades.filter(
      (item) => calcularAvancoReal(item.previsto, item.realizado) < 100
    );
    let criadas = 0;

    for (const item of pendentes) {
      const restante = Math.max(Number(item.previsto || 0) - Number(item.realizado || 0), 0);

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
        .eq("data_turno", dataTurnoAtual)
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
            data_turno: dataTurnoAtual,
            origem_atividade_id: item.id,
          },
        ])
        .select("id")
        .single();

      if (error || !nova?.id) {
        console.error(error);
        setErro("Erro ao reprogramar pendencias.");
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

      listarRestricoesHistorico(obraId, dataTurnoAtual, turno)
        .filter(
          (restricao) =>
            restricao.atividadeId === item.id &&
            ["aberta", "reprogramada"].includes(restricao.status)
        )
        .forEach((restricao) =>
          registrarRestricaoHistorico(
            { ...item, id: nova.id, turno: proximoTurno.nome, turno_id: proximoTurno.id },
            restricao.texto,
            "reprogramada"
          )
        );
      criadas += 1;
    }

    window.localStorage.setItem(
      `obraboard:checkout-reprogramacao:${obraId}:${dataTurnoAtual}:${turno}`,
      JSON.stringify({ obraId, dataTurno: dataTurnoAtual, turno, pendentes: pendentes.length })
    );
    salvarTurnoAtivo(obraId, proximoTurno.nome, proximoTurno.id);
    setMensagem(`${criadas} pendencias reprogramadas para ${proximoTurno.nome}.`);
    await recarregarAtividades();
  }

  function encerrarTurno() {
    setErro("");

    if (!obraId || !turno) {
      setErro(
        !obraId
          ? "Selecione uma obra no menu lateral para continuar."
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
    salvarObjetoLocal(checkoutFechamentosStorageKey, novosFechamentos);
    window.dispatchEvent(new Event("storage"));
    setMensagem("Turno encerrado e RDO gerado automaticamente.");
  }

  function gravarControlesTurno(novosControles: ControlesTurno) {
    setControlesTurno(novosControles);
    salvarObjetoLocal(turnosOperacaoStorageKey, novosControles);
    window.dispatchEvent(new Event("storage"));
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
      subtitulo={`Obra: ${obra} - Turno ${turno || "-"} - Data: ${
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
            Obra ativa: {obra} · {statusTurno}
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
            <EstadoVazio texto="Selecione uma obra no menu lateral para continuar." />
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
          <ResumoCard titulo="Planejadas" valor={String(planejadas)} />
          <ResumoCard
            titulo="Finalizadas"
            valor={String(finalizadas)}
            destaque="text-green-600"
          />
          <ResumoCard
            titulo="Parciais"
            valor={String(parciais)}
            destaque="text-yellow-500"
          />
          <ResumoCard
            titulo="Restricoes"
            valor={String(restricoes.length)}
            destaque="text-red-500"
          />
          <ResumoCard titulo="PPC" valor={`${ppc}%`} destaque="text-blue-600" />
        </div>

        <section className="rounded-2xl bg-white shadow-sm">
          <CabecalhoSecao
            titulo="Validação das atividades"
            texto="Atividades carregadas da obra ativa para o turno selecionado"
          />

          {carregando ? (
            <div className="p-4">
              <EstadoVazio texto="Carregando atividades..." />
            </div>
          ) : atividades.length === 0 ? (
            <div className="p-4">
              <EstadoVazio texto="Nenhuma atividade para fechar nesta obra e turno." />
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
                    <th className="p-3 text-left">Avanco</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Farol</th>
                    <th className="p-3 text-center">Decisao</th>
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
                              <div className="grid grid-cols-3 gap-2">
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
                                  className="rounded-lg border border-slate-300 p-2 text-xs"
                                  placeholder="Prev."
                                />
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
                                  className="rounded-lg border border-slate-300 p-2 text-xs"
                                  placeholder="Real"
                                />
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
                                  className="rounded-lg border border-slate-300 p-2 text-xs"
                                  placeholder="HH"
                                />
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
            titulo="Tratativa de Restricoes"
            texto="Pendencias reais do turno atual"
          />

          {restricoes.length === 0 ? (
            <div className="pt-4">
              <EstadoVazio texto="Nenhuma restricao registrada para este turno." />
            </div>
          ) : (
            <div className="grid gap-4 pt-4 lg:grid-cols-2">
              {restricoes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                      R{item.id}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-red-700">
                      Impacto {item.prioridade === "A" ? "Alto" : "Médio"}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900">{item.atividade}</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Responsável atual:{" "}
                    <span className="font-semibold text-red-600">
                      {item.responsavel}
                    </span>
                  </p>
                  <textarea
                    className="mt-3 min-h-[76px] w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                    placeholder="Descreva a tratativa definida no checkout..."
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">Resumo do fechamento</h3>
            <textarea
              className="min-h-[130px] w-full rounded-xl border border-slate-300 p-4 text-sm"
              placeholder="Registrar resumo do checkout, decisoes, pendencias e pontos para o proximo turno..."
            />
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold">Ações finais</h3>
            <div className="space-y-3">
              <button
                type="button"
                onClick={reprogramarPendencias}
                disabled={turnoEncerrado}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left font-semibold"
              >
                Reprogramar para o proximo turno
              </button>
              <button
                type="button"
                onClick={encerrarTurno}
                disabled={turnoEncerrado}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
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

function calcularProgresso(item: Atividade) {
  return calcularAvancoReal(item.previsto, item.realizado);
}

function obterProximoTurno(turnoAtual: string, turnos: TurnoCadastrado[]) {
  if (turnos.length < 2) {
    return null;
  }

  const indiceAtual = turnos.findIndex((item) => item.nome === turnoAtual);
  const proximoIndice =
    indiceAtual >= 0 ? (indiceAtual + 1) % turnos.length : 0;

  return turnos[proximoIndice] ?? null;
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
