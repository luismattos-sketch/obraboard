// Obra de exemplo fictícia das capturas do manual (empreiteira atendendo indústria). Nenhum dado real.
import type { DiaSemana } from "@/lib/dominio/programacao";

export const OBRA = { nome: "Ampliação do Galpão 3", cliente: "Indústria Exemplo S.A.", endereco: "Rua das Indústrias, 300" };

export const RESPONSAVEIS = ["Ana Souza", "João Lima", "Carlos Pereira"] as const;
export type NomeResponsavel = (typeof RESPONSAVEIS)[number];

/** Atividade que o roteiro digita na tela (passo "Adicione as atividades"). */
export const ATIVIDADE_NA_TELA = {
  descricao: "Montagem da tubulação de ar comprimido",
  local: "Linha 3",
  unidade: "m",
  meta: "60",
  funcao: "Encanador",
  qtd: "3",
  responsavel: "Ana Souza" as NomeResponsavel,
};

/** Demais atividades da semana, gravadas direto no banco. `dias` = deslocamento a partir de hoje (≤ 0). */
export const OUTRAS_ATIVIDADES: {
  descricao: string;
  local: string;
  unidade: string;
  meta: number;
  responsavel: NomeResponsavel;
  equipe: { funcao: string; quantidade: number }[];
}[] = [
  { descricao: "Pintura do guarda-corpo", local: "Mezanino", unidade: "m²", meta: 80, responsavel: "João Lima",
    equipe: [{ funcao: "Pintor", quantidade: 2 }] },
  { descricao: "Lançamento de cabos do painel QD-02", local: "Subestação", unidade: "m", meta: 120, responsavel: "Carlos Pereira",
    equipe: [{ funcao: "Eletricista", quantidade: 2 }, { funcao: "Ajudante", quantidade: 1 }] },
  { descricao: "Base do compressor C-02", local: "Linha 3", unidade: "m³", meta: 4, responsavel: "Ana Souza",
    equipe: [{ funcao: "Pedreiro", quantidade: 2 }] },
  { descricao: "Suportes da bandeja elétrica", local: "Galpão 3", unidade: "un", meta: 30, responsavel: "Carlos Pereira",
    equipe: [{ funcao: "Montador", quantidade: 2 }] },
];

/** Dias marcados: os 3 últimos até hoje (assim "Encerrar semana" já aparece hoje). */
export function diasAteHoje(hoje: DiaSemana): DiaSemana[] {
  return [hoje - 2, hoje - 1, hoje].filter((d) => d >= 0) as DiaSemana[];
}
