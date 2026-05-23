"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Atividade, AtualizacaoAtividade, StatusAtividade } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  salvarObraAtivaId,
  salvarTurnoAtivo,
  sincronizarCadastroBaseRemoto,
  type FuncaoPrevistaCadastrada,
  type ObraCadastrada,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";

type FiltroStatus = "Todas" | "Pendentes" | "Execução" | "Restrição" | "Finalizada";

type ControleAtividade = {
  elapsedMs: number;
  runningSince: number | null;
};

type RestricaoAtividade = {
  texto: string;
  status: "aberta" | "resolvida" | "parada";
};

type MaoObraReal = {
  id: number;
  atividade_id?: number | null;
  funcao: string | null;
  quantidade: number | null;
};

const dataHoje = () => new Date().toISOString().slice(0, 10);
const controleStorageKey = "obraboard:campo-controles";
const restricaoStorageKey = "obraboard:campo-restricoes";
const maoObraLocalStorageKey = "obraboard:mao-obra-local";

export default function CampoPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [obrasCadastradas, setObrasCadastradas] = useState<ObraCadastrada[]>([]);
  const [turnosCadastrados, setTurnosCadastrados] = useState<TurnoCadastrado[]>([]);
  const [funcoesPrevistasCadastradas, setFuncoesPrevistasCadastradas] =
    useState<FuncaoPrevistaCadastrada[]>([]);
  const [turno, setTurno] = useState("Dia");
  const [filtro, setFiltro] = useState<FiltroStatus>("Todas");
  const [atividadeMaoObraId, setAtividadeMaoObraId] = useState<number | null>(null);
  const [funcao, setFuncao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [controles, setControles] = useState<Record<number, ControleAtividade>>(
    () => carregarObjetoLocal(controleStorageKey)
  );
  const [restricoes, setRestricoes] = useState<Record<number, RestricaoAtividade>>(
    () => carregarObjetoLocal(restricaoStorageKey)
  );
  const [restricaoEditandoId, setRestricaoEditandoId] = useState<number | null>(null);
  const [restricaoTexto, setRestricaoTexto] = useState("");
  const [agora, setAgora] = useState(Date.now());

  const atividadesTurno = useMemo(
    () => atividades.filter((item) => !turno || item.turno === turno),
    [atividades, turno]
  );

  const atividadesFiltradas = useMemo(() => {
    if (filtro === "Todas") {
      return atividadesTurno;
    }

    if (filtro === "Pendentes") {
      return atividadesTurno.filter(
        (item) => item.status === "Planejada" || item.status === "Parcial"
      );
    }

    return atividadesTurno.filter((item) => item.status === filtro);
  }, [atividadesTurno, filtro]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    salvarObjetoLocal(controleStorageKey, controles);
  }, [controles]);

  useEffect(() => {
    salvarObjetoLocal(restricaoStorageKey, restricoes);
  }, [restricoes]);

  async function carregarAtividades(obraAtualId = obraId) {
    if (!obraAtualId) {
      setAtividades([]);
      return;
    }

    const { data } = await supabase
      .from("atividades")
      .select("*")
      .eq("obra_id", obraAtualId)
      .order("id", { ascending: true });

    setAtividades((data || []) as Atividade[]);
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

  useEffect(() => {
    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const dadosObra = obterDadosObra(cadastro, obraAtiva?.id ?? null);
      const turnoAtivo = obterTurnoAtivoNome(
        cadastro,
        obraAtiva?.id ?? null,
        dadosObra.turnos
      );

      setObrasCadastradas(cadastro.obras);
      setObraId(obraAtiva?.id ?? null);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);
      setFuncoesPrevistasCadastradas(dadosObra.funcoesPrevistas);

      if (turnoAtivo) {
        setTurno(turnoAtivo);
      }

      void carregarAtividades(obraAtiva?.id ?? null);
      void carregarMaoObraReal();
    }

    queueMicrotask(() => {
      carregarContextoObra();
      void sincronizarCadastroBaseRemoto();
    });
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
    // carregarAtividades recebe o id atual explicitamente neste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alterarObraSelecionada(valor: string) {
    salvarObraAtivaId(valor ? Number(valor) : null);
  }

  function alterarTurnoSelecionado(novoTurno: string) {
    setTurno(novoTurno);
    salvarTurnoAtivo(obraId, novoTurno);
  }

  async function atualizarAtividade(
    id: number,
    status: StatusAtividade,
    realizado?: number
  ) {
    const atividadeAtual = atividades.find((atividade) => atividade.id === id);
    const previsto = Number(atividadeAtual?.previsto || 0);
    const quantidadeRealizada =
      realizado === undefined ? undefined : Math.max(0, realizado);
    const percentual =
      quantidadeRealizada === undefined || previsto <= 0
        ? undefined
        : Math.min(100, Math.round((quantidadeRealizada / previsto) * 100));
    const atualizacao: AtualizacaoAtividade = { status };

    if (quantidadeRealizada !== undefined) {
      atualizacao.realizado = quantidadeRealizada;
      atualizacao.progresso = percentual;

      if (percentual === 100) {
        atualizacao.status = "Finalizada";
      } else if (status === "Finalizada" && percentual !== undefined && percentual < 100) {
        atualizacao.status = "Parcial";
      }
    }

    const { error } = await supabase.from("atividades").update(atualizacao).eq("id", id);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar atividade.");
      return;
    }

    await carregarAtividades();
  }

  async function iniciarAtividade(id: number) {
    setControles((atuais) => {
      const atual = atuais[id] ?? { elapsedMs: 0, runningSince: null };

      if (atual.runningSince) {
        return atuais;
      }

      return {
        ...atuais,
        [id]: {
          ...atual,
          runningSince: Date.now(),
        },
      };
    });
    await atualizarAtividade(id, "Execução");
  }

  async function pausarAtividade(id: number, status: StatusAtividade) {
    pausarCronometro(id);
    await atualizarAtividade(id, status);
  }

  async function finalizarAtividade(atividade: Atividade) {
    pausarCronometro(atividade.id);
    await atualizarAtividade(atividade.id, "Finalizada", atividade.previsto);
  }

  function pausarCronometro(id: number) {
    setControles((atuais) => {
      const atual = atuais[id];

      if (!atual?.runningSince) {
        return atuais;
      }

      return {
        ...atuais,
        [id]: {
          elapsedMs: atual.elapsedMs + Date.now() - atual.runningSince,
          runningSince: null,
        },
      };
    });
  }

  async function abrirRestricao(atividade: Atividade) {
    pausarCronometro(atividade.id);
    setRestricaoEditandoId(atividade.id);
    setRestricaoTexto(restricoes[atividade.id]?.texto ?? "");
    await atualizarAtividade(atividade.id, "Restrição");
  }

  function salvarRestricao(id: number) {
    if (!restricaoTexto.trim()) {
      alert("Informe a restrição.");
      return;
    }

    setRestricoes((atuais) => ({
      ...atuais,
      [id]: {
        texto: restricaoTexto.trim(),
        status: "aberta",
      },
    }));
    setRestricaoEditandoId(null);
    setRestricaoTexto("");
  }

  async function resolverRestricao(id: number) {
    setRestricoes((atuais) => ({
      ...atuais,
      [id]: {
        ...(atuais[id] ?? { texto: "" }),
        status: "resolvida",
      },
    }));
    setRestricaoEditandoId(null);
    setRestricaoTexto("");
    await atualizarAtividade(id, "Parcial");
  }

  function pararRestricao(id: number) {
    setRestricoes((atuais) => ({
      ...atuais,
      [id]: {
        ...(atuais[id] ?? { texto: "" }),
        status: "parada",
      },
    }));
    setRestricaoEditandoId(null);
    setRestricaoTexto("");
  }

  async function adicionarMaoObra() {
    if (!atividadeMaoObraId || !funcao || !quantidade) {
      alert("Informe atividade, função e quantidade.");
      return;
    }

    const payload = {
      atividade_id: atividadeMaoObraId,
      obra_id: obraId,
      funcao,
      quantidade: Number(quantidade),
      turno,
      data_turno: dataHoje(),
    };

    const { error } = await supabase.from("mao_obra").insert([payload]);

    if (error) {
      const { error: fallbackError } = await supabase.from("mao_obra").insert([
        {
          funcao,
          quantidade: Number(quantidade),
          turno,
          data_turno: dataHoje(),
        },
      ]);

      if (fallbackError) {
        const itemLocal: MaoObraReal = {
          id: Date.now() * -1,
          atividade_id: atividadeMaoObraId,
          funcao,
          quantidade: Number(quantidade),
        };

        salvarListaLocal(maoObraLocalStorageKey, [
          ...carregarListaLocal<MaoObraReal>(maoObraLocalStorageKey),
          itemLocal,
        ]);
        setMaoObraReal((atuais) => [...atuais, itemLocal]);
      }
    }

    setFuncao("");
    setQuantidade("");
    await carregarMaoObraReal();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <header className="mb-4 rounded-xl bg-slate-900 p-4 text-white">
        <p className="text-xs font-semibold text-teal-200">Obra ativa: {obra}</p>
        <h1 className="text-2xl font-bold">Minhas Atividades</h1>
        <p className="text-sm text-slate-300">Campo · Turno {turno || "-"}</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">
              Obra
            </span>
            <select
              value={obraId ?? ""}
              onChange={(e) => alterarObraSelecionada(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm font-semibold text-white"
            >
              <option value="">
                {obrasCadastradas.length === 0 ? "Cadastre uma obra" : "Selecionar obra"}
              </option>
              {obrasCadastradas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome || item.codigo || "Obra sem nome"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">
              Turno
            </span>
            <select
              value={turno}
              onChange={(e) => alterarTurnoSelecionado(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm font-semibold text-white"
            >
              {turnosCadastrados.length === 0 ? (
                <>
                  <option value="Dia">Turno Dia</option>
                  <option value="Noite">Turno Noite</option>
                </>
              ) : (
                turnosCadastrados.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome || "Turno sem nome"} - {formatarHoras(item.horasTrabalho)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <ResumoCard titulo="Total" valor={String(atividadesTurno.length)} />
        <ResumoCard
          titulo="Execução"
          valor={String(atividadesTurno.filter((a) => a.status === "Execução").length)}
        />
        <ResumoCard
          titulo="Restrição"
          valor={String(atividadesTurno.filter((a) => a.status === "Restrição").length)}
          destaque="text-red-500"
        />
        <ResumoCard
          titulo="Finalizadas"
          valor={String(atividadesTurno.filter((a) => a.status === "Finalizada").length)}
          destaque="text-green-600"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["Todas", "Pendentes", "Execução", "Restrição", "Finalizada"] as FiltroStatus[]).map(
          (item) => (
            <button
              key={item}
              onClick={() => setFiltro(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${
                filtro === item ? "bg-teal-600 text-white" : "bg-white text-slate-700"
              }`}
            >
              {item}
            </button>
          )
        )}
      </div>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Mão de obra real</h2>
          <p className="text-sm text-slate-500">
            Vincule a equipe mobilizada a uma atividade do turno.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_120px]">
          <select
            value={atividadeMaoObraId ?? ""}
            onChange={(e) =>
              setAtividadeMaoObraId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg border border-slate-300 p-3 text-sm"
          >
            <option value="">Atividade</option>
            {atividadesTurno.map((item) => (
              <option key={item.id} value={item.id}>
                {item.atividade}
              </option>
            ))}
          </select>

          <select
            value={funcao}
            onChange={(e) => {
              const nome = e.target.value;
              const funcaoBase = funcoesPrevistasCadastradas.find(
                (item) => item.nome === nome
              );

              setFuncao(nome);

              if (funcaoBase) {
                setQuantidade(String(funcaoBase.quantidade));
              }
            }}
            className="rounded-lg border border-slate-300 p-3 text-sm"
          >
            <option value="">Função</option>
            {funcoesPrevistasCadastradas.map((item) => (
              <option key={item.id} value={item.nome}>
                {item.nome}
              </option>
            ))}
          </select>

          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            type="number"
            className="rounded-lg border border-slate-300 p-3 text-sm"
            placeholder="Qtd"
          />
        </div>

        <button
          onClick={adicionarMaoObra}
          className="mt-3 w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
        >
          Adicionar
        </button>
      </section>

      <section className="space-y-4">
        {atividadesFiltradas.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
            Nenhuma atividade para este filtro.
          </p>
        ) : (
          atividadesFiltradas.map((atividade) => {
            const previsto = atividade.previsto || 0;
            const realizado = atividade.realizado || 0;
            const percentual =
              previsto > 0 ? Math.round((realizado / previsto) * 100) : 0;
            const tempo = obterTempoDecorrido(controles[atividade.id], agora);
            const recursosAtividade = maoObraReal.filter(
              (item) => item.atividade_id === atividade.id
            );
            const restricao = restricoes[atividade.id];

            return (
              <div key={atividade.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${
                          atividade.prioridade === "A"
                            ? "bg-red-100 text-red-700"
                            : atividade.prioridade === "B"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {atividade.prioridade}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {atividade.disciplina}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold leading-tight">
                      {atividade.atividade}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Local: {atividade.local}</p>
                    <p className="mt-1 text-sm text-slate-500">Resp: {atividade.responsavel}</p>
                  </div>

                  <div className="text-right">
                    <StatusBadge status={atividade.status} />
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Tempo: {formatarDuracao(tempo)}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Avanço</span>
                    <span className="font-bold">{percentual}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full ${
                        percentual >= 100
                          ? "bg-green-500"
                          : percentual >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(percentual, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Previsto</p>
                    <p className="text-lg font-bold">
                      {previsto} {atividade.unidade || "un"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Realizado</p>
                    <input
                      type="number"
                      defaultValue={realizado}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-lg font-bold"
                      onBlur={(e) =>
                        atualizarAtividade(
                          atividade.id,
                          atividade.status,
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-bold text-slate-700">Mão de obra vinculada</p>
                  {recursosAtividade.length === 0 ? (
                    <p className="mt-1 text-slate-500">Nenhuma equipe lançada.</p>
                  ) : (
                    <p className="mt-1 text-slate-600">
                      {recursosAtividade
                        .map((item) => `${item.funcao}: ${item.quantidade}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                {restricao && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-red-700">Restrição</p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-red-700">
                        {restricao.status}
                      </span>
                    </div>
                    <p className="mt-1 text-red-700">{restricao.texto || "Sem descrição"}</p>
                    {restricao.status === "aberta" && restricaoEditandoId !== atividade.id && (
                      <button
                        onClick={() => pararRestricao(atividade.id)}
                        className="mt-3 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        Parar restrição
                      </button>
                    )}
                  </div>
                )}

                {restricaoEditandoId === atividade.id && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <label className="block text-sm font-bold text-red-700">
                      Informe a restrição
                    </label>
                    <textarea
                      value={restricaoTexto}
                      onChange={(e) => setRestricaoTexto(e.target.value)}
                      className="mt-2 min-h-[80px] w-full rounded-lg border border-red-200 bg-white p-3 text-sm"
                      placeholder="Descreva o impedimento, responsável e condição de liberação..."
                    />
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => salvarRestricao(atividade.id)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Salvar restrição
                      </button>
                      <button
                        onClick={() => resolverRestricao(atividade.id)}
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Resolvido
                      </button>
                      <button
                        onClick={() => pararRestricao(atividade.id)}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        Parar restrição
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => iniciarAtividade(atividade.id)}
                    className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Iniciar
                  </button>
                  <button
                    onClick={() => pausarAtividade(atividade.id, "Parcial")}
                    className="rounded-lg bg-yellow-500 px-3 py-3 text-sm font-bold text-white transition hover:bg-yellow-600"
                  >
                    Parcial
                  </button>
                  <button
                    onClick={() => abrirRestricao(atividade)}
                    className="rounded-lg bg-red-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                  >
                    Restrição
                  </button>
                  <button
                    onClick={() => finalizarAtividade(atividade)}
                    className="rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classe =
    status === "Restrição"
      ? "bg-red-100 text-red-700"
      : status === "Execução"
      ? "bg-blue-100 text-blue-700"
      : status === "Finalizada"
      ? "bg-green-100 text-green-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classe}`}>
      {status}
    </span>
  );
}

function obterTempoDecorrido(controle: ControleAtividade | undefined, agora: number) {
  if (!controle) {
    return 0;
  }

  return controle.elapsedMs + (controle.runningSince ? agora - controle.runningSince : 0);
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

function carregarObjetoLocal<T>(chave: string): T {
  if (typeof window === "undefined") {
    return {} as T;
  }

  try {
    return JSON.parse(window.localStorage.getItem(chave) || "{}") as T;
  } catch {
    return {} as T;
  }
}

function salvarObjetoLocal(chave: string, valor: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(chave, JSON.stringify(valor));
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

function salvarListaLocal(chave: string, valor: unknown[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(chave, JSON.stringify(valor));
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
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-2xl font-bold ${destaque}`}>{valor}</p>
    </div>
  );
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
}
