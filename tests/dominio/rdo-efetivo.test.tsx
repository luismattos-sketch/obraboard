import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { EfetivoEClima, FotosParadas, ResumoBloco } from "@/lib/rdo/secoes";
import { resumirTurno } from "@/lib/dominio/resumo";
import type { TurnoCompleto } from "@/lib/db/turnos";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";

/** Texto de uma árvore de elementos do PDF, executando os componentes de função. */
function texto(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(texto).join(" ");
  if (isValidElement(n)) {
    const { type, props } = n as { type: unknown; props: { children?: ReactNode } };
    if (typeof type === "function") return texto((type as (p: unknown) => ReactNode)(props));
    return texto(props.children);
  }
  return "";
}

const oc = (p: Partial<Ocorrencia>): Ocorrencia => ({
  id: "o", responsavel_id: "rita", funcao: "Montador de andaime", tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00:00",
  hora_fim: null, destino_responsavel_id: "ana", emprestimo_id: null, causa: null, created_at: "1", ...p,
});

function turno(ocorrencias: Ocorrencia[]): TurnoCompleto {
  return {
    id: "t", obra_id: "o", data: "2026-11-16", periodo: "diurno",
    hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: null, hora_fim_real: null,
    intervalo_inicio: "12:00:00", intervalo_fim: "13:00:00",
    status: "em_campo", token_hash: null, enviado_em: null, fechado_em: null,
    obra: { id: "o", empresa_id: "e", nome: "Obra", cliente: null, endereco: null, created_at: "" },
    atividades: [],
    efetivo: [
      { id: "e1", turno_id: "t", funcao: "Montador de andaime", quantidade: 6, responsavel_id: "rita" },
      { id: "e2", turno_id: "t", funcao: "Caldeireiro", quantidade: 5, responsavel_id: "ana" },
    ],
    clima_turno: null,
    ocorrencias,
    responsaveis: [{ id: "rita", nome: "Rita" }, { id: "ana", nome: "Ana" }],
  };
}

describe("RDO: efetivo e HH", () => {
  const comParado = turno([
    oc({ id: "o1" }),
    oc({ id: "o2", tipo: "parado", quantidade: 2, hora_inicio: "08:00:00", hora_fim: "10:00:00", destino_responsavel_id: null, causa: "material", created_at: "2" }),
  ]);

  it("resumo mostra HH parado e efetivo total sem dobrar", () => {
    const t = texto(ResumoBloco({ resumo: resumirTurno(comParado), turno: comParado }));
    expect(t).toContain("HH parado");
    expect(t).toMatch(/HH parado\s+4/);
    expect(t).toMatch(/Efetivo total\s+11/);
    expect(t).toContain("Falta material 4");
  });

  it("seção de efetivo lista as ocorrências com equipe", () => {
    const t = texto(EfetivoEClima({ turno: comParado, resumo: resumirTurno(comParado) }));
    expect(t).toContain("Rita: 2 Montador de andaime emprestados → Ana a partir de 13:00");
    expect(t).toContain("Rita · Montador de andaime: 2 parados 08:00–10:00 · Falta material");
  });

  it("ocorrência incoerente aparece como aviso no RDO", () => {
    const t = turno([oc({ id: "o1", quantidade: 9 })]);
    expect(texto(EfetivoEClima({ turno: t, resumo: resumirTurno(t) }))).toContain("Montador de andaime: 9 emprestados, mas a linha tem 6");
  });

  it("sem ocorrências não mostra HH parado nem a lista", () => {
    const t0 = turno([]);
    expect(texto(ResumoBloco({ resumo: resumirTurno(t0), turno: t0 }))).not.toContain("HH parado");
    expect(texto(EfetivoEClima({ turno: t0, resumo: resumirTurno(t0) }))).not.toContain("Movimentações");
  });
});

describe("RDO: aviso de parada", () => {
  const p = oc({
    id: "p1", responsavel_id: "rita", funcao: "Montador de andaime", tipo: "parado", quantidade: 2, hora_inicio: "10:40:00",
    hora_fim: "13:15:00", destino_responsavel_id: null, causa: "atividade_predecessora", aguardando_responsavel_id: "ana",
    observacao: "rolamento 6312", foto_path: "e/o/t/p1.jpg", created_at: "2",
  });
  const t = { ...turno([p]), terminados: [{ responsavel_id: "ana", terminou_em: "15:20:00" }, { responsavel_id: "rita", terminou_em: "16:05:00" }] };

  it("parada com equipe aguardada e observação; lote marca a foto no app", () => {
    const x = texto(EfetivoEClima({ turno: t, resumo: resumirTurno(t) }));
    expect(x).toContain("Rita · Montador de andaime: 2 parados 10:40–13:15 · Aguardando outra equipe (Ana) — rolamento 6312 (foto no app)");
  });
  it("com fotos carregadas: sem a marca", () => {
    const x = texto(EfetivoEClima({ turno: t, resumo: resumirTurno(t), comFotos: true }));
    expect(x).not.toContain("(foto no app)");
  });
  it("equipes que terminaram", () => {
    expect(texto(EfetivoEClima({ turno: t, resumo: resumirTurno(t) }))).toContain("Equipes que terminaram: Ana 15:20 · Rita 16:05");
  });
  it("seção de fotos leva a legenda; sem foto carregada, nada", () => {
    expect(texto(FotosParadas({ turno: t, fotos: { "e/o/t/p1.jpg": new Uint8Array([1, 2]) } }))).toContain("Fotos das paradas");
    expect(FotosParadas({ turno: t, fotos: {} })).toBeNull();
  });
  it("clima automático no RDO: chuva, leituras e fonte; sem clima, aviso", () => {
    const base = turno([]);
    const ct = { temp_media: 26.4, temp_max: 31, temp_min: 22, chuva_mm: 4, choveu: true, leituras: [
      { hora: "2026-11-16T07:00", temperatura: 22, chuva_mm: 0, codigo: 1 },
      { hora: "2026-11-16T13:00", temperatura: 30, chuva_mm: 2, codigo: 61 },
    ] };
    const t = texto(EfetivoEClima({ turno: { ...base, clima_turno: ct }, resumo: resumirTurno(base) }));
    expect(t).toContain("Choveu · 4 mm");
    expect(t).toContain("13h Chuva fraca 30°");
    expect(t).toContain("Open-Meteo");
    expect(t).not.toContain("Manhã");
    const sem = texto(EfetivoEClima({ turno: { ...base, obra: { ...base.obra, local_nome: "Macaé" } }, resumo: resumirTurno(base) }));
    expect(sem).toContain("Clima não disponível");
    expect(texto(EfetivoEClima({ turno: base, resumo: resumirTurno(base) }))).toContain("obra sem cidade");
  });
});
