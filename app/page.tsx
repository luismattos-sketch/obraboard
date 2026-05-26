"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../components/DesktopLayout";
import { supabase } from "../lib/supabase";
import type { Atividade, RecursoDisponivelTurno } from "../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  type FuncaoPrevistaCadastrada,
} from "../lib/cadastro-base";
import {
  listarRestricoesHistorico,
  restricaoStorageKey,
  type RestricaoHistorico,
} from "../lib/operacao";

type MaoObraReal = {
  id: number;
  obra_id?: number | null;
  atividade_id?: number | null;
  funcao: string | null;
  quantidade: number | null;
  turno: string | null;
  data_turno: string | null;
};

type RestricaoAtividade = {
  texto: string;
  status: "aberta" | "resolvida" | "parada";
};

const maoObraLocalStorageKey = "obraboard:mao-obra-local";
const recursosDisponiveisStorageKey = "obraboard:recursos-disponiveis-local";

export default function Home() {
  const [atividadesBanco, setAtividadesBanco] = useState<Atividade[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [obraAtivaNome, setObraAtivaNome] = useState("Sem obra selecionada");
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const [turnoAtivo, setTurnoAtivo] = useState("");
  const [turnoInicio, setTurnoInicio] = useState("");
  const [origemApp, setOrigemApp] = useState("");
  const [agora, setAgora] = useState(() => new Date());
  const [restricoesCampo, setRestricoesCampo] = useState<
    Record<number, RestricaoAtividade>
  >(() => carregarObjetoLocal(restricaoStorageKey));
  const [historicoRestricoes, setHistoricoRestricoes] = useState<RestricaoHistorico[]>([]);
  const [funcoesPrevistas, setFuncoesPrevistas] = useState<
    FuncaoPrevistaCadastrada[]
  >([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<
    RecursoDisponivelTurno[]
  >([]);

  const dataTurnoAtual = obterDataTurnoAtual(atividadesBanco);
  const atividadesDaData = useMemo(
    () =>
      dataTurnoAtual
        ? atividadesBanco.filter((item) => item.data_turno === dataTurnoAtual)
        : atividadesBanco,
    [atividadesBanco, dataTurnoAtual]
  );
  const turnoAtual =
    turnoAtivo || atividadesDaData.find((item) => item.turno)?.turno || "-";
  const atividades = useMemo(
    () =>
      turnoAtual === "-"
        ? atividadesDaData
        : atividadesDaData.filter((item) => item.turno === turnoAtual),
    [atividadesDaData, turnoAtual]
  );
  const recursosReaisPorFuncao = useMemo(() => {
    const mapa = new Map<string, number>();
    const atividadesIds = new Set(atividades.map((item) => item.id));

    maoObraReal
      .filter(
        (item) =>
          item.atividade_id
            ? atividadesIds.has(item.atividade_id)
            : (!dataTurnoAtual || item.data_turno === dataTurnoAtual) &&
              (turnoAtual === "-" || item.turno === turnoAtual)
      )
      .forEach((item) => {
        const funcao = item.funcao || "";

        if (funcao) {
          mapa.set(funcao, (mapa.get(funcao) ?? 0) + Number(item.quantidade || 0));
        }
      });

    return mapa;
  }, [atividades, dataTurnoAtual, maoObraReal, turnoAtual]);
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
  const relogioTurno = formatarRelogioTurno(agora, dataTurnoAtual, turnoInicio);
  const campoTurnoUrl =
    origemApp && obraAtivaId && turnoAtual !== "-"
      ? `${origemApp}/campo?obraId=${obraAtivaId}&turno=${encodeURIComponent(
          turnoAtual
        )}`
      : "";
  const qrCodeUrl = campoTurnoUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(
        campoTurnoUrl
      )}`
    : "";
  const executando = contarStatus(atividades, "Execução");
  const restricoes = contarStatus(atividades, "Restrição");
  const finalizadas = contarStatus(atividades, "Finalizada");
  const parciais = contarStatus(atividades, "Parcial");
  const restricoesPainel = useMemo(() => {
    const idsHistorico = new Set(historicoRestricoes.map((item) => item.atividadeId));
    const restricoesAtivas = atividades
      .filter(
        (item) =>
          item.status.toLowerCase().startsWith("restri") &&
          !idsHistorico.has(item.id)
      )
      .map((item) => ({
        codigo: `R${item.id}`,
        titulo: item.atividade,
        responsavel: item.responsavel,
        observacao: restricoesCampo[item.id]?.texto || "Sem observacao registrada.",
        criticidade: item.prioridade === "A" ? "Alta" : "Media",
        status: restricoesCampo[item.id]?.status || "aberta",
      }));

    const historico = historicoRestricoes.map((item) => ({
      codigo: `R${item.atividadeId}`,
      titulo: item.atividade,
      responsavel: item.responsavel,
      observacao: item.texto || "Sem observacao registrada.",
      criticidade: item.status === "aberta" ? "Alta" : "Encerrada",
      status: item.status === "aberta" ? "aberta" : "Encerrada",
    }));

    return [...restricoesAtivas, ...historico];
  }, [atividades, historicoRestricoes, restricoesCampo]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 30000);
    setOrigemApp(window.location.origin);

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
      const obraAtiva = obterObraAtiva(cadastro);
      const dadosObra = obterDadosObra(cadastro, obraAtiva?.id ?? null);
      const turnoAtivoNome = obterTurnoAtivoNome(
        cadastro,
        obraAtiva?.id ?? null,
        dadosObra.turnos
      );

      setObraAtivaNome(obraAtiva?.nome || "Sem obra selecionada");
      setObraAtivaId(obraAtiva?.id ?? null);
      setFuncoesPrevistas(dadosObra.funcoesPrevistas);
      setTurnoAtivo(turnoAtivoNome);
      setTurnoInicio(
        dadosObra.turnos.find((item) => item.nome === turnoAtivoNome)
          ?.horaInicio || ""
      );
      void carregarAtividades(obraAtiva?.id ?? null);
      void carregarMaoObraReal();
      setRestricoesCampo(carregarObjetoLocal(restricaoStorageKey));
      setHistoricoRestricoes(
        listarRestricoesHistorico(
          obraAtiva?.id ?? null,
          dataTurnoAtual,
          turnoAtivoNome
        )
      );
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
      if (!obraAtivaId || !dataTurnoAtual || !turnoAtual || turnoAtual === "-") {
        setRecursosDisponiveis([]);
        return;
      }

      const locais = carregarListaLocal<RecursoDisponivelTurno>(
        recursosDisponiveisStorageKey
      ).filter(
        (item) =>
          item.obra_id === obraAtivaId &&
          item.data_turno === dataTurnoAtual &&
          item.turno === turnoAtual
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
          data_turno: String(item.data_turno),
          turno: String(item.turno),
          funcao: String(item.funcao),
          quantidade: Number(item.quantidade || 0),
          cargaHoraria: Number(item.carga_horaria || 0),
        })),
        ...locais,
      ]);
    }
  }, [dataTurnoAtual, obraAtivaId, turnoAtual]);

  return (
    <DesktopLayout
      titulo="Painel Check-in / Check-out"
      subtitulo={`Obra: ${obraAtivaNome} - Turno ${turnoAtual} - Inicio: ${dataTurnoFormatada}`}
      status={relogioTurno}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
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

        <div className="grid grid-cols-[1fr_320px] gap-4">
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
                <table className="w-full">
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
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-xl font-bold">Campo do turno</h3>
              <p className="mb-4 text-sm text-slate-500">
                Acesso direto para a obra e turno selecionados.
              </p>

              {qrCodeUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code para abrir a tela Campo deste turno"
                    className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
                  />
                  <a
                    href={campoTurnoUrl}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    Abrir Campo
                  </a>
                </div>
              ) : (
                <EstadoVazio texto="Selecione uma obra e um turno para gerar o QR Code." />
              )}
            </section>

            <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
              <h3 className="text-xl font-bold text-red-600">
                Atencao do turno
              </h3>
              <p className="mb-4 text-sm text-slate-500">
                Restricoes criticas
              </p>

              <div className="space-y-3">
                {restricoesPainel.length === 0 ? (
                  <EstadoVazio texto="Nenhuma restricao critica registrada no turno atual." />
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

function formatarRelogioTurno(
  agora: Date,
  dataTurno: string | null,
  horaInicio: string
) {
  const horaAtual = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!dataTurno || !horaInicio) {
    return `Hora ${horaAtual} - Decorrido --`;
  }

  const inicioTurno = new Date(`${dataTurno}T${horaInicio}`);
  const minutos = Math.max(
    0,
    Math.floor((agora.getTime() - inicioTurno.getTime()) / 60000)
  );
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;

  return `Hora ${horaAtual} - Decorrido ${horas}h ${String(
    minutosRestantes
  ).padStart(2, "0")}min`;
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
