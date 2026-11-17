import { describe, expect, it } from "vitest";
import { validarIntervalo, validarOcorrencia, type DadosOcorrencia } from "@/lib/db/validacao";

const ID = "6b1f6f0e-6a0a-4f43-9d8e-2b7a0f1d2c3e";
const DEST = "0d1c2b3a-4f5e-4a6b-8c7d-9e0f1a2b3c4d";
const DIA = { inicio: "07:00", fim: "17:00" };
const base: DadosOcorrencia = {
  id: ID, tipo: "parado", funcao: "Montador", quantidade: 2, hora_inicio: "08:00", hora_fim: "10:00",
  destino_responsavel_id: null, emprestimo_id: null, causa: "material",
};

describe("validarOcorrencia", () => {
  it("parado válido passa e apara a função", () => {
    const r = validarOcorrencia({ ...base, funcao: "  Montador " }, DIA);
    expect(r).toEqual({ ok: true, dados: { ...base, funcao: "Montador" } });
  });
  it("hora inválida", () => {
    expect(validarOcorrencia({ ...base, hora_inicio: "25:00" }, DIA).ok).toBe(false);
  });
  it("parado sem causa", () => {
    const r = validarOcorrencia({ ...base, causa: null }, DIA);
    expect(r).toMatchObject({ ok: false, erro: "Informe a causa" });
  });
  it("parado com fim antes do início", () => {
    const r = validarOcorrencia({ ...base, hora_inicio: "10:00", hora_fim: "08:00" }, DIA);
    expect(r).toMatchObject({ ok: false, erro: "O fim deve ser depois do início" });
  });
  it("horário fora do turno", () => {
    const r = validarOcorrencia({ ...base, hora_inicio: "05:00" }, DIA);
    expect(r).toMatchObject({ ok: false, erro: "Horário fora do turno (07:00–17:00)" });
  });
  it("noturno aceita parada depois da meia-noite", () => {
    expect(validarOcorrencia({ ...base, hora_inicio: "23:00", hora_fim: "01:00" }, { inicio: "22:00", fim: "06:00" }).ok).toBe(true);
  });
  it("sem janela: parado com início igual ao fim é recusado", () => {
    expect(validarOcorrencia({ ...base, hora_fim: "08:00" }, null).ok).toBe(false);
    expect(validarOcorrencia(base, null).ok).toBe(true);
  });
  it("empréstimo sem destino", () => {
    const r = validarOcorrencia({ ...base, tipo: "emprestimo", hora_fim: null, causa: null }, DIA);
    expect(r).toMatchObject({ ok: false, erro: "Escolha a equipe que recebe" });
  });
  it("empréstimo válido limpa causa", () => {
    const r = validarOcorrencia({ ...base, tipo: "emprestimo", hora_fim: null, causa: null, destino_responsavel_id: DEST }, DIA);
    expect(r.ok).toBe(true);
  });
  it("saída não tem fim", () => {
    const r = validarOcorrencia({ ...base, tipo: "saida", causa: null, hora_fim: null }, DIA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.hora_fim).toBeNull();
  });
  it("empréstimo sobre empréstimo é recusado", () => {
    const r = validarOcorrencia({ ...base, tipo: "emprestimo", causa: null, hora_fim: null, destino_responsavel_id: DEST, emprestimo_id: DEST }, DIA);
    expect(r.ok).toBe(false);
  });
  it("quantidade fracionada", () => {
    expect(validarOcorrencia({ ...base, quantidade: 1.5 }, DIA)).toMatchObject({
      ok: false, erro: "Quantidade deve ser um número inteiro entre 1 e 999",
    });
  });
  it("id que não é uuid", () => {
    expect(validarOcorrencia({ ...base, id: "x" }, DIA).ok).toBe(false);
  });
});

describe("validarIntervalo", () => {
  it("vazio = sem intervalo", () => {
    expect(validarIntervalo({ inicio: "", fim: "" }, "diurno")).toEqual({ ok: true, dados: null });
  });
  it("só um lado preenchido", () => {
    expect(validarIntervalo({ inicio: "12:00", fim: "" }, "diurno")).toMatchObject({ ok: false, erro: "Informe início e fim do intervalo" });
  });
  it("diurno com fim antes do início é recusado", () => {
    expect(validarIntervalo({ inicio: "13:00", fim: "12:00" }, "diurno")).toMatchObject({
      ok: false, erro: "O fim do intervalo deve ser depois do início",
    });
  });
  it("noturno pode atravessar a meia-noite", () => {
    expect(validarIntervalo({ inicio: "23:30", fim: "00:30" }, "noturno")).toEqual({ ok: true, dados: { inicio: "23:30", fim: "00:30" } });
  });
  it("hora inválida", () => {
    expect(validarIntervalo({ inicio: "12:00", fim: "99:00" }, "diurno").ok).toBe(false);
  });
});
