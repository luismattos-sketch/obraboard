"use client";

import { useEffect, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";

const atividadesExecutadas = [
  {
    atividade: "Passagem de cabos",
    disc: "ELE",
    local: "Área 2",
    responsavel: "Carlos",
    status: "Finalizada",
    progresso: "100%",
  },
  {
    atividade: "Montagem estrutura laminador",
    disc: "MEC",
    local: "L1",
    responsavel: "João",
    status: "Parcial",
    progresso: "40%",
  },
];

const restricoes = [
  {
    id: "R1",
    descricao: "Falta martelete para demolição",
    acao: "Remanejar ferramenta de outra frente",
    responsavel: "Rafael",
    prazo: "Hoje 14h",
    status: "Aberta",
  },
  {
    id: "R2",
    descricao: "Aguardando liberação da ponte rolante",
    acao: "Acionar operação para liberação",
    responsavel: "Operação",
    prazo: "Hoje 16h",
    status: "Em tratativa",
  },
];

export default function RdoPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [obra, setObra] = useState("Sem obra selecionada");
  const [turnosCadastrados, setTurnosCadastrados] = useState<
    TurnoCadastrado[]
  >([]);
  const [turno, setTurno] = useState("Dia");

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

      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);

      if (turnoAtivo) {
        setTurno(turnoAtivo);
      }
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
  }, []);

  return (
    <DesktopLayout
      titulo="RDO"
      subtitulo="Relatório Diário de Obra"
    >
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
                <>
                  <option value="Dia">Turno Dia</option>
                  <option value="Noite">Turno Noite</option>
                </>
              ) : (
                turnosCadastrados.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome || "Turno sem nome"} ·{" "}
                    {formatarHoras(item.horasTrabalho)}
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
                  Check-in / Check-out operacional
                </p>
              </div>

              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo da empresa"
                  className="max-h-20 max-w-36 object-contain"
                />
              ) : (
                <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                  LOGO EMPRESA
                </div>
              )}
            </div>
          </header>

          <section className="mb-8 grid grid-cols-2 gap-4">
            <InfoCard label="Obra" value={obra} />
            <InfoCard label="Data" value="16/05/2026" />
            <InfoCard label="Turno" value={turno} />
            <InfoCard label="Início do turno" value="07:00" />
            <InfoCard label="Responsável pela execução" value="João - Encarregado Mecânico" />
            <InfoCard label="Status" value="Turno encerrado" />
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              Resumo do Turno
            </h2>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
              Durante o turno foram executadas atividades de montagem mecânica,
              passagem de cabos e concretagem parcial. Houve restrição na frente
              civil devido à falta de martelete. Também foi registrada
              dependência operacional relacionada à liberação da ponte rolante.
            </div>
          </section>

          <section className="mb-8 grid grid-cols-4 gap-3">
            <KpiCard label="PPC" value="72%" />
            <KpiCard label="Aderência" value="33%" />
            <KpiCard label="Finalizadas" value="12" />
            <KpiCard label="Restrições" value="3" />
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">
              Recursos Mobilizados
            </h2>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">
                    Função
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Previsto
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Real
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Desvio
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td className="border border-slate-300 p-2">Mecânico</td>
                  <td className="border border-slate-300 p-2 text-center">
                    4
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    3
                  </td>
                  <td className="border border-slate-300 p-2 text-center text-red-600">
                    -1
                  </td>
                </tr>

                <tr>
                  <td className="border border-slate-300 p-2">Soldador</td>
                  <td className="border border-slate-300 p-2 text-center">
                    2
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    2
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    0
                  </td>
                </tr>

                <tr>
                  <td className="border border-slate-300 p-2">Eletricista</td>
                  <td className="border border-slate-300 p-2 text-center">
                    3
                  </td>
                  <td className="border border-slate-300 p-2 text-center">
                    4
                  </td>
                  <td className="border border-slate-300 p-2 text-center text-amber-600">
                    +1
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">
              Atividades do Turno
            </h2>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">
                    Disc
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Atividade
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Local
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Responsável
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Status
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Avanço
                  </th>
                </tr>
              </thead>

              <tbody>
                {atividadesExecutadas.map((item) => (
                  <tr key={item.atividade}>
                    <td className="border border-slate-300 p-2">
                      {item.disc}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.atividade}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.local}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.responsavel}
                    </td>

                    <td className="border border-slate-300 p-2 text-center">
                      {item.status}
                    </td>

                    <td className="border border-slate-300 p-2 text-center">
                      {item.progresso}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">
              Restrições e Tratativas
            </h2>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">
                    ID
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Restrição
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Tratativa
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Responsável
                  </th>

                  <th className="border border-slate-300 p-2 text-left">
                    Prazo
                  </th>

                  <th className="border border-slate-300 p-2 text-center">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {restricoes.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-slate-300 p-2">
                      {item.id}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.descricao}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.acao}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.responsavel}
                    </td>

                    <td className="border border-slate-300 p-2">
                      {item.prazo}
                    </td>

                    <td className="border border-slate-300 p-2 text-center">
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-bold">
              Observações Finais
            </h2>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
              Priorizar no próximo turno a liberação da ponte rolante e o
              fornecimento do martelete para conclusão das atividades civis.
            </div>
          </section>

          <footer className="mt-16 grid grid-cols-2 gap-10 text-sm">
            <div className="border-t border-slate-400 pt-2 text-center">
              Responsável pelo fechamento
            </div>

            <div className="border-t border-slate-400 pt-2 text-center">
              Aprovação / Cliente
            </div>
          </footer>
        </div>
        </div>
      </div>
    </DesktopLayout>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-100 p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-1 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
}
