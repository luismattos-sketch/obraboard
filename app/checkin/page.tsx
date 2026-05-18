"use client";

import { useEffect, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";

export default function CheckinPage() {
  const [prioridade, setPrioridade] = useState("A");
  const [disciplina, setDisciplina] = useState("");
  const [atividade, setAtividade] = useState("");
  const [local, setLocal] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [previsto, setPrevisto] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [atividades, setAtividades] = useState<any[]>([]);

  async function carregarAtividades() {
    const { data } = await supabase
      .from("atividades")
      .select("*")
      .order("id", { ascending: true });

    setAtividades(data || []);
  }

  useEffect(() => {
    carregarAtividades();
  }, []);

  async function adicionarAtividade() {
    if (!atividade || !disciplina || !local || !responsavel || !previsto) {
      alert("Preencha todos os campos da atividade.");
      return;
    }

    const { error } = await supabase.from("atividades").insert([
      {
        prioridade,
        disciplina,
        atividade,
        local,
        responsavel,
        previsto: Number(previsto),
        unidade,
        realizado: 0,
        status: "Planejada",
        progresso: 0,
        turno: "Dia",
        data_turno: "2026-05-16",
      },
    ]);

    if (error) {
      console.error(error);
      alert("Erro ao salvar atividade.");
      return;
    }

    await carregarAtividades();

    setPrioridade("A");
    setDisciplina("");
    setAtividade("");
    setLocal("");
    setResponsavel("");
    setPrevisto("");
    setUnidade("un");

    alert("Atividade adicionada com sucesso!");
  }

  return (
    <DesktopLayout
      titulo="Check-in Operacional"
      subtitulo="Planejamento e publicação do turno"
    >
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Informações do turno</h2>

          <div className="grid grid-cols-4 gap-4">
            <input
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Obra"
            />

            <input
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Data"
            />

            <select className="rounded-lg border border-slate-300 p-3">
              <option>Turno Dia</option>
              <option>Turno Noite</option>
            </select>

            <input
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Planejador"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Nova atividade</h2>

          <div className="grid grid-cols-6 gap-3">
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              className="rounded-lg border border-slate-300 p-3"
            >
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>

            <input
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Disciplina"
            />

            <input
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              className="col-span-2 rounded-lg border border-slate-300 p-3"
              placeholder="Atividade"
            />

            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Local"
            />

            <input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Responsável"
            />
          </div>

          <div className="mt-3 grid grid-cols-6 gap-3">
            <input
              value={previsto}
              onChange={(e) => setPrevisto(e.target.value)}
              type="number"
              className="rounded-lg border border-slate-300 p-3"
              placeholder="Previsto"
            />

            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="rounded-lg border border-slate-300 p-3"
            >
              <option value="un">un</option>
              <option value="m">m</option>
              <option value="m²">m²</option>
              <option value="m³">m³</option>
              <option value="kg">kg</option>
              <option value="t">t</option>
              <option value="peça">peça</option>
              <option value="suporte">suporte</option>
              <option value="base">base</option>
              <option value="equipamento">equipamento</option>
              <option value="linha">linha</option>
              <option value="lance">lance</option>
            </select>

            <button
              onClick={adicionarAtividade}
              className="col-span-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
            >
              Adicionar atividade
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Atividades do turno</h2>

            <span className="text-sm text-slate-500">
              {atividades.length} atividades
            </span>
          </div>

          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3 text-left">Pri</th>
                <th className="p-3 text-left">Disc</th>
                <th className="p-3 text-left">Atividade</th>
                <th className="p-3 text-left">Local</th>
                <th className="p-3 text-left">Responsável</th>
                <th className="p-3 text-center">Previsto</th>
                <th className="p-3 text-center">Unidade</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>

            <tbody>
              {atividades.map((item) => (
                <tr key={item.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-bold text-red-500">
                    {item.prioridade}
                  </td>

                  <td className="p-3">{item.disciplina}</td>

                  <td className="p-3 font-medium">{item.atividade}</td>

                  <td className="p-3">{item.local}</td>

                  <td className="p-3">{item.responsavel}</td>

                  <td className="p-3 text-center">{item.previsto}</td>

                  <td className="p-3 text-center">{item.unidade || "un"}</td>

                  <td className="p-3 text-center">
                    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Recursos previstos</h2>

          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3 text-left">Função</th>
                <th className="p-3 text-left">Previsto</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-t">
                <td className="p-3">Mecânico</td>
                <td className="p-3">4</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Observações</h2>

          <textarea
            className="min-h-[120px] w-full rounded-lg border border-slate-300 p-4"
            placeholder="Digite observações do turno..."
          />
        </section>

        <div className="flex justify-end">
          <button className="rounded-xl bg-slate-900 px-6 py-4 text-lg font-bold text-white transition hover:bg-slate-700">
            Publicar turno
          </button>
        </div>
      </div>
    </DesktopLayout>
  );
}