"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade, RecursoDisponivelTurno } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";
import { calcularAvancoReal, calcularPpc } from "../../lib/operacao";

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

const recursosDisponiveisStorageKey = "obraboard:recursos-disponiveis-local";
const maoObraLocalStorageKey = "obraboard:mao-obra-local";
const restricaoStorageKey = "obraboard:campo-restricoes";

export default function RdoPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [turnosCadastrados, setTurnosCadastrados] = useState<TurnoCadastrado[]>([]);
  const [turno, setTurno] = useState("");
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<RecursoDisponivelTurno[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [restricoesCampo, setRestricoesCampo] = useState<Record<number, RestricaoCampo>>({});

  const dataTurnoAtual = obterDataTurnoAtual(atividadesBanco);
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

  useEffect(() => {
    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const dadosObra = obterDadosObra(cadastro, obraAtiva?.id ?? null);
      const turnoAtivo = obterTurnoAtivoNome(cadastro, obraAtiva?.id ?? null, dadosObra.turnos);

      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObraId(obraAtiva?.id ?? null);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);
      setTurno(turnoAtivo || dadosObra.turnos[0]?.nome || "");
      setRestricoesCampo(carregarObjetoLocal<Record<number, RestricaoCampo>>(restricaoStorageKey, {}));
      void carregarDados(obraAtiva?.id ?? null);
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
    void carregarRecursosDisponiveis(obraId, dataTurnoAtual, turno);
  }, [obraId, dataTurnoAtual, turno]);

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

  return (
    <DesktopLayout titulo="RDO" subtitulo="Relatório Diário de Obra">
      <div className="space-y-4">
        <section className="mx-auto w-[794px] rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Obra ativa: {obra}
          </div>
          <label className="block max-w-sm">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Turno
            </span>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              {turnosCadastrados.length === 0 ? (
                <option value="">Sem turnos cadastrados</option>
              ) : (
                turnosCadastrados.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome || "Turno sem nome"} - {formatarHoras(item.horasTrabalho)}
                  </option>
                ))
              )}
            </select>
          </label>
        </section>

        <div className="flex justify-center">
          <div className="min-h-[1123px] w-[794px] bg-white p-10 shadow-xl">
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
                  : `${finalizadas} de ${atividades.length} atividades finalizadas. ${restricoes.length} restricoes registradas no campo.`}
              </div>
            </section>

            <section className="mb-8 grid grid-cols-4 gap-3">
              <KpiCard label="PPC" value={`${ppc}%`} />
              <KpiCard label="Planejadas" value={String(contarStatus(atividades, "Planejada"))} />
              <KpiCard label="Finalizadas" value={String(finalizadas)} />
              <KpiCard label="Restricoes" value={String(restricoes.length)} />
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
              <h2 className="mb-3 text-lg font-bold">Restricoes e Tratativas</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">ID</th>
                    <th className="border border-slate-300 p-2 text-left">Atividade</th>
                    <th className="border border-slate-300 p-2 text-left">Restricao</th>
                    <th className="border border-slate-300 p-2 text-left">Responsável</th>
                    <th className="border border-slate-300 p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {restricoes.length === 0 ? (
                    <tr>
                      <td className="border border-slate-300 p-2 text-center text-slate-500" colSpan={5}>
                        Nenhuma restricao registrada.
                      </td>
                    </tr>
                  ) : (
                    restricoes.map((item) => {
                      const restricao = restricoesCampo[item.id];
                      return (
                        <tr key={item.id}>
                          <td className="border border-slate-300 p-2">R{item.id}</td>
                          <td className="border border-slate-300 p-2">{item.atividade}</td>
                          <td className="border border-slate-300 p-2">{restricao?.texto || "Sem observacao registrada."}</td>
                          <td className="border border-slate-300 p-2">{item.responsavel}</td>
                          <td className="border border-slate-300 p-2 text-center">{restricao?.status || "aberta"}</td>
                        </tr>
                      );
                    })
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

  return Boolean(window.localStorage.getItem(`obraboard:checkout-fechamento:${obraId}:${dataTurno}:${turno}`));
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

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
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
