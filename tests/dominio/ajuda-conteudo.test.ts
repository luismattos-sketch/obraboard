import { describe, expect, it } from "vitest";
import {
  CAPITULOS,
  caminhoCaptura,
  capituloPorSlug,
  capitulosDoIndice,
  hrefPasso,
  proximoCapitulo,
} from "@/lib/ajuda/capitulos";
import { FLUXOGRAMA } from "@/lib/ajuda/fluxograma";
import { NOVIDADES } from "@/lib/ajuda/novidades";

const SLUGS_INDICE = [
  "primeiros-passos",
  "programar-semana",
  "check-in",
  "durante-o-turno",
  "fechar-turno",
  "encerrar-semana",
  "quadro-tv",
  "duvidas",
];

/** "/ajuda/check-in#liberar" aponta para capítulo e passo existentes; "/ajuda" é a página inicial. */
function hrefValido(href: string): boolean {
  if (href === "/ajuda") return true;
  const m = /^\/ajuda\/([a-z-]+)(?:#([a-z0-9-]+))?$/.exec(href);
  if (!m) return false;
  const cap = capituloPorSlug(m[1]);
  if (!cap) return false;
  return m[2] === undefined || cap.passos.some((p) => p.id === m[2]);
}

function todosOsTextos(): string[] {
  const textos: string[] = [];
  for (const c of CAPITULOS) {
    textos.push(c.titulo, c.resumo);
    for (const p of c.passos) {
      textos.push(p.titulo, ...p.texto);
      if (p.dica) textos.push(p.dica);
      if (p.captura) textos.push(p.captura.alt, p.captura.alvo.nome);
    }
  }
  for (const f of FLUXOGRAMA) {
    textos.push(f.titulo);
    if (f.nota) textos.push(f.nota);
    for (const linha of f.linhas) for (const cx of linha) textos.push(cx.rotulo, cx.detalhe ?? "");
  }
  for (const n of NOVIDADES) textos.push(n.texto);
  return textos;
}

describe("capítulos do manual", () => {
  it("acha capítulo pelo slug e devolve undefined para slug inexistente", () => {
    expect(capituloPorSlug("check-in")?.titulo).toBe("Abrir o turno e fazer o check-in");
    expect(capituloPorSlug("xyz")).toBeUndefined();
  });

  it("o índice tem os 8 capítulos do planejador em ordem, sem o do campo", () => {
    expect(capitulosDoIndice().map((c) => c.slug)).toEqual(SLUGS_INDICE);
    expect(capituloPorSlug("campo")?.noIndice).toBe(true);
  });

  it("próximo capítulo segue a ordem e para no fim e no campo", () => {
    expect(proximoCapitulo("primeiros-passos")?.slug).toBe("programar-semana");
    expect(proximoCapitulo("quadro-tv")?.slug).toBe("duvidas");
    expect(proximoCapitulo("duvidas")).toBeNull();
    expect(proximoCapitulo("campo")).toBeNull();
  });

  it("monta links e caminhos de captura", () => {
    expect(hrefPasso("check-in", "liberar")).toBe("/ajuda/check-in#liberar");
    expect(hrefPasso("check-in")).toBe("/ajuda/check-in");
    expect(caminhoCaptura("check-in", "liberar")).toBe("/ajuda/check-in-liberar.png");
  });
});

describe("integridade do conteúdo", () => {
  it("todo capítulo tem passos e ids únicos", () => {
    for (const c of CAPITULOS) {
      expect(c.passos.length, c.slug).toBeGreaterThan(0);
      const ids = c.passos.map((p) => p.id);
      expect(new Set(ids).size, c.slug).toBe(ids.length);
    }
  });

  it("links do fluxograma e das novidades apontam para capítulo e passo existentes", () => {
    for (const f of FLUXOGRAMA) for (const linha of f.linhas) for (const cx of linha) {
      expect(hrefValido(cx.href), `${cx.rotulo} → ${cx.href}`).toBe(true);
    }
    for (const n of NOVIDADES) expect(hrefValido(n.href), `${n.texto} → ${n.href}`).toBe(true);
  });

  it("fluxograma tem as 4 fases na ordem", () => {
    expect(FLUXOGRAMA.map((f) => f.titulo)).toEqual(["Uma vez por obra", "Toda semana", "Todo turno", "Fim da semana"]);
  });

  it("novidades vêm da mais recente para a mais antiga", () => {
    const datas = NOVIDADES.map((n) => n.data);
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(NOVIDADES[0].href).toBe("/ajuda");
  });

  it("nenhum texto usa 'encarregado'", () => {
    for (const t of todosOsTextos()) expect(t).not.toMatch(/encarregad/i);
  });

  it("capturas do campo são de celular e as demais de computador", () => {
    for (const c of CAPITULOS) for (const p of c.passos) {
      if (!p.captura) continue;
      expect(p.captura.dispositivo, `${c.slug}#${p.id}`).toBe(c.slug === "campo" ? "celular" : "computador");
    }
  });
});
