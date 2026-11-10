import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentoRdo } from "@/lib/rdo/documento";
import { nomeArquivoRdo } from "@/lib/rdo/nome-arquivo";
import { sanitizarProfundo, textoWinAnsi } from "@/lib/rdo/texto";
import { resumirTurno } from "@/lib/dominio/resumo";
import type { Causa } from "@/lib/dominio/tipos";
import type { TurnoCompleto } from "@/lib/db/turnos";

const CAUSAS_EX: Causa[] = ["material", "mao_de_obra", "clima", "equipamento"];

function turno(n: number, status: TurnoCompleto["status"] = "em_campo"): TurnoCompleto {
  const atividades = Array.from({ length: n }, (_, i) => ({
    id: `a${i}`, turno_id: "t", ordem: i,
    descricao: `Concretagem, Instalação elétrica, Fundação — item ${i + 1} com descrição longa para forçar quebra de linha no PDF`,
    local: i % 2 ? "Bloco B · 3º pavimento" : null, unidade: "m³", qtd_planejada: 10,
    qtd_realizada: i % 3 === 0 ? null : i % 3 === 1 ? 10 : 4,
    causa: i % 3 === 2 ? CAUSAS_EX[i % 4] : null, observacao: i % 3 === 2 ? "Material não entregue" : null, origem_id: null,
  }));
  return {
    id: "t", obra_id: "o", data: "2026-11-08", periodo: "diurno",
    hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: "07:10:00", hora_fim_real: "16:50:00",
    status, token_hash: null, enviado_em: null, fechado_em: null,
    obra: { id: "o", empresa_id: "e", nome: "Edifício Aurora", cliente: "Construtora Ágil", endereco: "Av. São João, 100 — São Paulo/SP", created_at: "" },
    atividades,
    efetivo: [{ id: "e1", turno_id: "t", funcao: "Pedreiro", quantidade: 4 }, { id: "e2", turno_id: "t", funcao: "Servente", quantidade: 2 }],
    clima: [{ turno_id: "t", periodo: "manha", condicao: "bom", impediu: false }, { turno_id: "t", periodo: "tarde", condicao: "chuva_forte", impediu: true }],
  } as unknown as TurnoCompleto;
}

describe("nomeArquivoRdo", () => {
  it("monta o nome sem acentos", () => {
    expect(nomeArquivoRdo("Edifício Aurora", "2026-11-08", "diurno")).toBe("RDO-edificio-aurora-2026-11-08-diurno.pdf");
  });
  it("normaliza símbolos e colapsa hífens", () => {
    expect(nomeArquivoRdo("  Residencial  São João / Fase #2 ", "2026-11-08", "noturno")).toBe(
      "RDO-residencial-sao-joao-fase-2-2026-11-08-noturno.pdf",
    );
  });
  it("usa 'obra' quando o slug fica vazio", () => {
    expect(nomeArquivoRdo("!!!", "2026-11-08", "diurno")).toBe("RDO-obra-2026-11-08-diurno.pdf");
  });
});

describe("DocumentoRdo", () => {
  const geradoEm = new Date("2026-11-08T21:30:00Z");

  it("renderiza PDF de várias páginas (40 atividades)", async () => {
    const t = turno(40);
    const buf = await renderToBuffer(<DocumentoRdo turno={t} resumo={resumirTurno(t)} geradoEm={geradoEm} />);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect((buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    if (process.env.RDO_EXEMPLO) {
      const dir = path.join(process.cwd(), ".superpowers", "sdd", "2026-11-08-frentia-mvp");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "rdo-exemplo.pdf"), buf);
      const f = turno(12, "fechado");
      writeFileSync(path.join(dir, "rdo-exemplo-fechado.pdf"), await renderToBuffer(<DocumentoRdo turno={f} resumo={resumirTurno(f)} geradoEm={geradoEm} />));
    }
  }, 60000);

  it("remove caracteres fora do WinAnsi (emoji) e renderiza", async () => {
    const limpo = textoWinAnsi("👍 ok");
    expect(limpo).toBe(" ok");
    expect(/\p{Extended_Pictographic}/u.test(limpo)).toBe(false);
    // acentos, símbolos do Windows-1252 e m³ continuam
    expect(textoWinAnsi("Fundação — 3º pav. · 10 m³ “ok” €")).toBe("Fundação — 3º pav. · 10 m³ “ok” €");
    expect(textoWinAnsi("a−b → c ✅🏗️")).toBe("a-b -> c ");

    const base = turno(2);
    const t = {
      ...base,
      obra: { ...base.obra, nome: "Obra 🚧 Aurora" },
      atividades: base.atividades.map((a) => ({ ...a, descricao: "👍 ok", observacao: "feito ✅" })),
      efetivo: [{ id: "e1", turno_id: "t", funcao: "Pedreiro 👷", quantidade: 2 }],
    } as TurnoCompleto;
    const buf = await renderToBuffer(<DocumentoRdo turno={t} resumo={resumirTurno(t)} geradoEm={geradoEm} />);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const limpos = sanitizarProfundo({ t, n: 1, nada: null });
    expect(JSON.stringify(limpos)).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(limpos.n).toBe(1);
    expect(limpos.nada).toBeNull();
  }, 30000);

  it("renderiza turno vazio fechado", async () => {
    const t = { ...turno(0, "fechado"), efetivo: [], clima: [] } as TurnoCompleto;
    const buf = await renderToBuffer(<DocumentoRdo turno={t} resumo={resumirTurno(t)} geradoEm={geradoEm} />);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);
});
