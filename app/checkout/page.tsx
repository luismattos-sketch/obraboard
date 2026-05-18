import DesktopLayout from "../../components/DesktopLayout";

const atividadesCheckout = [
  {
    id: "A3",
    pri: "A",
    disc: "CIV",
    atividade: "Concretagem base",
    local: "Pátio",
    resp: "Marcos",
    progresso: 20,
    status: "Restrição",
    farol: "🔴",
    acao: "Reprogramar",
  },
  {
    id: "A1",
    pri: "A",
    disc: "MEC",
    atividade: "Montagem estrutura laminador",
    local: "L1",
    resp: "João",
    progresso: 40,
    status: "Parcial",
    farol: "🟡",
    acao: "Ajustar",
  },
  {
    id: "A2",
    pri: "B",
    disc: "ELE",
    atividade: "Passagem de cabos",
    local: "Área 2",
    resp: "Carlos",
    progresso: 100,
    status: "Finalizada",
    farol: "🟢",
    acao: "Validar",
  },
];

const restricoesCheckout = [
  {
    id: "R1",
    atividade: "Concretagem base",
    descricao: "Falta martelete para demolição",
    responsavelAtual: "Marcos",
    impacto: "Alto",
    status: "Aberta",
  },
  {
    id: "R2",
    atividade: "Montagem estrutura laminador",
    descricao: "Aguardando liberação da ponte rolante",
    responsavelAtual: "João",
    impacto: "Médio",
    status: "Tratativa",
  },
];

export default function CheckoutPage() {
  return (
    <DesktopLayout
      titulo="Check-out do Turno"
      subtitulo="Obra: Laminação L1 · Turno Dia · Início: 16/05/2026 07:00"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          <ResumoCard titulo="Planejadas" valor="18" />
          <ResumoCard titulo="Finalizadas" valor="12" destaque="text-green-600" />
          <ResumoCard titulo="Parciais" valor="5" destaque="text-yellow-500" />
          <ResumoCard titulo="Restrições" valor="3" destaque="text-red-500" />
          <ResumoCard titulo="PPC" valor="72%" destaque="text-blue-600" />
        </div>

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="border-b p-4">
            <h3 className="text-lg font-bold">Validação das atividades</h3>
            <p className="text-sm text-slate-500">
              Ordem sugerida: restrições, parciais e finalizadas
            </p>
          </div>

          <table className="w-full">
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
              {atividadesCheckout.map((item) => (
                <tr key={item.id} className="border-t text-sm hover:bg-slate-50">
                  <td className="p-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold ${
                        item.pri === "A"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.pri}
                    </span>
                  </td>

                  <td className="p-3 font-semibold">{item.disc}</td>
                  <td className="p-3 font-medium">{item.atividade}</td>
                  <td className="p-3">{item.local}</td>
                  <td className="p-3">{item.resp}</td>

                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full ${
                            item.progresso >= 100
                              ? "bg-green-500"
                              : item.progresso >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${item.progresso}%` }}
                        />
                      </div>

                      <span className="w-10 text-xs font-bold">
                        {item.progresso}%
                      </span>
                    </div>
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        item.status === "Finalizada"
                          ? "bg-green-100 text-green-700"
                          : item.status === "Restrição"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="p-3 text-center text-lg">{item.farol}</td>

                  <td className="p-3 text-center">
                    <button
                      className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${
                        item.acao === "Validar"
                          ? "bg-green-600"
                          : item.acao === "Reprogramar"
                          ? "bg-red-600"
                          : "bg-yellow-500"
                      }`}
                    >
                      {item.acao}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-red-600">
              Tratativa de Restrições
            </h3>
            <p className="text-sm text-slate-500">
              Registrar decisão, responsável, prazo e status para cada restrição
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {restricoesCheckout.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                    {item.id}
                  </span>

                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-red-700">
                    Impacto {item.impacto}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900">
                  {item.descricao}
                </h4>

                <p className="mt-1 text-sm text-slate-600">
                  Atividade:{" "}
                  <span className="font-semibold text-red-600">
                    {item.atividade}
                  </span>
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Ação definida
                    </label>
                    <select className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">
                      <option>Selecionar ação</option>
                      <option>Comprar material</option>
                      <option>Remanejar recurso</option>
                      <option>Acionar operação</option>
                      <option>Solicitar fornecedor</option>
                      <option>Reprogramar atividade</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Responsável pela solução
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                      placeholder={item.responsavelAtual}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Prazo
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                      placeholder="Ex.: Hoje 16h"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Status
                    </label>
                    <select className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">
                      <option>{item.status}</option>
                      <option>Aberta</option>
                      <option>Em tratativa</option>
                      <option>Resolvida</option>
                      <option>Reprogramada</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Observação da tratativa
                  </label>
                  <textarea
                    className="min-h-[70px] w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                    placeholder="Descreva a tratativa definida no checkout..."
                  />
                </div>

                <div className="mt-3 flex justify-end">
                  <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">
                    Salvar tratativa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
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
              <button className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left font-semibold">
                Reprogramar pendências para próximo turno
              </button>

              <button className="w-full rounded-xl bg-teal-600 px-4 py-3 text-left font-bold text-white">
                Gerar RDO
              </button>

              <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left font-bold text-white">
                Encerrar turno
              </button>
            </div>
          </section>
        </div>
      </div>
    </DesktopLayout>
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