"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade, RecursoDisponivelTurno } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  getContextoAtual,
  sincronizarCadastroBaseRemoto,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";
import {
  calcularAvancoReal,
  calcularPpc,
  chaveTurno,
  pertenceAoTurno,
  type FechamentosTurno,
  type RestricaoHistorico,
} from "../../lib/operacao";
import {
  carregarFechamentosTurnoRemotos,
  listarRestricoesHistoricoRemoto,
} from "../../lib/operacao-remota";

type MaoObraReal = {
  id: number;
  atividade_id?: number | null;
  obra_id?: number | null;
  turno_id?: number | null;
  funcao: string;
  quantidade: number;
  turno?: string | null;
  data_turno?: string | null;
};

type RestricaoResumo = {
  id: string;
  codigo: string;
  dataTurno: string | null;
  turno: string | null;
  atividade: string;
  texto: string;
  responsavel: string;
  status: string;
  registradaEm: string;
  paradaEm?: string | null;
  retomadaEm?: string | null;
  encerradaEm?: string | null;
};

export default function RdoPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [turno, setTurno] = useState("");
  const [turnosCadastrados, setTurnosCadastrados] = useState<TurnoCadastrado[]>([]);
  const [dataTurnoSelecionada, setDataTurnoSelecionada] = useState("");
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<RecursoDisponivelTurno[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [restricoesHistorico, setRestricoesHistorico] = useState<RestricaoHistorico[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentosTurno>({});

  const turnoSelecionado = useMemo(
    () => turnosCadastrados.find((item) => item.nome === turno) ?? null,
    [turno, turnosCadastrados]
  );
  const dataTurnoMaisRecente = obterDataTurnoAtual(
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
  const dataTurnoAtual = dataTurnoSelecionada || dataTurnoMaisRecente;
  const atividades = useMemo(
    () =>
      atividadesBanco.filter(
        (item) =>
          item.obra_id === obraId &&
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
  const idsAtividades = useMemo(() => new Set(atividades.map((item) => item.id)), [atividades]);
  const finalizadas = atividades.filter(
    (item) => calcularAvancoReal(item.previsto, item.realizado) >= 100
  ).length;
  const restricoes = atividades.filter((item) => item.status === "Restrição");
  const ppc = calcularPpc(atividades);
  const restricoesDoRdo = useMemo(() => {
    const historico = restricoesHistorico
      .filter(
        (item) =>
          (!dataTurnoAtual || item.dataTurno === dataTurnoAtual) &&
          (!turno ||
            (item.turnoId
              ? item.turnoId === turnoSelecionado?.id
              : item.turno === turno))
      )
      .map<RestricaoResumo>((item) => ({
        id: item.id,
        codigo: `R${item.atividadeId}`,
        dataTurno: item.dataTurno,
        turno: item.turno,
        atividade: item.atividade,
        texto: item.texto || "Restrição sem descrição.",
        responsavel: item.responsavel,
        status: item.status,
        registradaEm: item.registradaEm,
        paradaEm: item.paradaEm,
        retomadaEm: item.retomadaEm,
        encerradaEm: item.encerradaEm,
      }));
    const chavesHistorico = new Set(
      historico.map((item) => `${item.codigo}:${item.texto}:${item.status}`)
    );
    const ativas = restricoes
      .map<RestricaoResumo>((item) => ({
        id: `ativa-${item.id}`,
        codigo: `R${item.id}`,
        dataTurno: item.data_turno ?? null,
        turno: item.turno ?? null,
        atividade: item.atividade,
        texto: "Restrição sem descrição.",
        responsavel: item.responsavel,
        status: "aberta",
        registradaEm: "",
        paradaEm: null,
        retomadaEm: null,
        encerradaEm: null,
      }))
      .filter((item) => !chavesHistorico.has(`${item.codigo}:${item.texto}:${item.status}`));

    return [...historico, ...ativas];
  }, [dataTurnoAtual, restricoes, restricoesHistorico, turno, turnoSelecionado]);

  const historicoRdos = useMemo(() => {
    const grupos = new Map<string, Atividade[]>();

    atividadesBanco
      .filter((item) => item.obra_id === obraId && item.data_turno && item.turno)
      .forEach((item) => {
        const chaveGrupo = `${item.data_turno}:${item.turno}`;
        grupos.set(chaveGrupo, [...(grupos.get(chaveGrupo) ?? []), item]);
      });

    return Array.from(grupos.entries())
      .map(([chaveGrupo, itens]) => {
        const [dataTurno, turnoGrupo] = chaveGrupo.split(":");
        const turnoGrupoId =
          itens.find((item) => item.turno_id)?.turno_id ??
          turnosCadastrados.find((item) => item.nome === turnoGrupo)?.id ??
          null;
        const restricoesGrupo = restricoesHistorico.filter(
          (item) =>
            item.dataTurno === dataTurno &&
            (item.turnoId ? item.turnoId === turnoGrupoId : item.turno === turnoGrupo)
        );
        const restricoesAtivasGrupo = itens.filter(
          (item) => item.status === "Restrição"
        ).length;
        const equipe = calcularEquipeReal(
          maoObraReal,
          new Set(itens.map((item) => item.id)),
          obraId,
          dataTurno,
          turnoGrupo,
          turnoGrupoId
        );

        return {
          chave: chaveGrupo,
          dataTurno,
          turno: turnoGrupo,
          turnoId: turnoGrupoId,
          status: checkoutEncerrado(fechamentos, obraId, dataTurno, turnoGrupo)
            ? "Turno encerrado"
            : "Em acompanhamento",
          avanco: calcularPpc(itens),
          equipe,
          atividades: itens.length,
          restricoes: Math.max(restricoesGrupo.length, restricoesAtivasGrupo),
          responsavel:
            itens.find((item) => item.responsavel)?.responsavel ||
            restricoesGrupo.find((item) => item.responsavel)?.responsavel ||
            "-",
          criadoEm:
            [...itens]
              .map((item) => (item as Atividade & { created_at?: string | null }).created_at)
              .filter(Boolean)
              .sort()
              .at(-1) || dataTurno,
        };
      })
      .sort((a, b) =>
        `${b.dataTurno}-${b.turno}`.localeCompare(`${a.dataTurno}-${a.turno}`)
      );
  }, [atividadesBanco, fechamentos, maoObraReal, obraId, restricoesHistorico, turnosCadastrados]);

  const recursosMobilizados = useMemo(() => {
    const mapa = new Map<string, { previsto: number; real: number }>();

    recursosDisponiveis.forEach((item) => {
      const atual = mapa.get(item.funcao) ?? { previsto: 0, real: 0 };
      atual.previsto += Number(item.quantidade || 0);
      mapa.set(item.funcao, atual);
    });

    maoObraReal.forEach((item) => {
      const pertence =
        item.atividade_id && idsAtividades.has(item.atividade_id)
          ? true
          : pertenceAoTurno(item, {
              obraId,
              turnoId: turnoSelecionado?.id ?? null,
              turno,
              dataTurno: dataTurnoAtual,
            });

      if (!pertence) {
        return;
      }

      const atual = mapa.get(item.funcao) ?? { previsto: 0, real: 0 };
      atual.real += Number(item.quantidade || 0);
      mapa.set(item.funcao, atual);
    });

    return Array.from(mapa.entries()).map(([funcao, valores]) => ({
      funcao,
      ...valores,
      desvio: valores.real - valores.previsto,
    }));
  }, [
    dataTurnoAtual,
    idsAtividades,
    maoObraReal,
    obraId,
    recursosDisponiveis,
    turno,
    turnoSelecionado,
  ]);

  async function carregarDados(obraAtualId: number | null) {
    if (!obraAtualId) {
      setAtividadesBanco([]);
      setMaoObraReal([]);
      return;
    }

    const [{ data: atividades }, { data: maoObra }] = await Promise.all([
      supabase.from("atividades").select("*").eq("obra_id", obraAtualId).order("id", { ascending: true }),
      supabase.from("mao_obra").select("*").eq("obra_id", obraAtualId),
    ]);

    setAtividadesBanco((atividades || []) as Atividade[]);
    setMaoObraReal((maoObra || []) as MaoObraReal[]);
    setRestricoesHistorico(await listarRestricoesHistoricoRemoto(obraAtualId, null, null));
    setFechamentos(await carregarFechamentosTurnoRemotos(obraAtualId));
  }

  function abrirRdoHistorico(item: {
    dataTurno: string;
    turno: string;
    turnoId: number | null;
  }) {
    setDataTurnoSelecionada(item.dataTurno);
    setTurno(item.turno);

    const params = new URLSearchParams(window.location.search);
    if (obraId) {
      params.set("obraId", String(obraId));
    }
    if (item.turnoId) {
      params.set("turnoId", String(item.turnoId));
    }
    params.set("dataTurno", item.dataTurno);
    window.history.replaceState(null, "", `/rdo?${params.toString()}`);
  }

  async function carregarRecursosDisponiveis(
    obraAtualId: number | null,
    dataAtual: string | null,
    turnoAtual: string,
    turnoAtualId: number | null
  ) {
    if (!obraAtualId || !dataAtual || !turnoAtual || !turnoAtualId) {
      setRecursosDisponiveis([]);
      return;
    }

    const { data, error } = await supabase
      .from("recursos_disponiveis")
      .select("*")
      .eq("obra_id", obraAtualId)
      .eq("data_turno", dataAtual)
      .eq("turno_id", turnoAtualId)
      .order("id", { ascending: true });

    if (error) {
      console.warn("Nao foi possivel carregar recursos_disponiveis.", error);
      setRecursosDisponiveis([]);
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
    ]);
  }

  useEffect(() => {
    function carregarContextoObra(cadastro = carregarCadastroBase()) {
      const parametros = new URLSearchParams(window.location.search);
      const dataParam = parametros.get("dataTurno") || "";
      const contexto = getContextoAtual(cadastro, {
        obraId: parametros.get("obraId"),
        turnoId: parametros.get("turnoId"),
      });
      const obraAtiva = contexto.obraAtiva;
      const obraResolvidaId = contexto.obraAtivaId ?? contexto.obraIdParametro ?? null;
      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObraId(obraResolvidaId);
      setObra(
        obraAtiva?.nome ??
          (obraResolvidaId ? "Obra informada no link" : "Sem obra selecionada")
      );
      setTurnosCadastrados(contexto.dadosObra.turnos);
      setTurno(contexto.turnoAtivo?.nome ?? "");
      setDataTurnoSelecionada(dataParam);
      void carregarDados(obraResolvidaId);
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
    queueMicrotask(() => {
      void carregarRecursosDisponiveis(
        obraId,
        dataTurnoAtual,
        turno,
        turnoSelecionado?.id ?? null
      );
    });
  }, [obraId, dataTurnoAtual, turno, turnoSelecionado]);

  return (
    <DesktopLayout titulo="RDO" subtitulo="Relatório Diário de Obra">
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Histórico de RDOs</h2>
            <p className="text-sm text-slate-500">
              Resumo dos RDOs da obra/frente selecionada.
            </p>
          </div>

          {historicoRdos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
              Nenhum RDO encontrado para a obra/frente selecionada.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Turno</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2 text-right">Avanço</th>
                    <th className="px-3 py-2 text-right">Ativ.</th>
                    <th className="px-3 py-2 text-right">Restr.</th>
                    <th className="px-3 py-2">Criado em</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {historicoRdos.map((item) => (
                    <tr key={item.chave}>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {formatarDataTurno(item.dataTurno)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{item.turno}</td>
                      <td className="px-3 py-2 text-slate-600">{item.status}</td>
                      <td className="px-3 py-2 text-slate-600">{item.responsavel}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800">
                        {item.avanco}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.atividades}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.restricoes}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatarDataTurno(String(item.criadoEm).slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => abrirRdoHistorico(item)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                        >
                          Abrir RDO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="mx-auto w-full max-w-[794px] rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <div className="mb-4 flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <span>Obra ativa: {obra}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              Abrir/imprimir RDO
            </button>
          </div>
          {!obraId && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
              Selecione uma obra no menu lateral para continuar.
            </p>
          )}
          {obraId && !turno && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
              Selecione ou publique um turno no Checkin para continuar.
            </p>
          )}
          <div className="max-w-sm rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Turno ativo</p>
            <p className="mt-1 font-bold text-slate-900">{turno || "-"}</p>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Folha aberta: {dataTurnoAtual ? formatarDataTurno(dataTurnoAtual) : "-"} - Turno {turno || "-"}
          </p>
        </section>

        <div className="overflow-x-auto">
          <div className="mx-auto min-h-[1123px] w-[794px] bg-white p-10 shadow-xl">
            <header className="mb-8 border-b border-slate-300 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    Relatório Diário de Obra
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Consolidado operacional da obra/frente selecionada
                  </p>
                </div>

                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo da empresa" className="max-h-20 max-w-36 object-contain" />
                ) : (
                  <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                    LOGO EMPRESA
                  </div>
                )}
              </div>
            </header>

            <section className="mb-8 grid grid-cols-2 gap-4">
              <InfoCard label="Obra" value={obra} />
              <InfoCard label="Data" value={dataTurnoAtual ? formatarDataTurno(dataTurnoAtual) : "-"} />
              <InfoCard label="Turno" value={turno || "-"} />
              <InfoCard label="Atividades" value={String(atividades.length)} />
              <InfoCard label="Finalizadas" value={String(finalizadas)} />
              <InfoCard label="Status" value={checkoutEncerrado(fechamentos, obraId, dataTurnoAtual, turno) ? "Turno encerrado" : "Turno em acompanhamento"} />
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Resumo do Turno</h2>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
                {atividades.length === 0
                  ? "Nenhuma atividade registrada para a obra/frente, turno e data selecionados."
                  : `${finalizadas} de ${atividades.length} atividades finalizadas. ${restricoesDoRdo.length} restrições registradas no campo.`}
              </div>
            </section>

            <section className="mb-8 grid grid-cols-4 gap-3">
              <KpiCard label="PPC" value={`${ppc}%`} />
              <KpiCard label="Planejadas" value={String(contarStatus(atividades, "Planejada"))} />
              <KpiCard label="Finalizadas" value={String(finalizadas)} />
              <KpiCard label="Restrições" value={String(restricoesDoRdo.length)} />
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold">Recursos Mobilizados</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Funcao</th>
                    <th className="border border-slate-300 p-2 text-center">Previsto</th>
                    <th className="border border-slate-300 p-2 text-center">Real</th>
                    <th className="border border-slate-300 p-2 text-center">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {recursosMobilizados.length === 0 ? (
                    <tr>
                      <td className="border border-slate-300 p-2 text-center text-slate-500" colSpan={4}>
                        Nenhum recurso registrado para este turno.
                      </td>
                    </tr>
                  ) : (
                    recursosMobilizados.map((item) => (
                      <tr key={item.funcao}>
                        <td className="border border-slate-300 p-2">{item.funcao}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.previsto}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.real}</td>
                        <td className={`border border-slate-300 p-2 text-center ${item.desvio < 0 ? "text-red-600" : item.desvio > 0 ? "text-amber-600" : ""}`}>
                          {item.desvio > 0 ? `+${item.desvio}` : item.desvio}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold">Atividades do Turno</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Disc</th>
                    <th className="border border-slate-300 p-2 text-left">Atividade</th>
                    <th className="border border-slate-300 p-2 text-left">Local</th>
                    <th className="border border-slate-300 p-2 text-left">Responsável</th>
                    <th className="border border-slate-300 p-2 text-center">Status</th>
                    <th className="border border-slate-300 p-2 text-left">Horarios</th>
                    <th className="border border-slate-300 p-2 text-center">Avanco</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-slate-300 p-2">{item.disciplina}</td>
                      <td className="border border-slate-300 p-2">{item.atividade}</td>
                      <td className="border border-slate-300 p-2">{item.local}</td>
                      <td className="border border-slate-300 p-2">{item.responsavel}</td>
                      <td className="border border-slate-300 p-2 text-center">{item.status}</td>
                      <td className="border border-slate-300 p-2 text-center">{calcularProgresso(item)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="mb-10">
              <h2 className="mb-3 text-lg font-bold">Restrições e Tratativas</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">ID</th>
                    <th className="border border-slate-300 p-2 text-left">Data/turno</th>
                    <th className="border border-slate-300 p-2 text-left">Atividade</th>
                    <th className="border border-slate-300 p-2 text-left">Restrição</th>
                    <th className="border border-slate-300 p-2 text-left">Responsável</th>
                    <th className="border border-slate-300 p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {restricoesDoRdo.length === 0 ? (
                    <tr>
                      <td className="border border-slate-300 p-2 text-center text-slate-500" colSpan={7}>
                        Nenhuma restrição registrada.
                      </td>
                    </tr>
                  ) : (
                    restricoesDoRdo.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-slate-300 p-2">{item.codigo}</td>
                        <td className="border border-slate-300 p-2">
                          {item.dataTurno ? formatarDataTurno(item.dataTurno) : "-"} / {item.turno || "-"}
                        </td>
                        <td className="border border-slate-300 p-2">{item.atividade}</td>
                        <td className="border border-slate-300 p-2">{item.texto}</td>
                        <td className="border border-slate-300 p-2">{item.responsavel}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.status}</td>
                        <td className="border border-slate-300 p-2 text-xs leading-5">
                          {formatarHistoricoRestricao(item)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <footer className="mt-16 grid grid-cols-2 gap-10 text-sm">
              <div className="border-t border-slate-400 pt-2 text-center">
                Responsável pelo fechamento
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                Aprovacao / Cliente
              </div>
            </footer>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}

function checkoutEncerrado(
  fechamentos: FechamentosTurno,
  obraId: number | null,
  dataTurno: string | null,
  turno: string
) {
  if (!obraId || !dataTurno || !turno) {
    return false;
  }

  return Boolean(fechamentos[chaveTurno(obraId, dataTurno, turno)]);
}

function calcularEquipeReal(
  maoObraReal: MaoObraReal[],
  idsAtividades: Set<number>,
  obraId: number | null,
  dataTurno: string | null,
  turno: string,
  turnoId?: number | null
) {
  return maoObraReal
    .filter((item) =>
      item.atividade_id && idsAtividades.has(item.atividade_id)
        ? true
        : pertenceAoTurno(item, {
            obraId,
            turnoId: turnoId ?? null,
            turno,
            dataTurno,
          })
    )
    .reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

function contarStatus(atividades: Atividade[], status: string) {
  return atividades.filter((item) => item.status === status).length;
}

function obterDataTurnoAtual(atividades: Array<{ data_turno?: string | null }>) {
  const datas = atividades
    .map((item) => item.data_turno)
    .filter((data): data is string => Boolean(data))
    .sort();

  return datas.at(-1) ?? null;
}

function calcularProgresso(item: Atividade) {
  return calcularAvancoReal(item.previsto, item.realizado);
}

function formatarDataTurno(dataTurno: string) {
  const [ano, mes, dia] = dataTurno.split("-");

  if (!ano || !mes || !dia) {
    return dataTurno;
  }

  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) {
    return "-";
  }

  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarHistoricoRestricao(item: RestricaoResumo) {
  return [
    `Registro: ${formatarDataHora(item.registradaEm)}`,
    item.paradaEm ? `Parada: ${formatarDataHora(item.paradaEm)}` : "",
    item.retomadaEm ? `Retomada: ${formatarDataHora(item.retomadaEm)}` : "",
    item.encerradaEm ? `Encerrada: ${formatarDataHora(item.encerradaEm)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

