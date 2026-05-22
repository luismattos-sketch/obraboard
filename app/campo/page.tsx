"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Atividade, AtualizacaoAtividade, StatusAtividade } from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  type FuncaoPrevistaCadastrada,
  type TurnoCadastrado,
} from "../../lib/cadastro-base";

export default function CampoPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [turnosCadastrados, setTurnosCadastrados] = useState<
    TurnoCadastrado[]
  >([]);
  const [funcoesPrevistasCadastradas, setFuncoesPrevistasCadastradas] =
    useState<FuncaoPrevistaCadastrada[]>([]);
  const [turno, setTurno] = useState("Dia");
  const [funcao, setFuncao] = useState("");
  const [quantidade, setQuantidade] = useState("");

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

      setObraId(obraAtiva?.id ?? null);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);
      setFuncoesPrevistasCadastradas(dadosObra.funcoesPrevistas);

      if (turnoAtivo) {
        setTurno(turnoAtivo);
      }

      void carregarAtividades(obraAtiva?.id ?? null);
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
    // carregarAtividades recebe o id atual explicitamente neste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function atualizarAtividade(
    id: number,
    status: StatusAtividade,
    realizado?: number
  ) {
    const atualizacao: AtualizacaoAtividade = {
      status,
    };

    if (realizado !== undefined) {
      atualizacao.realizado = realizado;
      atualizacao.progresso = realizado;
    }

    const { error } = await supabase
      .from("atividades")
      .update(atualizacao)
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar atividade.");
      return;
    }

    await carregarAtividades();
  }

  async function adicionarMaoObra() {
    if (!funcao || !quantidade) {
      alert("Informe função e quantidade.");
      return;
    }

    const { error } = await supabase.from("mao_obra").insert([
      {
        funcao,
        quantidade: Number(quantidade),
        turno,
        data_turno: "2026-05-16",
      },
    ]);

    if (error) {
      console.error(error);
      alert("Erro ao salvar mão de obra.");
      return;
    }

    setFuncao("");
    setQuantidade("");

    alert("Mão de obra adicionada!");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <header className="mb-4 rounded-xl bg-slate-900 p-4 text-white">
        <p className="text-xs font-semibold text-teal-200">
          Obra ativa: {obra}
        </p>
        <p className="text-xs text-slate-300">Obra: {obra}</p>

        <h1 className="text-2xl font-bold">Minhas Atividades</h1>

        <p className="text-sm text-slate-300">
          João · Encarregado Mecânico · Turno Dia
        </p>
        <select
          value={turno}
          onChange={(e) => setTurno(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm font-semibold text-white"
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
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <ResumoCard titulo="Total" valor={String(atividades.length)} />

        <ResumoCard
          titulo="Execução"
          valor={String(
            atividades.filter((a) => a.status === "Execução").length
          )}
        />

        <ResumoCard
          titulo="Restrição"
          valor={String(
            atividades.filter((a) => a.status === "Restrição").length
          )}
          destaque="text-red-500"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        <button className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
          Todas
        </button>

        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          Pendentes
        </button>

        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          Execução
        </button>

        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          Restrição
        </button>
      </div>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Mão de obra real</h2>

          <p className="text-sm text-slate-500">
            Informe a equipe mobilizada no campo
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
        {atividades.map((atividade) => {
          const previsto = atividade.previsto || 0;
          const realizado = atividade.realizado || 0;

          const percentual =
            previsto > 0 ? Math.round((realizado / previsto) * 100) : 0;

          return (
            <div
              key={atividade.id}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
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

                  <p className="mt-1 text-sm text-slate-500">
                    Local: {atividade.local}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Resp: {atividade.responsavel}
                  </p>
                </div>

                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    atividade.status === "Restrição"
                      ? "bg-red-100 text-red-700"
                      : atividade.status === "Execução"
                      ? "bg-blue-100 text-blue-700"
                      : atividade.status === "Finalizada"
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {atividade.status}
                </span>
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

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    atualizarAtividade(atividade.id, "Execução")
                  }
                  className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Iniciar
                </button>

                <button
                  onClick={() =>
                    atualizarAtividade(atividade.id, "Parcial")
                  }
                  className="rounded-lg bg-yellow-500 px-3 py-3 text-sm font-bold text-white transition hover:bg-yellow-600"
                >
                  Parcial
                </button>

                <button
                  onClick={() =>
                    atualizarAtividade(atividade.id, "Restrição")
                  }
                  className="rounded-lg bg-red-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                >
                  Restrição
                </button>

                <button
                  onClick={() =>
                    atualizarAtividade(
                      atividade.id,
                      "Finalizada",
                      atividade.previsto
                    )
                  }
                  className="rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                >
                  Finalizar
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </main>
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
