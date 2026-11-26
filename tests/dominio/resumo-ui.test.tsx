import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Resumo } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/Resumo";
import type { TurnoCompleto } from "@/lib/db/turnos";
const SEM_CLIMA = { clima: null, aviso: "indisponivel" as const, parcial: false };

const turno = (ocorrencias: TurnoCompleto["ocorrencias"]): TurnoCompleto => ({
  id: "t", obra_id: "o", data: "2026-11-16", periodo: "diurno",
  hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: null, hora_fim_real: null,
  intervalo_inicio: "12:00:00", intervalo_fim: "13:00:00",
  status: "enviado", token_hash: null, enviado_em: null, fechado_em: null,
  obra: { id: "o", empresa_id: "e", nome: "Obra", cliente: null, endereco: null, created_at: "" },
  atividades: [],
  efetivo: [{ id: "e1", turno_id: "t", funcao: "Montador", quantidade: 2, responsavel_id: "rita" }],
  clima_turno: null,
  ocorrencias,
  responsaveis: [{ id: "rita", nome: "Rita" }, { id: "ana", nome: "Ana" }],
});
const oc = (p: Partial<TurnoCompleto["ocorrencias"][number]>): TurnoCompleto["ocorrencias"][number] => ({
  id: "o1", responsavel_id: "rita", funcao: "Montador", tipo: "emprestimo", quantidade: 3, hora_inicio: "13:00:00", hora_fim: null,
  destino_responsavel_id: "ana", emprestimo_id: null, causa: null, created_at: "1", ...p,
});

describe("Resumo do turno", () => {
  it("mostra aviso de incoerência do efetivo", () => {
    const html = renderToStaticMarkup(<Resumo turno={turno([oc({})])} clima={SEM_CLIMA} />);
    expect(html).toContain("Montador: 3 emprestados, mas a linha tem 2");
  });
  it("mostra HH parado no detalhe do HH", () => {
    const html = renderToStaticMarkup(
      <Resumo turno={turno([oc({ tipo: "parado", quantidade: 2, hora_inicio: "08:00:00", hora_fim: "10:00:00", destino_responsavel_id: null, causa: "material" })])} clima={SEM_CLIMA} />,
    );
    expect(html).toContain("4 HH parados");
  });
});
