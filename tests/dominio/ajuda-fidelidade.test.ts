import { describe, expect, it } from "vitest";
import { capituloPorSlug } from "@/lib/ajuda/capitulos";
import type { SlugCapitulo } from "@/lib/ajuda/tipos";

/** Texto completo de um passo (título, parágrafos e dica). */
const texto = (slug: SlugCapitulo, id: string) => {
  const p = capituloPorSlug(slug)!.passos.find((x) => x.id === id)!;
  return [p.titulo, ...p.texto, p.dica ?? ""].join(" ");
};

// Pontos em que o manual descrevia o app de forma diferente da tela (revisão final do item 20).
describe("o manual descreve o app como ele é", () => {
  it("'Adicionar atividade' do turno não tem Responsável; o selo é 'Avulsa'", () => {
    const t = texto("check-in", "adicionar-atividade");
    expect(t).not.toMatch(/"Quantidade" planejada e o "Responsável"/);
    expect(t).toContain("\"Avulsa\"");
    expect(t).not.toContain("selo \"Extra\"");
  });
  it("o check-out não promete autor em todo lançamento", () => {
    expect(texto("fechar-turno", "check-out")).not.toContain("Cada lançamento mostra quem lançou");
  });
  it("encerrar semana: o cartão já está aberto e há um só botão", () => {
    const t = texto("encerrar-semana", "encerrar");
    expect(t).not.toContain("na lista, ela aparece como Aguardando encerramento");
    expect(t).not.toContain("Abra a semana e clique no botão");
  });
  it("rótulos exatos: \"✓ Concluída\", \"Nova obra\" no menu da obra, Check-in e Check-out separados", () => {
    expect(texto("campo", "lancar")).toContain("\"✓ Concluída\"");
    expect(texto("primeiros-passos", "criar-obra")).toMatch(/menu lateral/);
    expect(texto("quadro-tv", "visoes")).not.toContain("\"Check-in | Check-out\"");
  });
  it("paradas: o planejador vê o aviso no topo, sem título 'Paradas do turno'", () => {
    expect(texto("durante-o-turno", "paradas")).not.toContain("em \"Paradas do turno\"");
  });
  it("campo: causa não é pedida para serviço extra nem adiantada", () => {
    expect(texto("campo", "avisar")).toMatch(/extra|adiantad/i);
  });
});
