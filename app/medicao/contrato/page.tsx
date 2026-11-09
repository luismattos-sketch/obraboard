"use client";

import { useMemo, useState } from "react";
import MedicaoShell from "../_components/MedicaoShell";

type LinhaContrato = {
  id: number;
  recurso: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
};

const linhaInicial: LinhaContrato = {
  id: 1,
  recurso: "",
  quantidade: "",
  unidade: "",
  valorUnitario: "",
};

export default function MedicaoContratoPage() {
  const [linhas, setLinhas] = useState<LinhaContrato[]>([linhaInicial]);

  const valorTotalContrato = useMemo(
    () =>
      linhas.reduce(
        (total, linha) =>
          total +
          converterNumero(linha.quantidade) *
            converterNumero(linha.valorUnitario),
        0
      ),
    [linhas]
  );

  function atualizarLinha(
    id: number,
    campo: keyof Omit<LinhaContrato, "id">,
    valor: string
  ) {
    setLinhas((atuais) =>
      atuais.map((linha) =>
        linha.id === id ? { ...linha, [campo]: valor } : linha
      )
    );
  }

  function adicionarLinha() {
    setLinhas((atuais) => [
      ...atuais,
      {
        id: Date.now(),
        recurso: "",
        quantidade: "",
        unidade: "",
        valorUnitario: "",
      },
    ]);
  }

  function removerLinha(id: number) {
    setLinhas((atuais) =>
      atuais.length === 1 ? atuais : atuais.filter((linha) => linha.id !== id)
    );
  }

  return (
    <MedicaoShell>
      <section className="rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Cadastro do contrato
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              QQP do contrato
            </h3>

            <p className="mt-2 max-w-3xl text-slate-600">
              Cadastre os recursos do contrato em formato de planilha. O valor
              total é calculado por quantidade vezes valor unitário.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-bold uppercase text-slate-400">
              Total do contrato
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatarMoeda(valorTotalContrato)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="w-14 px-3 py-3">Item</th>
                <th className="px-3 py-3">Recurso</th>
                <th className="w-36 px-3 py-3">Quantidade</th>
                <th className="w-32 px-3 py-3">Unidade</th>
                <th className="w-44 px-3 py-3">Valor unitário</th>
                <th className="w-44 px-3 py-3">Valor total</th>
                <th className="w-28 px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {linhas.map((linha, indice) => {
                const valorTotal =
                  converterNumero(linha.quantidade) *
                  converterNumero(linha.valorUnitario);

                return (
                  <tr
                    key={linha.id}
                    className="border-b border-slate-200 align-middle"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-500">
                      {indice + 1}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={linha.recurso}
                        onChange={(evento) =>
                          atualizarLinha(
                            linha.id,
                            "recurso",
                            evento.target.value
                          )
                        }
                        placeholder="Ex.: Concreto, forma, aço..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={linha.quantidade}
                        onChange={(evento) =>
                          atualizarLinha(
                            linha.id,
                            "quantidade",
                            evento.target.value
                          )
                        }
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={linha.unidade}
                        onChange={(evento) =>
                          atualizarLinha(
                            linha.id,
                            "unidade",
                            evento.target.value
                          )
                        }
                        placeholder="un, m², m³"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={linha.valorUnitario}
                        onChange={(evento) =>
                          atualizarLinha(
                            linha.id,
                            "valorUnitario",
                            evento.target.value
                          )
                        }
                        placeholder="R$ 0,00"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {formatarMoeda(valorTotal)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removerLinha(linha.id)}
                        disabled={linhas.length === 1}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-600"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={adicionarLinha}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Adicionar linha
            </button>
          </div>
        </div>
      </section>
    </MedicaoShell>
  );
}

function converterNumero(valor: string) {
  const normalizado = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}
