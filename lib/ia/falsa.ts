// IA de mentira para testes, E2E e capturas do manual (FRENTIA_IA_FALSA=1). Nunca usada em produção.
import type { AtividadeParaIA, ItemIA, RespostaIA } from "./esquema";

const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function respostaFalsa(texto: string, atividades: AtividadeParaIA[]): RespostaIA {
  if (texto.includes("ERRO")) throw new Error("IA falsa: indisponível");
  const t = simples(texto);
  const m = /(\d+(?:,\d+)?) ?m de (\w+)/.exec(t);
  if (!m) return { itens: [] };
  const alvo = atividades.find((a) => simples(a.descricao).includes(m[2]));
  if (!alvo) return { itens: [] };
  const andaime = t.includes("faltou andaime");
  const item: ItemIA = {
    atividade: alvo.codigo,
    candidatas: [],
    quantidade: Number(m[1].replace(",", ".")),
    unidade_dita: "m",
    modo: alvo.feito !== null && alvo.feito > 0 ? "incerto" : "total",
    concluida: false,
    causa: null,
    causas_candidatas: andaime ? ["material", "equipamento"] : [],
    coisa_da_causa: andaime ? "andaime" : null,
    trecho: andaime ? "faltou andaime" : null,
  };
  return { itens: [item] };
}
