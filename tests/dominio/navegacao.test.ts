import { describe, it, expect } from "vitest";
import { COOKIE_MENU, iniciais, menuRecolhido, obraIdDoCaminho } from "@/lib/dominio/navegacao";

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
