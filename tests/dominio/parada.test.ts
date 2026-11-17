import { describe, expect, it } from "vitest";
import {
  agoraDoTurno,
  descreverOcorrencia,
  fimPadraoParada,
  linhaOcorrencia,
  paradasAbertas,
  type Ocorrencia,
} from "@/lib/dominio/efetivoHH";
import { horaAgoraSaoPaulo } from "@/lib/dominio/entrada";

const parada = (p: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: "p1", responsavel_id: "joao", funcao: "Mecânico", tipo: "parado", quantidade: 2, hora_inicio: "10:40:00", hora_fim: null,
  destino_responsavel_id: null, emprestimo_id: null, causa: "atividade_predecessora", observacao: null,
  aguardando_responsavel_id: "carlos", foto_path: null, avisado_em: null, created_at: "2026-11-16T13:40:00Z", ...p,
});
const nome = (id: string | null) => ({ joao: "João", carlos: "Carlos" })[id ?? ""] ?? "Sem responsável";
const turno = (p: Partial<{ data: string; periodo: "diurno" | "noturno"; status: "em_campo" | "fechado" }> = {}) => ({
  data: "2026-11-16", periodo: "diurno" as const, status: "em_campo" as const, ...p,
});

describe("agoraDoTurno", () => {
  it("turno fechado: sem agora", () => {
    expect(agoraDoTurno(turno({ status: "fechado" }), "2026-11-16", "10:00")).toBeUndefined();
  });
  it("turno de hoje: a hora atual", () => {
    expect(agoraDoTurno(turno(), "2026-11-16", "10:00")).toBe("10:00");
  });
  it("diurno de ontem esquecido aberto: sem agora", () => {
    expect(agoraDoTurno(turno(), "2026-11-17", "10:00")).toBeUndefined();
  });
  it("noturno de ontem depois da meia-noite: a hora atual", () => {
    expect(agoraDoTurno(turno({ periodo: "noturno" }), "2026-11-17", "02:10")).toBe("02:10");
  });
  it("noturno de ontem à tarde de hoje: sem agora", () => {
    expect(agoraDoTurno(turno({ periodo: "noturno" }), "2026-11-17", "15:00")).toBeUndefined();
  });
});

describe("fimPadraoParada", () => {
  const janela = { inicio: "07:00", fim: "17:00" };
  it("fim do turno", () => {
    expect(fimPadraoParada(parada(), janela)).toBe("17:00");
  });
  it("parada que começou depois do fim: o próprio início (HH 0)", () => {
    expect(fimPadraoParada(parada({ hora_inicio: "17:30" }), janela)).toBe("17:30");
  });
  it("sem janela: o início", () => {
    expect(fimPadraoParada(parada(), null)).toBe("10:40");
  });
});

describe("descrição da parada", () => {
  it("aberta com equipe aguardada", () => {
    expect(descreverOcorrencia(parada(), nome)).toBe("2 parados desde 10:40 · Aguardando outra equipe (Carlos)");
  });
  it("encerrada com equipe aguardada", () => {
    expect(descreverOcorrencia(parada({ hora_fim: "13:15:00" }), nome)).toBe("2 parados 10:40–13:15 · Aguardando outra equipe (Carlos)");
  });
  it("sem equipe aguardada", () => {
    expect(descreverOcorrencia(parada({ causa: "material", aguardando_responsavel_id: null }), nome)).toBe("2 parados desde 10:40 · Falta material");
  });
  it("linha do relatório leva a observação", () => {
    expect(linhaOcorrencia(parada({ hora_fim: "13:15", observacao: "rolamento 6312" }), nome)).toBe(
      "João · Mecânico: 2 parados 10:40–13:15 · Aguardando outra equipe (Carlos) — rolamento 6312",
    );
  });
});

describe("paradasAbertas", () => {
  it("só paradas sem fim", () => {
    const xs = [parada({ id: "a" }), parada({ id: "b", hora_fim: "12:00" }), { ...parada({ id: "c" }), tipo: "saida" as const, causa: null }];
    expect(paradasAbertas(xs).map((o) => o.id)).toEqual(["a"]);
  });
});

describe("horaAgoraSaoPaulo", () => {
  it("fuso de São Paulo", () => {
    expect(horaAgoraSaoPaulo(new Date("2026-11-16T13:40:00Z"))).toBe("10:40");
    expect(horaAgoraSaoPaulo(new Date("2026-11-16T03:05:00Z"))).toBe("00:05");
  });
});
