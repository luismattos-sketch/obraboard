import { describe, it, expect } from "vitest";
import {
  caminhoAoTrocarObra, caminhoEtapa, COOKIE_MENU, ETAPAS, etapaDoCaminho, iniciais, menuRecolhido, obraIdDoCaminho,
} from "@/lib/dominio/navegacao";

describe("iniciais", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(iniciais("Luis Mattos Villaça")).toBe("LV");
  });
  it("usa duas letras quando há um nome só", () => {
    expect(iniciais("luis")).toBe("LU");
  });
  it("usa a parte antes do @ (separada por ponto) quando o nome é um e-mail", () => {
    expect(iniciais("ana.souza@exemplo.com")).toBe("AS");
  });
  it("ignora espaços extras e devolve ? quando vazio", () => {
    expect(iniciais("  maria   clara  ")).toBe("MC");
    expect(iniciais("   ")).toBe("?");
  });
});

describe("obraIdDoCaminho", () => {
  const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
  it("reconhece a obra na página dela e nas subpáginas", () => {
    expect(obraIdDoCaminho(`/obras/${id}`)).toBe(id);
    expect(obraIdDoCaminho(`/obras/${id}/turnos/abc`)).toBe(id);
    expect(obraIdDoCaminho(`/obras/${id}/analise`)).toBe(id);
  });
  it("não marca obra na lista, em 'nova' ou fora de /obras", () => {
    expect(obraIdDoCaminho("/obras")).toBeNull();
    expect(obraIdDoCaminho("/obras/nova")).toBeNull();
    expect(obraIdDoCaminho("/outra")).toBeNull();
  });
});

describe("menuRecolhido", () => {
  it("só recolhe quando o cookie diz 'recolhido'", () => {
    expect(COOKIE_MENU).toBe("frentia_menu");
    expect(menuRecolhido("recolhido")).toBe(true);
    expect(menuRecolhido("aberto")).toBe(false);
    expect(menuRecolhido(undefined)).toBe(false);
  });
});

describe("etapas da obra no menu", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  it("segue a ordem do ciclo: programação, turnos, RDOs, análise", () => {
    expect(ETAPAS.map((e) => e.rotulo)).toEqual(["Programação", "Turnos", "RDOs", "Análise (PPC)"]);
  });
  it("monta o endereço de cada etapa (Turnos é a página da obra)", () => {
    expect(caminhoEtapa(id, "programacao")).toBe(`/obras/${id}/programacao`);
    expect(caminhoEtapa(id, "turnos")).toBe(`/obras/${id}`);
    expect(caminhoEtapa(id, "rdos")).toBe(`/obras/${id}/rdos`);
    expect(caminhoEtapa(id, "analise")).toBe(`/obras/${id}/analise`);
  });
  it("reconhece a etapa pelo endereço, inclusive subpáginas", () => {
    expect(etapaDoCaminho(`/obras/${id}`)).toBe("turnos");
    expect(etapaDoCaminho(`/obras/${id}/turnos/novo`)).toBe("turnos");
    expect(etapaDoCaminho(`/obras/${id}/turnos/abc`)).toBe("turnos");
    expect(etapaDoCaminho(`/obras/${id}/programacao/2026-11-09`)).toBe("programacao");
    expect(etapaDoCaminho(`/obras/${id}/rdos`)).toBe("rdos");
    expect(etapaDoCaminho(`/obras/${id}/analise`)).toBe("analise");
    expect(etapaDoCaminho("/obras")).toBeNull();
    expect(etapaDoCaminho("/obras/nova")).toBeNull();
    expect(etapaDoCaminho("/rdos")).toBeNull();
  });
  it("ao trocar de obra mantém a etapa; fora de uma obra vai para os turnos", () => {
    const outra = "22222222-2222-2222-2222-222222222222";
    expect(caminhoAoTrocarObra(`/obras/${id}/analise`, outra)).toBe(`/obras/${outra}/analise`);
    expect(caminhoAoTrocarObra(`/obras/${id}/programacao/2026-11-09`, outra)).toBe(`/obras/${outra}/programacao`);
    expect(caminhoAoTrocarObra(`/obras/${id}/turnos/abc`, outra)).toBe(`/obras/${outra}`);
    expect(caminhoAoTrocarObra("/obras", outra)).toBe(`/obras/${outra}`);
  });
});
