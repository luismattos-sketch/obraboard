"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type { Atividade } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  salvarTurnoAtivo,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";

export default function CheckoutPage() {
  const router = useRouter();
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
  const [edicao, setEdicao] = useState({
    previsto: "",
    realizado: "",
    tempoPrevistoHoras: "",
    responsavel: "",
  });

  const dataTurnoAtual = obterDataTurnoAtual(atividadesBanco);
  const atividades = useMemo(
    () =>
      atividadesBanco.filter(
        (item) =>
          (!dataTurnoAtual || item.data_turno === dataTurnoAtual) &&
          (!turno || item.turno === turno)
      ),
    [atividadesBanco, dataTurnoAtual, turno]
  );
  const restricoes = atividades.filter((item) => item.status === "Restrição");
  const finalizadas = contarStatus(atividades, "Finalizada");
  const parciais = contarStatus(atividades, "Parcial");
  const planejadas = contarStatus(atividades, "Planejada");
  const ppc =
    atividades.length > 0 ? Math.round((finalizadas / atividades.length) * 100) : 0;

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

      setAtividadesBanco((data || []) as Atividade[]);
      setCarregando(false);
    }

    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const dadosObra = obterDadosObra(cadastro, obraAtiva?.id ?? null);
      const turnoAtivo = obterTurnoAtivoNome(
        cadastro,
        obraAtiva?.id ?? null,
        dadosObra.turnos
      );

      setObraId(obraAtiva?.id ?? null);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);
      setTurno(turnoAtivo);
      void carregarAtividades(obraAtiva?.id ?? null);
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
  }, []);

  function alterarTurno(novoTurno: string) {
    setTurno(novoTurno);
    salvarTurnoAtivo(obraId, novoTurno);
  }

  async function recarregarAtividades() {
    if (!obraId) {
      return;
    }

    const { data } = await supabase
      .from("atividades")
      .select("*")
      .eq("obra_id", obraId)
      .order("id", { ascending: true });

    setAtividadesBanco((data || []) as Atividade[]);
  }

  function iniciarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");
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
      previsto > 0 ? Math.min(100, Math.round((realizado / previsto) * 100)) : 0;

    const { error } = await supabase
      .from("atividades")
      .update({
        previsto,
        realizado,
        progresso,
        responsavel: edicao.responsavel,
        tempo_previsto_horas: Number(edicao.tempoPrevistoHoras || 0),
      })
      .eq("id", item.id)
      .eq("obra_id", obraId);

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

    const realizado = Number(item.realizado || item.previsto || 0);
    const previsto = Number(item.previsto || 0);
    const progresso =
      previsto > 0 ? Math.min(100, Math.round((realizado / previsto) * 100)) : 100;

    const { error } = await supabase
      .from("atividades")
      .update({
        realizado,
        progresso: Math.max(progresso, 100),
        status: "Finalizada",
      })
      .eq("id", item.id)
      .eq("obra_id", obraId);

    if (error) {
      console.error(error);
      setErro("Erro ao validar atividade.");
      return;
    }

    setMensagem("Atividade validada.");
    await recarregarAtividades();
  }

  function reprogramarPendencias() {
    const pendentes = atividades.filter((item) => item.status !== "Finalizada").length;

    window.localStorage.setItem(
      `obraboard:checkout-reprogramacao:${obraId}:${dataTurnoAtual}:${turno}`,
      JSON.stringify({ obraId, dataTurno: dataTurnoAtual, turno, pendentes })
    );
    setMensagem(`${pendentes} pendencias sinalizadas para reprogramacao.`);
  }

  function encerrarTurno() {
    window.localStorage.setItem(
      `obraboard:checkout-fechamento:${obraId}:${dataTurnoAtual}:${turno}`,
      JSON.stringify({ obraId, dataTurno: dataTurnoAtual, turno, encerradoEm: new Date().toISOString() })
    );
    setMensagem("Turno encerrado para a obra/frente selecionada.");
  }

  function gerarRdo() {
    router.push("/rdo");
  }

  return (
    <DesktopLayout
      titulo="Check-out do Turno"
      subtitulo={`Obra: ${obra} - Turno ${turno || "-"} - Data: ${
        dataTurnoAtual ? formatarDataTurno(dataTurnoAtual) : "-"
      }`}
    >
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Obra ativa: {obra}
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

          <label className="block max-w-sm">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Turno
            </span>
            <select
              value={turno}
              onChange={(e) => alterarTurno(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-3"
            >
              {turnosCadastrados.length === 0 ? (
                <option value="">Cadastre turnos na obra</option>
              ) : (
                turnosCadastrados.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome || "Turno sem nome"} -{" "}
                    {formatarHoras(item.horasTrabalho)}
                  </option>
                ))
              )}
            </select>
          </label>
        </section>

        <div className="grid grid-cols-5 gap-3">
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
            <table className="w-full">
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
                  const farol = obterFarol(item.status, progresso);
                  const editando = atividadeEditandoId === item.id;

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
                      <td className="p-3 text-center text-lg">{farol}</td>
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
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => validarAtividade(item)}
                              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                            >
                              Validar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            <div className="grid grid-cols-2 gap-4 pt-4">
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

        <div className="grid grid-cols-2 gap-4">
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left font-semibold"
              >
                Reprogramar pendencias para proximo turno
              </button>
              <button
                type="button"
                onClick={encerrarTurno}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left font-bold text-white"
              >
                Encerrar turno
              </button>
              <button
                type="button"
                onClick={gerarRdo}
                className="w-full rounded-xl bg-teal-600 px-4 py-3 text-left font-bold text-white"
              >
                Gerar RDO
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
  if (item.progresso !== null && item.progresso !== undefined) {
    return Math.min(100, Math.max(0, Number(item.progresso || 0)));
  }

  const previsto = Number(item.previsto || 0);
  const realizado = Number(item.realizado || 0);

  return previsto > 0 ? Math.min(100, Math.round((realizado / previsto) * 100)) : 0;
}

function obterFarol(status: string, progresso: number) {
  if (status === "Finalizada" || progresso >= 100) {
    return "OK";
  }

  if (status === "Restrição") {
    return "AL";
  }

  return "AT";
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
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
