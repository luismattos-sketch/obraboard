import { describe, expect, it } from "vitest";
import { buscarAjuda, normalizarBusca } from "@/lib/ajuda/busca";
import { destinoAjuda, telaDoTurno } from "@/lib/ajuda/destino";
import { hrefPasso } from "@/lib/ajuda/capitulos";
import type { Capitulo } from "@/lib/ajuda/tipos";

describe("normalizarBusca", () => {
  it("tira acento, maiúsculas, hífen e espaços repetidos", () => {
    expect(normalizarBusca("Check-in  Programação")).toBe("check in programacao");
  });
});

describe("buscarAjuda no manual real", () => {
  it("ignora termo vazio ou com 1 letra", () => {
    expect(buscarAjuda("")).toEqual([]);
    expect(buscarAjuda(" a ")).toEqual([]);
  });
  it("'check in' acha o capítulo do check-in", () => {
    expect(buscarAjuda("check in").some((r) => r.slug === "check-in")).toBe(true);
  });
  it("'programacao' sem acento acha a programação da semana", () => {
    expect(buscarAjuda("programacao").some((r) => r.slug === "programar-semana")).toBe(true);
  });
  it("o link do resultado aponta para o passo", () => {
    const [r] = buscarAjuda("check in");
    expect(r.href).toBe(hrefPasso(r.slug, r.passoId));
  });
});

describe("buscarAjuda com capítulos de teste", () => {
  const caps: Capitulo[] = [
    {
      slug: "duvidas",
      titulo: "Dúvidas",
      resumo: "",
      noIndice: false,
      passos: [
        { id: "a", titulo: "Outro assunto", texto: ["Fale com a equipe de solda."] },
        { id: "b", titulo: "Equipe de solda", texto: ["Texto qualquer."] },
        { id: "c", titulo: "Sem relação", texto: ["Nada aqui."], dica: "Dica sobre a equipe de solda." },
      ],
    },
  ];
  it("todas as palavras precisam aparecer", () => {
    expect(buscarAjuda("solda inexistentexyz", caps)).toEqual([]);
  });
  it("busca também na dica", () => {
    expect(buscarAjuda("dica solda", caps).map((r) => r.passoId)).toEqual(["c"]);
  });
  it("título que casa vem antes de texto que casa", () => {
    expect(buscarAjuda("equipe solda", caps).map((r) => r.passoId)).toEqual(["b", "a", "c"]);
  });
});

describe("destino do botão de ajuda", () => {
  it("segue a tabela do spec", () => {
    expect(destinoAjuda("obras")).toBe("/ajuda/primeiros-passos");
    expect(destinoAjuda("programacao")).toBe("/ajuda/programar-semana");
    expect(destinoAjuda("encerrar-semana")).toBe("/ajuda/encerrar-semana");
    expect(destinoAjuda("analise")).toBe("/ajuda/encerrar-semana");
    expect(destinoAjuda("turno-planejado")).toBe("/ajuda/check-in");
    expect(destinoAjuda("turno-em-campo")).toBe("/ajuda/durante-o-turno");
    expect(destinoAjuda("turno-fechamento")).toBe("/ajuda/fechar-turno");
    expect(destinoAjuda("rdos")).toBe("/ajuda/fechar-turno");
    expect(destinoAjuda("quadro")).toBe("/ajuda/quadro-tv");
  });
  it("escolhe a tela do turno pelo status", () => {
    expect(telaDoTurno("planejado")).toBe("turno-planejado");
    expect(telaDoTurno("em_campo")).toBe("turno-em-campo");
    expect(telaDoTurno("enviado")).toBe("turno-fechamento");
    expect(telaDoTurno("fechado")).toBe("turno-fechamento");
  });
});
