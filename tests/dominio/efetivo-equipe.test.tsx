import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/acoesResponsaveis", () => ({ criarResponsavelAcao: vi.fn() }));

import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import { somarEfetivoPorFuncao } from "@/lib/dominio/calculos";

describe("somarEfetivoPorFuncao (RDO)", () => {
  it("uma linha por função, somando as equipes, na ordem em que aparecem", () => {
    expect(
      somarEfetivoPorFuncao([
        { funcao: "Pedreiro", quantidade: 2 },
        { funcao: "Servente", quantidade: 1 },
        { funcao: "pedreiro ", quantidade: 3 },
      ]),
    ).toEqual([
      { funcao: "Pedreiro", quantidade: 5 },
      { funcao: "Servente", quantidade: 1 },
    ]);
  });
});

describe("EfetivoPorEquipe (planejador)", () => {
  it("obra com responsáveis e turno sem efetivo: mostra a equipe 'Sem responsável'", () => {
    const html = renderToStaticMarkup(
      <EfetivoPorEquipe
        obraId="o"
        responsaveis={[{ id: "a", nome: "Ana", ativo: true }]}
        efetivo={[]}
        opcoesFuncao={["Pedreiro"]}
        equipesIniciais={["a"]}
        salvar={async () => ({ ok: true, dados: undefined })}
      />,
    );
    expect(html).toContain("Ana");
    expect(html).toContain("Sem responsável");
  });
});
