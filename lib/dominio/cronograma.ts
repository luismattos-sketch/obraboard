// Item 5.1: regras puras do cronograma e da janela do lookahead (sem banco, testáveis).
import { somarDias, type DiaSemana } from "./programacao";

export type Campo = "codigo" | "descricao" | "inicio" | "fim" | "local" | "quantidade" | "unidade";
/** Índice da coluna do arquivo para cada campo. */
export type Mapeamento = Partial<Record<Campo, number>>;
export const CAMPOS_OBRIGATORIOS: Campo[] = ["codigo", "descricao", "inicio", "fim"];
export const ROTULO_CAMPO: Record<Campo, string> = {
  codigo: "Código", descricao: "Descrição", inicio: "Início", fim: "Término",
  local: "Local", quantidade: "Quantidade", unidade: "Unidade",
};
export const MAX_LINHAS = 5000;
export const MAX_BYTES = 5 * 1024 * 1024;

export type ItemLido = {
  codigo: string;
  descricao: string;
  inicio: string;
  fim: string;
  local: string | null;
  unidade: string | null;
  quantidade: number | null;
};
export type ItemCronograma = Omit<ItemLido, "codigo"> & {
  id: string;
  origem: "importado" | "manual";
  codigo: string | null;
  removido_em: string | null;
  updated_at: string;
};
export type Ignorada = {
  linha: number;
  motivo: "sem código" | "sem descrição" | "data inválida" | "fim antes do início" | "código repetido";
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Por campo, nomes em ordem de preferência (o primeiro que existir ganha).
const NOMES: Record<Campo, string[]> = {
  codigo: ["edt", "wbs", "activity id", "codigo", "id"],
  descricao: ["nome da tarefa", "task name", "activity name", "nome", "descricao", "atividade", "name"],
  inicio: ["inicio", "start", "data de inicio"],
  fim: ["termino", "fim", "finish", "data de termino"],
  local: ["local", "area"],
  quantidade: ["quantidade", "qtd", "qtde"],
  unidade: ["unidade", "un", "unid"],
};

export function adivinharMapeamento(cabecalho: string[]): Mapeamento {
  const cols = cabecalho.map((c) => normalizar(String(c ?? "")));
  const m: Mapeamento = {};
  for (const campo of Object.keys(NOMES) as Campo[]) {
    for (const nome of NOMES[campo]) {
      const i = cols.indexOf(nome);
      if (i >= 0) {
        m[campo] = i;
        break;
      }
    }
  }
  return m;
}

const iso = (a: number, m: number, d: number): string | null => {
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
};

/** Data em ISO (yyyy-mm-dd) a partir do que o Excel/Project/Primavera exporta; null se inválida. */
export function lerData(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 1) return null;
    return somarDias("1899-12-30", Math.floor(v));
  }
  const s = String(v ?? "").trim();
  let r = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (r) return iso(+r[1], +r[2], +r[3]);
  r = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?!\d)/);
  if (r) return iso(r[3].length === 2 ? 2000 + +r[3] : +r[3], +r[2], +r[1]);
  return null;
}

/** Número em pt-BR ("1.234,5") ou en ("1234.5"); null se vazio ou não for número > 0. */
function lerQuantidade(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const celula = (linha: unknown[], i: number | undefined) => (i === undefined ? "" : linha[i]);
const textoOuNull = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s || null;
};

/** Linhas do arquivo (sem o cabeçalho) → itens válidos e ignoradas (nº da linha = índice + 2). */
export function lerLinhas(linhas: unknown[][], m: Mapeamento): { itens: ItemLido[]; ignoradas: Ignorada[] } {
  const itens: ItemLido[] = [];
  const ignoradas: Ignorada[] = [];
  const vistos = new Set<string>();
  linhas.forEach((l, i) => {
    const linha = i + 2;
    if (l.every((c) => String(c ?? "").trim() === "")) return;
    const codigo = String(celula(l, m.codigo) ?? "").trim();
    const descricao = String(celula(l, m.descricao) ?? "").trim();
    const inicio = lerData(celula(l, m.inicio));
    const fim = lerData(celula(l, m.fim));
    if (!codigo) return void ignoradas.push({ linha, motivo: "sem código" });
    if (vistos.has(codigo)) return void ignoradas.push({ linha, motivo: "código repetido" });
    if (!descricao) return void ignoradas.push({ linha, motivo: "sem descrição" });
    if (!inicio || !fim) return void ignoradas.push({ linha, motivo: "data inválida" });
    if (fim < inicio) return void ignoradas.push({ linha, motivo: "fim antes do início" });
    vistos.add(codigo);
    itens.push({
      codigo, descricao: descricao.slice(0, 500), inicio, fim,
      local: textoOuNull(celula(l, m.local)), unidade: textoOuNull(celula(l, m.unidade)),
      quantidade: lerQuantidade(celula(l, m.quantidade)),
    });
  });
  return { itens, ignoradas };
}

const igual = (a: Omit<ItemLido, "codigo">, b: Omit<ItemLido, "codigo">) =>
  a.descricao === b.descricao && a.inicio === b.inicio && a.fim === b.fim &&
  (a.local ?? null) === (b.local ?? null) && (a.unidade ?? null) === (b.unidade ?? null) &&
  (a.quantidade ?? null) === (b.quantidade ?? null);

/** Mesma regra da função SQL importar_cronograma, para a prévia. */
export function planoReimportacao(existentes: ItemCronograma[], lidos: ItemLido[]) {
  const porCodigo = new Map(existentes.filter((e) => e.origem === "importado" && e.codigo).map((e) => [e.codigo!, e]));
  const noArquivo = new Set(lidos.map((l) => l.codigo));
  let novos = 0;
  let atualizados = 0;
  for (const l of lidos) {
    const e = porCodigo.get(l.codigo);
    if (!e) novos++;
    else if (e.removido_em || !igual(e, l)) atualizados++;
  }
  const removidos = [...porCodigo.values()].filter((e) => !e.removido_em && !noArquivo.has(e.codigo!)).length;
  return { novos, atualizados, removidos };
}

const segundaDe = (data: string) => {
  const dow = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(data, -((dow + 6) % 7));
};

/** Segundas-feiras da janela, começando na semana seguinte à de hoje. */
export function semanasDoLookahead(hoje: string, n: 3 | 4 | 5 | 6): string[] {
  const primeira = somarDias(segundaDe(hoje), 7);
  return Array.from({ length: n }, (_, i) => somarDias(primeira, 7 * i));
}

export function itensDaSemana<T extends { inicio: string; fim: string }>(itens: T[], segunda: string): T[] {
  const domingo = somarDias(segunda, 6);
  return itens.filter((i) => i.inicio <= domingo && i.fim >= segunda);
}

export function diasDoItemNaSemana(item: { inicio: string; fim: string }, segunda: string): DiaSemana[] {
  const dias: DiaSemana[] = [];
  for (let d = 0; d < 7; d++) {
    const data = somarDias(segunda, d);
    if (data >= item.inicio && data <= item.fim) dias.push(d as DiaSemana);
  }
  return dias;
}

export const mudouDesdeLevado = (item: { updated_at: string }, ultimaLevadaEm: string | null) =>
  ultimaLevadaEm !== null && new Date(item.updated_at).getTime() > new Date(ultimaLevadaEm).getTime();
