"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade, RecursoDisponivelTurno } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  getContextoAtual,
} from "../../lib/cadastro-base";
import {
  calcularAvancoReal,
  calcularPpc,
  chaveTurno,
  checkoutFechamentosStorageKey,
  listarRestricoesHistorico,
  type RestricaoHistorico,
} from "../../lib/operacao";

type MaoObraReal = {
  id: number;
  atividade_id?: number | null;
  obra_id?: number | null;
  funcao: string;
  quantidade: number;
  turno?: string | null;
  data_turno?: string | null;
};

type RestricaoCampo = {
  texto: string;
  status: string;
  registradaEm: string;
};

type RestricaoResumo = {
  id: string;
  codigo: string;
  atividade: string;
  texto: string;
  responsavel: string;
  status: string;
};

const recursosDisponiveisStorageKey = "obraboard:recursos-disponiveis-local";
const maoObraLocalStorageKey = "obraboard:mao-obra-local";
const restricaoStorageKey = "obraboard:campo-restricoes";

export default function RdoPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [turno, setTurno] = useState("");
  const [dataTurnoSelecionada, setDataTurnoSelecionada] = useState("");
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<RecursoDisponivelTurno[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [restricoesCampo, setRestricoesCampo] = useState<Record<number, RestricaoCampo>>({});
  const [restricoesHistorico, setRestricoesHistorico] = useState<RestricaoHistorico[]>([]);

  const dataTurnoMaisRecente = obterDataTurnoAtual(
    turno
      ? atividadesBanco.filter((item) => item.turno === turno)
      : atividadesBanco
  );
  const dataTurnoAtual = dataTurnoSelecionada || dataTurnoMaisRecente;
  const atividades = useMemo(
    () =>
      atividadesBanco.filter(
        (item) =>
          item.obra_id === obraId &&
          (!dataTurnoAtual || item.data_turno === dataTurnoAtual) &&
          (!turno || item.turno === turno)
      ),
    [atividadesBanco, dataTurnoAtual, obraId, turno]
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
          (!turno || item.turno === turno)
      )
      .map<RestricaoResumo>((item) => ({
        id: item.id,
        codigo: `R${item.atividadeId}`,
        atividade: item.atividade,
        texto: item.texto || "Sem observação registrada.",
        responsavel: item.responsavel,
        status: item.status,
      }));
    const chavesHistorico = new Set(
      historico.map((item) => `${item.codigo}:${item.texto}:${item.status}`)
    );
    const ativas = restricoes
      .map<RestricaoResumo>((item) => ({
        id: `ativa-${item.id}`,
        codigo: `R${item.id}`,
        atividade: item.atividade,
        texto: restricoesCampo[item.id]?.texto || "Sem observação registrada.",
        responsavel: item.responsavel,
        status: restricoesCampo[item.id]?.status || "aberta",
      }))
      .filter((item) => !chavesHistorico.has(`${item.codigo}:${item.texto}:${item.status}`));

    return [...historico, ...ativas];
  }, [dataTurnoAtual, restricoes, restricoesCampo, restricoesHistorico, turno]);

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
        const restricoesGrupo = restricoesHistorico.filter(
          (item) => item.dataTurno === dataTurno && item.turno === turnoGrupo
        );
        const restricoesAtivasGrupo = itens.filter(
          (item) => item.status === "Restrição"
        ).length;
        const equipe = calcularEquipeReal(
          maoObraReal,
          new Set(itens.map((item) => item.id)),
          obraId,
          dataTurno,
          turnoGrupo
        );

        return {
          chave: chaveGrupo,
          dataTurno,
          turno: turnoGrupo,
          status: checkoutEncerrado(obraId, dataTurno, turnoGrupo)
            ? "Turno encerrado"
            : "Em acompanhamento",
          avanco: calcularPpc(itens),
          equipe,
          atividades: itens.length,
          restricoes: Math.max(restricoesGrupo.length, restricoesAtivasGrupo),
        };
      })
      .sort((a, b) =>
        `${b.dataTurno}-${b.turno}`.localeCompare(`${a.dataTurno}-${a.turno}`)
      );
  }, [atividadesBanco, maoObraReal, obraId, restricoesHistorico]);

  const recursosMobilizados = useMemo(() => {
    const mapa = new Map<string, { previsto: number; real: number }>();

    recursosDisponiveis.forEach((item) => {
      const atual = mapa.get(item.funcao) ?? { previsto: 0, real: 0 };
      atual.previsto += Number(item.quantidade || 0);
      mapa.set(item.funcao, atual);
    });

    maoObraReal.forEach((item) => {
      const pertenceAoTurno =
        item.atividade_id && idsAtividades.has(item.atividade_id)
          ? true
          : item.obra_id === obraId &&
            item.data_turno === dataTurnoAtual &&
            item.turno === turno;

      if (!pertenceAoTurno) {
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
  }, [dataTurnoAtual, idsAtividades, maoObraReal, obraId, recursosDisponiveis, turno]);

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
    setMaoObraReal([
      ...((maoObra || []) as MaoObraReal[]),
      ...carregarObjetoLocal<MaoObraReal[]>(maoObraLocalStorageKey, []).filter(
        (item) => item.obra_id === obraAtualId
      ),
    ]);
  }

  async function carregarRecursosDisponiveis(
    obraAtualId: number | null,
    dataAtual: string | null,
    turnoAtual: string
  ) {
    if (!obraAtualId || !dataAtual || !turnoAtual) {
      setRecursosDisponiveis([]);
      return;
    }

    const locais = carregarObjetoLocal<RecursoDisponivelTurno[]>(recursosDisponiveisStorageKey, []).filter(
      (item) =>
        item.obra_id === obraAtualId &&
        item.data_turno === dataAtual &&
        item.turno === turnoAtual
    );

    const { data, error } = await supabase
      .from("recursos_disponiveis")
      .select("*")
      .eq("obra_id", obraAtualId)
      .eq("data_turno", dataAtual)
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
        data_turno: String(item.data_turno),
        turno: String(item.turno),
        funcao: String(item.funcao),
        quantidade: Number(item.quantidade || 0),
        cargaHoraria: Number(item.carga_horaria || 0),
      })),
      ...locais,
    ]);
  }

  useEffect(() => {
    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const parametros = new URLSearchParams(window.location.search);
      const dataParam = parametros.get("dataTurno") || "";
      const contexto = getContextoAtual(cadastro);
      const obraAtiva = contexto.obraAtiva;
      const obraResolvidaId = contexto.obraAtivaId;
      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObraId(obraResolvidaId);
      setObra(
        obraAtiva?.nome ??
          (obraResolvidaId ? "Obra informada no link" : "Sem obra selecionada")
      );
      setTurno(contexto.turnoAtivo?.nome ?? "");
      setDataTurnoSelecionada(dataParam);
      setRestricoesCampo(carregarObjetoLocal<Record<number, RestricaoCampo>>(restricaoStorageKey, {}));
      setRestricoesHistorico(listarRestricoesHistorico(obraResolvidaId, null, null));
      void carregarDados(obraResolvidaId);
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void carregarRecursosDisponiveis(obraId, dataTurnoAtual, turno);
    });
  }, [obraId, dataTurnoAtual, turno]);

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
            <div className="grid gap-3 xl:grid-cols-2">
              {historicoRdos.map((item) => (
                <div key={item.chave} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {formatarDataTurno(item.dataTurno)} - Turno {item.turno}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">{item.status}</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                      Historico
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-5">
                    <ResumoHistorico label="Avanço" value={`${item.avanco}%`} />
                    <ResumoHistorico label="Equipe" value={String(item.equipe)} />
                    <ResumoHistorico label="Atividades" value={String(item.atividades)} />
                    <ResumoHistorico label="Restrições" value={String(item.restricoes)} />
                    <ResumoHistorico label="Turno" value={item.turno} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mx-auto w-full max-w-[794px] rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Obra ativa: {obra}
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
              <InfoCard label="Status" value={checkoutEncerrado(obraId, dataTurnoAtual, turno) ? "Turno encerrado" : "Turno em acompanhamento"} />
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
                    <th className="border border-slate-300 p-2 text-left">Atividade</th>
                    <th className="border border-slate-300 p-2 text-left">Restrição</th>
                    <th className="border border-slate-300 p-2 text-left">Responsável</th>
                    <th className="border border-slate-300 p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {restricoesDoRdo.length === 0 ? (
                    <tr>
                      <td className="border border-slate-300 p-2 text-center text-slate-500" colSpan={5}>
                        Nenhuma restrição registrada.
                      </td>
                    </tr>
                  ) : (
                    restricoesDoRdo.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-slate-300 p-2">{item.codigo}</td>
                        <td className="border border-slate-300 p-2">{item.atividade}</td>
                        <td className="border border-slate-300 p-2">{item.texto}</td>
                        <td className="border border-slate-300 p-2">{item.responsavel}</td>
                        <td className="border border-slate-300 p-2 text-center">{item.status}</td>
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

function carregarObjetoLocal<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return JSON.parse(window.localStorage.getItem(chave) || "") as T;
  } catch {
    return fallback;
  }
}

function checkoutEncerrado(obraId: number | null, dataTurno: string | null, turno: string) {
  if (!obraId || !dataTurno || !turno || typeof window === "undefined") {
    return false;
  }

  const fechamentos = carregarObjetoLocal<Record<string, { encerradoEm: string }>>(
    checkoutFechamentosStorageKey,
    {}
  );
  return Boolean(fechamentos[chaveTurno(obraId, dataTurno, turno)]);
}

function calcularEquipeReal(
  maoObraReal: MaoObraReal[],
  idsAtividades: Set<number>,
  obraId: number | null,
  dataTurno: string | null,
  turno: string
) {
  return maoObraReal
    .filter((item) =>
      item.atividade_id && idsAtividades.has(item.atividade_id)
        ? true
        : item.obra_id === obraId &&
          item.data_turno === dataTurno &&
          item.turno === turno
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

function ResumoHistorico({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}
