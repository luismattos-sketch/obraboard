import DesktopLayout from "../components/DesktopLayout";
import { supabase } from "../lib/supabase";

export default async function Home() {
  const { data: atividadesBanco } = await supabase
    .from("atividades")
    .select("*")
    .order("id", { ascending: true });

  const atividades = atividadesBanco ?? [];

  const executando = atividades.filter(
    (a) => a.status === "Execução"
  ).length;

  const restricoes = atividades.filter(
    (a) => a.status === "Restrição"
  ).length;

  const finalizadas = atividades.filter(
    (a) => a.status === "Finalizada"
  ).length;

  const parciais = atividades.filter(
    (a) => a.status === "Parcial"
  ).length;

  return (
    <DesktopLayout
      titulo="Painel Check-in / Check-out"
      subtitulo="Obra: Laminação L1 · Turno Dia · Início: 16/05/2026 07:00"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          <KpiCard
            titulo="Atividades"
            valor={String(atividades.length)}
          />

          <KpiCard
            titulo="Execução"
            valor={String(executando)}
          />

          <KpiCard
            titulo="Restrições"
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
              <div className="border-b p-4">
                <h3 className="text-lg font-bold">
                  Recursos
                </h3>

                <p className="text-sm text-slate-500">
                  Previsto x real
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3 p-4">
                <RecursoCard
                  nome="Mecânico"
                  previsto={4}
                  real={3}
                />

                <RecursoCard
                  nome="Soldador"
                  previsto={2}
                  real={2}
                />

                <RecursoCard
                  nome="Eletricista"
                  previsto={3}
                  real={4}
                />

                <RecursoCard
                  nome="Ajudante"
                  previsto={6}
                  real={5}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <h3 className="text-lg font-bold">
                    Gestão operacional
                  </h3>

                  <p className="text-sm text-slate-500">
                    Frentes, tarefas e oportunidades
                  </p>
                </div>

                <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
                  Atualizar
                </button>
              </div>

              <table className="w-full">
                <thead className="bg-slate-50 text-sm">
                  <tr>
                    <th className="p-3 text-left">Pri</th>
                    <th className="p-3 text-left">Disc</th>
                    <th className="p-3 text-left">
                      Atividade
                    </th>
                    <th className="p-3 text-left">
                      Local
                    </th>
                    <th className="p-3 text-left">
                      Resp
                    </th>
                    <th className="p-3 text-center">
                      Prev
                    </th>
                    <th className="p-3 text-center">
                      Real
                    </th>
                    <th className="p-3 text-center">
                      Status
                    </th>
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

                      <td className="p-3 font-semibold">
                        {item.disciplina}
                      </td>

                      <td className="p-3 font-medium">
                        {item.atividade}
                      </td>

                      <td className="p-3">
                        {item.local}
                      </td>

                      <td className="p-3">
                        {item.responsavel}
                      </td>

                      <td className="p-3 text-center">
                        {item.previsto}
                      </td>

                      <td className="p-3 text-center">
                        {item.realizado}
                      </td>

                      <td className="p-3 text-center">
                        <StatusBadge
                          status={item.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
              <h3 className="text-xl font-bold text-red-600">
                Atenção do turno
              </h3>

              <p className="mb-4 text-sm text-slate-500">
                Restrições críticas
              </p>

              <div className="space-y-3">
                <RestricaoCard
                  codigo="R1"
                  titulo="Falta martelete para demolição"
                  responsavel="Rafael"
                  prazo="Hoje 14h"
                  criticidade="Alta"
                />

                <RestricaoCard
                  codigo="R2"
                  titulo="Aguardando ponte rolante"
                  responsavel="Operação"
                  prazo="Hoje 16h"
                  criticidade="Média"
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xl font-bold">
                Observações
              </h3>

              <p className="text-sm leading-7 text-slate-600">
                Área parcialmente liberada.
                Necessário acompanhar restrição
                da ponte rolante antes do checkout.
                Priorizar liberação da frente civil.
              </p>
            </section>
          </div>
        </div>
      </div>
    </DesktopLayout>
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
      <p className="text-sm text-slate-500">
        {titulo}
      </p>

      <h3 className={`text-4xl font-bold ${destaque}`}>
        {valor}
      </h3>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "Finalizada") {
    return (
      <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
        Finalizada
      </span>
    );
  }

  if (status === "Restrição") {
    return (
      <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
        Restrição
      </span>
    );
  }

  if (status === "Parcial") {
    return (
      <span className="rounded-md bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">
        Parcial
      </span>
    );
  }

  return (
    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
      {status}
    </span>
  );
}

function RecursoCard({
  nome,
  previsto,
  real,
}: {
  nome: string;
  previsto: number;
  real: number;
}) {
  const percentual = Math.round(
    (real / previsto) * 100
  );

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-bold">{nome}</h4>

        <span className="text-sm font-bold">
          {percentual}%
        </span>
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
          style={{
            width: `${Math.min(percentual, 100)}%`,
          }}
        />
      </div>

      <p className="text-xs text-slate-500">
        Prev {previsto} · Real {real}
      </p>
    </div>
  );
}

function RestricaoCard({
  codigo,
  titulo,
  responsavel,
  prazo,
  criticidade,
}: {
  codigo: string;
  titulo: string;
  responsavel: string;
  prazo: string;
  criticidade: string;
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

      <h4 className="mb-3 text-lg font-bold">
        {titulo}
      </h4>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white p-2">
          <p className="text-xs text-slate-500">
            Responsável
          </p>

          <p className="font-semibold">
            {responsavel}
          </p>
        </div>

        <div className="rounded-lg bg-white p-2">
          <p className="text-xs text-slate-500">
            Prazo
          </p>

          <p className="font-semibold">
            {prazo}
          </p>
        </div>
      </div>
    </div>
  );
}