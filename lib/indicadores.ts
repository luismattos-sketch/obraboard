import type { Atividade, AtividadeRecurso } from "./types";
import type { RestricaoHistorico } from "./operacao";

export type AtividadeIndicador = Atividade & {
  iniciado_em?: string | null;
  pausado_em?: string | null;
  finalizado_em?: string | null;
  tempo_acumulado_ms?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MaoObraIndicador = {
  id: number;
  obra_id?: number | null;
  turno_id?: number | null;
  atividade_id?: number | null;
  funcao?: string | null;
  quantidade?: number | null;
  turno?: string | null;
  data_turno?: string | null;
};

export type TurnoOperacaoIndicador = {
  id: string;
  obra_id: number;
  turno_id?: number | null;
  data_turno: string;
  turno: string;
  status: string;
  iniciado_em?: string | null;
  pausado_em?: string | null;
  encerrado_em?: string | null;
  tempo_acumulado_ms?: number | null;
  running_since?: string | null;
};

export type DadosIndicadores = {
  atividades: AtividadeIndicador[];
  maoObra: MaoObraIndicador[];
  recursosPlanejados: AtividadeRecurso[];
  restricoes: RestricaoHistorico[];
  turnos: TurnoOperacaoIndicador[];
};

export type LinhaAtividadeIndicador = {
  atividade: AtividadeIndicador;
  pessoasPlanejadas: number;
  pessoasReais: number;
  horas: number;
  hhPlanejado: number;
  hhConsumido: number;
  produtividade: number;
  restricaoAberta: RestricaoHistorico | null;
};

export type ResumoIndicadores = {
  status: string;
  tempoDecorridoMs: number;
  tempoProdutivoMs: number;
  tempoParadoMs: number;
  tempoRestricaoMs: number;
  hhPlanejado: number;
  hhConsumido: number;
  hhProdutivo: number;
  hhPerdido: number;
  avancoReal: number;
  ppc: number;
  produtividade: number;
  restricoesAbertas: number;
  restricoesResolvidas: number;
  linhas: LinhaAtividadeIndicador[];
};

export function calcularResumoIndicadores(
  dados: DadosIndicadores,
  agora = Date.now()
): ResumoIndicadores {
  const recursosPorAtividade = agruparPorAtividade(dados.recursosPlanejados);
  const maoObraPorAtividade = agruparMaoObra(dados.maoObra);
  const restricoesAbertas = dados.restricoes.filter(restricaoAberta);
  const linhas = dados.atividades.map<LinhaAtividadeIndicador>((atividade) => {
    const horas = obterHorasAtividade(atividade, agora);
    const pessoasPlanejadas = somarQuantidade(
      recursosPorAtividade.get(atividade.id) ?? [],
      "quantidade_prevista"
    );
    const pessoasReais = somarQuantidade(
      maoObraPorAtividade.get(atividade.id) ?? [],
      "quantidade"
    );
    const hhPlanejado =
      pessoasPlanejadas * Number(atividade.tempo_previsto_horas || 0);
    const hhConsumido = pessoasReais * horas;
    const executado = Number(atividade.realizado || 0);

    return {
      atividade,
      pessoasPlanejadas,
      pessoasReais,
      horas,
      hhPlanejado,
      hhConsumido,
      produtividade: hhConsumido > 0 ? executado / hhConsumido : 0,
      restricaoAberta:
        restricoesAbertas.find((item) => item.atividadeId === atividade.id) ?? null,
    };
  });

  const tempoDecorridoMs = calcularTempoTotal(dados.turnos, linhas, agora);
  const tempoRestricaoMs = dados.restricoes.reduce(
    (total, item) => total + calcularDuracaoRestricao(item, agora),
    0
  );
  const tempoParadoMs = tempoRestricaoMs;
  const hhProdutivo = somar(
    linhas
      .filter(
        (item) =>
          item.atividade.status !== "Planejada" && item.hhConsumido > 0
      )
      .map((item) => item.hhConsumido)
  );
  const tempoProdutivoMs =
    somar(
      linhas
        .filter(
          (item) =>
            item.atividade.status !== "Planejada" &&
            item.hhConsumido > 0 &&
            item.pessoasReais > 0
        )
        .map((item) => item.hhConsumido / item.pessoasReais)
    ) * 3_600_000;
  const hhPlanejado = somar(linhas.map((item) => item.hhPlanejado));
  const hhConsumido = somar(linhas.map((item) => item.hhConsumido));
  const hhPerdido = dados.restricoes.reduce((total, restricao) => {
    const linha = linhas.find(
      (item) => item.atividade.id === restricao.atividadeId
    );
    return (
      total +
      (linha?.pessoasReais || linha?.pessoasPlanejadas || 0) *
        (calcularDuracaoRestricao(restricao, agora) / 3_600_000)
    );
  }, 0);
  const totalPlanejado = somar(
    dados.atividades.map((item) => Number(item.previsto || 0))
  );
  const totalExecutado = somar(
    dados.atividades.map((item) => Number(item.realizado || 0))
  );
  const concluidasConformePlanejado = dados.atividades.filter(
    (item) =>
      item.status === "Finalizada" &&
      Number(item.realizado || 0) >= Number(item.previsto || 0) &&
      Number(item.previsto || 0) > 0
  ).length;

  return {
    status: obterStatusAnalise(dados),
    tempoDecorridoMs,
    tempoProdutivoMs,
    tempoParadoMs,
    tempoRestricaoMs,
    hhPlanejado,
    hhConsumido,
    hhProdutivo,
    hhPerdido,
    avancoReal:
      totalPlanejado > 0
        ? Math.min(100, (totalExecutado / totalPlanejado) * 100)
        : 0,
    ppc:
      dados.atividades.length > 0
        ? (concluidasConformePlanejado / dados.atividades.length) * 100
        : 0,
    produtividade: hhConsumido > 0 ? totalExecutado / hhConsumido : 0,
    restricoesAbertas: restricoesAbertas.length,
    restricoesResolvidas: dados.restricoes.filter(
      (item) => item.status === "resolvida"
    ).length,
    linhas,
  };
}

export function obterMotivoRestricao(texto: string) {
  const valor = texto.toLowerCase();
  const categorias: Array<[string, string[]]> = [
    ["Material", ["material", "insumo"]],
    ["Acesso", ["acesso", "frente bloqueada"]],
    ["Equipamento", ["equipamento", "máquina", "maquina", "ferramenta"]],
    ["Projeto/desenho", ["projeto", "desenho", "documento"]],
    ["Segurança/liberação", ["segurança", "seguranca", "liberação", "liberacao"]],
    ["Mão de obra", ["mão de obra", "mao de obra", "equipe", "pessoal"]],
  ];

  return categorias.find(([, termos]) =>
    termos.some((termo) => valor.includes(termo))
  )?.[0] ?? "Outros";
}

export function restricaoAberta(restricao: RestricaoHistorico) {
  return ["aberta", "parada", "reprogramada"].includes(restricao.status);
}

export function calcularDuracaoRestricao(
  restricao: RestricaoHistorico,
  agora = Date.now()
) {
  if (restricao.duracaoMs !== null && restricao.duracaoMs !== undefined) {
    return Math.max(0, Number(restricao.duracaoMs));
  }

  const inicio = restricao.abertaEm || restricao.registradaEm;
  const fim = restricao.resolvidaEm || restricao.encerradaEm;

  if (!inicio) {
    return 0;
  }

  return Math.max(
    0,
    (fim ? new Date(fim).getTime() : agora) - new Date(inicio).getTime()
  );
}

export function formatarDuracao(ms: number) {
  const totalMinutos = Math.max(0, Math.round(ms / 60_000));
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return `${horas}h ${String(minutos).padStart(2, "0")}min`;
}

export function formatarNumero(valor: number, casas = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(valor) ? valor : 0);
}

function obterHorasAtividade(atividade: AtividadeIndicador, agora: number) {
  const acumulado = Number(atividade.tempo_acumulado_ms || 0);
  const adicional =
    atividade.status === "Execução" && atividade.iniciado_em
      ? Math.max(0, agora - new Date(atividade.iniciado_em).getTime())
      : 0;
  return Math.max(0, acumulado + adicional) / 3_600_000;
}

function calcularTempoTotal(
  turnos: TurnoOperacaoIndicador[],
  linhas: LinhaAtividadeIndicador[],
  agora: number
) {
  if (turnos.length > 0) {
    return turnos.reduce((total, turno) => {
      const acumulado = Number(turno.tempo_acumulado_ms || 0);
      const adicional = turno.running_since
        ? Math.max(0, agora - new Date(turno.running_since).getTime())
        : 0;
      return total + acumulado + adicional;
    }, 0);
  }

  return linhas.reduce(
    (total, linha) => total + linha.horas * 3_600_000,
    0
  );
}

function obterStatusAnalise(dados: DadosIndicadores) {
  if (dados.atividades.length === 0 && dados.turnos.length === 0) {
    return "Sem dados";
  }
  if (dados.turnos.length > 1) {
    return "Consolidado";
  }

  const status = dados.turnos[0]?.status;
  const mapa: Record<string, string> = {
    planejado: "Não iniciado",
    publicado: "Não iniciado",
    em_andamento: "Em andamento",
    pausado: "Parado",
    encerrado: "Encerrado",
  };
  return mapa[status] ?? "Consolidado";
}

function agruparPorAtividade(recursos: AtividadeRecurso[]) {
  return recursos.reduce<Map<number, AtividadeRecurso[]>>((mapa, item) => {
    mapa.set(item.atividade_id, [...(mapa.get(item.atividade_id) ?? []), item]);
    return mapa;
  }, new Map());
}

function agruparMaoObra(recursos: MaoObraIndicador[]) {
  return recursos.reduce<Map<number, MaoObraIndicador[]>>((mapa, item) => {
    if (item.atividade_id) {
      mapa.set(item.atividade_id, [
        ...(mapa.get(item.atividade_id) ?? []),
        item,
      ]);
    }
    return mapa;
  }, new Map());
}

function somarQuantidade<T>(itens: T[], campo: keyof T) {
  return itens.reduce((total, item) => total + Number(item[campo] || 0), 0);
}

function somar(valores: number[]) {
  return valores.reduce((total, valor) => total + valor, 0);
}
