import { normalizarFuncao, type EquipePrevista } from "./programacao";

export const QTD_PESSOAS_MAX = 10_000;
export const FUNCAO_MAX = 60;

/** Converte linhas digitadas (texto) em equipe; linha toda vazia é ignorada, quantidade não inteira vira NaN (recusada na validação). */
export function linhasParaEquipe(linhas: { funcao: string; quantidade: string }[]): EquipePrevista[] {
  return linhas
    .map((l) => ({ funcao: l.funcao.trim(), qtd: l.quantidade.trim() }))
    .filter((l) => l.funcao || l.qtd)
    .map((l) => ({ funcao: l.funcao, quantidade: /^\d+$/.test(l.qtd) ? Number(l.qtd) : NaN }));
}

/** Lê os campos repetidos `funcao`/`quantidade` do formulário (EditorEquipe). */
export function lerEquipeDoForm(form: FormData): EquipePrevista[] {
  const q = form.getAll("quantidade").map(String);
  return linhasParaEquipe(form.getAll("funcao").map((f, i) => ({ funcao: String(f), quantidade: q[i] ?? "" })));
}

/** Valida linhas de equipe (função + quantidade de pessoas), como na programação. */
export function validarEquipe(bruta: unknown): { equipe: EquipePrevista[]; erro: string | null } {
  const linhas = (Array.isArray(bruta) ? bruta : []) as { funcao?: unknown; quantidade?: unknown }[];
  const equipe = linhas.map((e) => ({ funcao: String(e?.funcao ?? "").trim(), quantidade: e?.quantidade as number }));
  let erro: string | null = null;
  if (equipe.some((e) => !e.funcao)) erro = "Informe a função de cada linha da equipe";
  else if (equipe.some((e) => e.funcao.length > FUNCAO_MAX)) erro = `Função com no máximo ${FUNCAO_MAX} caracteres`;
  else if (equipe.some((e) => !Number.isInteger(e.quantidade) || e.quantidade <= 0 || e.quantidade > QTD_PESSOAS_MAX)) {
    erro = "Quantidade de pessoas inválida";
  }
  return { equipe, erro };
}

/** Equipe prevista por responsável: soma as equipes das atividades, juntando grafias da mesma função. */
export function equipePrevista(
  atividades: { responsavel_id: string | null; equipe: EquipePrevista[] }[],
): Map<string | null, EquipePrevista[]> {
  const porResp = new Map<string | null, Map<string, EquipePrevista>>();
  for (const a of atividades) {
    for (const e of a.equipe) {
      const chave = normalizarFuncao(e.funcao);
      if (!chave || !(e.quantidade > 0)) continue;
      const m = porResp.get(a.responsavel_id) ?? new Map<string, EquipePrevista>();
      porResp.set(a.responsavel_id, m);
      const atual = m.get(chave);
      if (atual) atual.quantidade += e.quantidade;
      else m.set(chave, { funcao: e.funcao.trim().replace(/\s+/g, " "), quantidade: e.quantidade });
    }
  }
  return new Map([...porResp].map(([k, m]) => [k, [...m.values()]]));
}
