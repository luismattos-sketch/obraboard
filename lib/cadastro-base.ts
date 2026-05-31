import { supabase } from "./supabase";

export type SituacaoObra = "Planejamento" | "Mobilizacao" | "Execucao" | "Pausada";
export type CriticidadeObra = "Baixa" | "Media" | "Alta";
export type NivelAcesso = "Planejador" | "Usuario" | "Visitante";

export type ObraCadastrada = {
  id: number;
  logoUrl: string;
  nome: string;
  codigo: string;
  cliente: string;
  contrato: string;
  inicio: string;
  termino: string;
  orcamento: string;
  situacao: SituacaoObra;
  criticidade: CriticidadeObra;
  escopo: string;
  observacoes: string;
};

export type UsuarioCadastrado = {
  id: number;
  nome: string;
  funcao: string;
  email: string;
  nivelAcesso: NivelAcesso;
};

export type DisciplinaCadastrada = {
  id: number;
  codigo: string;
  nome: string;
};

export type FuncaoPrevistaCadastrada = {
  id: number;
  nome: string;
  quantidade: number;
  cargaHoraria: number;
};

export type TurnoCadastrado = {
  id: number;
  nome: string;
  horaInicio: string;
  horaFim: string;
  descontaRefeicao: boolean;
  horasTrabalho: number;
};

export type CadastroDadosObra = {
  usuarios: UsuarioCadastrado[];
  disciplinas: DisciplinaCadastrada[];
  funcoesPrevistas: FuncaoPrevistaCadastrada[];
  turnos: TurnoCadastrado[];
};

export type CadastroBase = {
  logoUrl: string;
  obras: ObraCadastrada[];
  obraAtivaId: number | null;
  turnoAtivoPorObra: Record<string, string>;
  turnoAtivoIdPorObra: Record<string, number>;
  dadosPorObra: Record<string, CadastroDadosObra>;
  operacao: {
    atividades: Record<string, Record<string, unknown>>;
    restricoesHistorico: unknown[];
    controlesTurno: Record<string, Record<string, unknown>>;
  };
  usuarios: UsuarioCadastrado[];
  disciplinas: DisciplinaCadastrada[];
  funcoesPrevistas: FuncaoPrevistaCadastrada[];
  turnos: TurnoCadastrado[];
};

export const cadastroBaseStorageKey = "obraboard:cadastro-base";
export const cadastroBaseEvento = "obraboard:cadastro-base-atualizado";
const cadastroBaseRemotoId = "default";
const cadastroBaseFallbackTurno = "__cadastro_base__";
const cadastroBaseFallbackDisciplina = "__sistema__";

export const cadastroDadosObraInicial: CadastroDadosObra = {
  usuarios: [],
  disciplinas: [],
  funcoesPrevistas: [],
  turnos: [],
};

export const cadastroBaseInicial: CadastroBase = {
  logoUrl: "",
  obras: [],
  obraAtivaId: null,
  turnoAtivoPorObra: {},
  turnoAtivoIdPorObra: {},
  dadosPorObra: {},
  operacao: {
    atividades: {},
    restricoesHistorico: [],
    controlesTurno: {},
  },
  usuarios: [],
  disciplinas: [],
  funcoesPrevistas: [],
  turnos: [],
};

export function carregarCadastroBase(): CadastroBase {
  if (typeof window === "undefined") {
    return cadastroBaseInicial;
  }

  const salvo = window.localStorage.getItem(cadastroBaseStorageKey);

  if (!salvo) {
    return cadastroBaseInicial;
  }

  try {
    return normalizarCadastroBase(JSON.parse(salvo));
  } catch {
    return cadastroBaseInicial;
  }
}

export function carregarESincronizarCadastroBase(): CadastroBase {
  const cadastro = carregarCadastroBase();

  if (typeof window !== "undefined") {
    void salvarCadastroBase(cadastro);
  }

  return cadastro;
}

export async function salvarCadastroBase(cadastro: CadastroBase) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cadastroBaseStorageKey, JSON.stringify(cadastro));
    await salvarCadastroBaseRemoto(cadastro);
  } catch {
    try {
      const cadastroSemLogo = { ...cadastro, logoUrl: "" };
      window.localStorage.setItem(cadastroBaseStorageKey, JSON.stringify(cadastroSemLogo));
      await salvarCadastroBaseRemoto(cadastroSemLogo);
    } catch {
      // Mantem a tela funcionando mesmo se o armazenamento local estiver cheio.
    }
  }
}

export function apagarCadastroBase() {
  void salvarCadastroBase(criarCadastroBaseVazio());
  notificarCadastroBaseAtualizado();
}

export async function carregarCadastroBaseRemoto() {
  const { data, error } = await supabase
    .from("cadastro_base")
    .select("dados")
    .eq("id", cadastroBaseRemotoId)
    .single();

  if (error) {
    console.error("Erro ao carregar cadastro_base remoto:", error);
    return null;
  }

  if (!data?.dados) {
    console.error("cadastro_base retornou vazio");
    return null;
  }

  return normalizarCadastroBase(data.dados as Partial<CadastroBase>);
}

export async function sincronizarCadastroBaseRemoto() {
  if (typeof window === "undefined") {
    return cadastroBaseInicial;
  }

  const { data, error } = await supabase
    .from("cadastro_base")
    .select("dados")
    .eq("id", cadastroBaseRemotoId)
    .maybeSingle();

  if (error) {
    console.warn("Cadastro remoto indisponivel, usando cache local.", error);
    const cadastroFallback = await carregarCadastroBaseFallback();
    const cadastroLocal = carregarCadastroBase();

    if (!cadastroTemConteudo(cadastroLocal) && cadastroTemConteudo(cadastroFallback)) {
      salvarCadastroBaseLocal(cadastroFallback);
      notificarCadastroBaseAtualizado();
      return cadastroFallback;
    }

    if (cadastroTemConteudo(cadastroLocal)) {
      await salvarCadastroBaseFallback(cadastroLocal);
    }

    return cadastroLocal;
  }

  if (!data?.dados) {
    const cadastroLocal = carregarCadastroBase();

    if (cadastroTemConteudo(cadastroLocal)) {
      await salvarCadastroBaseRemoto(cadastroLocal);
    }

    return cadastroLocal;
  }

  const cadastroRemoto = normalizarCadastroBase(data.dados as Partial<CadastroBase>);
  const cadastroLocal = carregarCadastroBase();

  if (!cadastroTemConteudo(cadastroLocal) && cadastroTemConteudo(cadastroRemoto)) {
    salvarCadastroBaseLocal(cadastroRemoto);
    notificarCadastroBaseAtualizado();
    return cadastroRemoto;
  }

  if (cadastroTemConteudo(cadastroLocal) && !cadastroTemConteudo(cadastroRemoto)) {
    await salvarCadastroBaseRemoto(cadastroLocal);
    return cadastroLocal;
  }

  const obraAtivaLocalValida =
    cadastroLocal.obraAtivaId &&
    cadastroRemoto.obras.some((obra) => obra.id === cadastroLocal.obraAtivaId);
  const cadastroMesclado = {
    ...cadastroRemoto,
    obraAtivaId: obraAtivaLocalValida
      ? cadastroLocal.obraAtivaId
      : cadastroRemoto.obraAtivaId,
    turnoAtivoPorObra: {
      ...cadastroRemoto.turnoAtivoPorObra,
      ...cadastroLocal.turnoAtivoPorObra,
    },
    turnoAtivoIdPorObra: {
      ...cadastroRemoto.turnoAtivoIdPorObra,
      ...cadastroLocal.turnoAtivoIdPorObra,
    },
  };

  salvarCadastroBaseLocal(cadastroMesclado);
  notificarCadastroBaseAtualizado();
  void salvarCadastroBaseRemoto(cadastroMesclado);
  return cadastroMesclado;
}

export function criarCadastroBaseVazio(): CadastroBase {
  return {
    logoUrl: "",
    obras: [],
    obraAtivaId: null,
    turnoAtivoPorObra: {},
    turnoAtivoIdPorObra: {},
    dadosPorObra: {},
    operacao: {
      atividades: {},
      restricoesHistorico: [],
      controlesTurno: {},
    },
    usuarios: [],
    disciplinas: [],
    funcoesPrevistas: [],
    turnos: [],
  };
}

export function obterObraAtiva(cadastro: CadastroBase) {
  return (
    cadastro.obras.find((obra) => String(obra.id) === String(cadastro.obraAtivaId)) ??
    null
  );
}

export function obterObraAtivaId(cadastro: CadastroBase) {
  return obterObraAtiva(cadastro)?.id ?? null;
}

export function normalizarObraId(obraId: number | string | null | undefined) {
  if (obraId === null || obraId === undefined || obraId === "") {
    return null;
  }

  const id = Number(obraId);

  return Number.isFinite(id) && id > 0 ? id : null;
}

export function obterObraPorId(
  cadastro: CadastroBase,
  obraId: number | string | null | undefined
) {
  const id = normalizarObraId(obraId);

  if (!id) {
    return null;
  }

  return cadastro.obras.find((obra) => String(obra.id) === String(id)) ?? null;
}

export function resolverObraPorParametro(
  cadastro: CadastroBase,
  obraIdParametro: string | null | undefined
) {
  const parametroInformado = obraIdParametro !== null && obraIdParametro !== undefined;
  const obraId = normalizarObraId(obraIdParametro);

  if (parametroInformado) {
    const obra = obterObraPorId(cadastro, obraId);

    return {
      obra,
      obraId,
      parametroInformado,
    };
  }

  const obra = obterObraAtiva(cadastro);

  return {
    obra,
    obraId: obra?.id ?? null,
    parametroInformado,
  };
}

export function obterDadosObra(
  cadastro: CadastroBase,
  obraId = cadastro.obraAtivaId
): CadastroDadosObra {
  if (obraId) {
    const dados = cadastro.dadosPorObra[String(obraId)];

    if (dados) {
      return normalizarDadosObra(dados);
    }
  }

  return {
    usuarios: cadastro.usuarios,
    disciplinas: cadastro.disciplinas,
    funcoesPrevistas: cadastro.funcoesPrevistas,
    turnos: cadastro.turnos,
  };
}

export function definirDadosObra(
  cadastro: CadastroBase,
  obraId: number | null,
  dados: CadastroDadosObra
): CadastroBase {
  if (!obraId) {
    return {
      ...cadastro,
      ...normalizarDadosObra(dados),
    };
  }

  return {
    ...cadastro,
    dadosPorObra: {
      ...cadastro.dadosPorObra,
      [String(obraId)]: normalizarDadosObra(dados),
    },
  };
}

export async function salvarObraAtivaId(obraId: number | null) {
  const cadastro = carregarCadastroBase();
  const obraSelecionada = obraId
    ? cadastro.obras.find((obra) => String(obra.id) === String(obraId)) ?? null
    : null;

  await salvarCadastroBase({
    ...cadastro,
    obraAtivaId: obraSelecionada?.id ?? null,
  });
  notificarCadastroBaseAtualizado();
}

export function obterTurnoPorId(
  turnos: TurnoCadastrado[],
  turnoId: number | string | null | undefined
) {
  if (turnoId === null || turnoId === undefined || turnoId === "") {
    return null;
  }

  return (
    turnos.find((turno) => String(turno.id) === String(turnoId)) ??
    null
  );
}

export function obterTurnoAtivoNome(
  cadastro: CadastroBase,
  obraId: number | null,
  turnos: TurnoCadastrado[]
) {
  if (!obraId) {
    return "";
  }

  const turnoSalvo = cadastro.turnoAtivoPorObra[String(obraId)];

  return turnos.some((turno) => turno.nome === turnoSalvo)
    ? turnoSalvo
    : "";
}

export function obterTurnoAtivoId(
  cadastro: CadastroBase,
  obraId: number | null,
  turnos: TurnoCadastrado[]
) {
  if (!obraId) {
    return null;
  }

  const turnoIdSalvo = cadastro.turnoAtivoIdPorObra[String(obraId)];

  return turnos.some((turno) => String(turno.id) === String(turnoIdSalvo))
    ? Number(turnoIdSalvo)
    : null;
}

export function obterTurnoAtivo(
  cadastro: CadastroBase,
  obraId: number | null,
  turnos: TurnoCadastrado[]
) {
  const turnoId = obterTurnoAtivoId(cadastro, obraId, turnos);

  if (turnoId) {
    return obterTurnoPorId(turnos, turnoId);
  }

  const turnoNome = obterTurnoAtivoNome(cadastro, obraId, turnos);

  return turnos.find((turno) => turno.nome === turnoNome) ?? null;
}

export function getContextoAtual(
  cadastro = carregarCadastroBase(),
  parametros?: {
    obraId?: string | number | null;
    turnoId?: string | number | null;
    usarParametrosUrl?: boolean;
  }
) {
  const deveLerUrl =
    parametros?.usarParametrosUrl && typeof window !== "undefined";
  const searchParams = deveLerUrl
    ? new URLSearchParams(window.location.search)
    : null;
  const obraIdParametro =
    parametros?.obraId ??
    (searchParams?.has("obraId") ? searchParams.get("obraId") : undefined);
  const turnoIdParametro =
    parametros?.turnoId ??
    (searchParams?.has("turnoId") ? searchParams.get("turnoId") : undefined);
  const obraIdInformado = obraIdParametro !== undefined;
  const turnoIdInformado = turnoIdParametro !== undefined;
  const obraAtiva = obraIdInformado
    ? obterObraPorId(cadastro, obraIdParametro)
    : obterObraAtiva(cadastro);
  const obraAtivaId = obraAtiva?.id ?? normalizarObraId(obraIdParametro);
  const dadosObra = obraAtiva
    ? obterDadosObra(cadastro, obraAtiva.id)
    : cadastroDadosObraInicial;
  const turnoAtivo = turnoIdInformado
    ? obterTurnoPorId(dadosObra.turnos, turnoIdParametro)
    : obterTurnoAtivo(cadastro, obraAtiva?.id ?? null, dadosObra.turnos);

  return {
    obraAtiva,
    obraAtivaId: obraAtiva?.id ?? null,
    turnoAtivo,
    turnoAtivoId: turnoAtivo?.id ?? null,
    dadosObra,
    obraIdInformado,
    turnoIdInformado,
    obraIdParametro: obraAtivaId,
    turnoIdParametro:
      turnoIdParametro === null || turnoIdParametro === undefined
        ? null
        : String(turnoIdParametro),
  };
}

export async function salvarTurnoAtivo(
  obraId: number | null,
  turnoNome: string,
  turnoId?: number | null
) {
  if (!obraId || !turnoNome) {
    return;
  }

  const cadastro = carregarCadastroBase();
  const dadosObra = obterDadosObra(cadastro, obraId);
  const turnoSelecionado =
    (turnoId ? obterTurnoPorId(dadosObra.turnos, turnoId) : null) ??
    dadosObra.turnos.find((turno) => turno.nome === turnoNome) ??
    null;

  await salvarCadastroBase({
    ...cadastro,
    turnoAtivoPorObra: {
      ...cadastro.turnoAtivoPorObra,
      [String(obraId)]: turnoSelecionado?.nome ?? turnoNome,
    },
    turnoAtivoIdPorObra: {
      ...cadastro.turnoAtivoIdPorObra,
      ...(turnoSelecionado ? { [String(obraId)]: turnoSelecionado.id } : {}),
    },
  });
  notificarCadastroBaseAtualizado();
}

export function removerDadosObra(
  dadosPorObra: Record<string, CadastroDadosObra>,
  obraId: number
) {
  const novosDados = { ...dadosPorObra };
  delete novosDados[String(obraId)];

  return novosDados;
}

export function notificarCadastroBaseAtualizado() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(cadastroBaseEvento));
}

function salvarCadastroBaseLocal(cadastro: CadastroBase) {
  try {
    window.localStorage.setItem(cadastroBaseStorageKey, JSON.stringify(cadastro));
  } catch {
    window.localStorage.setItem(
      cadastroBaseStorageKey,
      JSON.stringify({ ...cadastro, logoUrl: "" })
    );
  }
}

async function salvarCadastroBaseRemoto(cadastro: CadastroBase) {
  const { error } = await supabase.from("cadastro_base").upsert({
    id: cadastroBaseRemotoId,
    dados: cadastro,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("Nao foi possivel sincronizar cadastro no Supabase.", error);
    await salvarCadastroBaseFallback(cadastro);
  }
}

async function carregarCadastroBaseFallback() {
  const { data, error } = await supabase
    .from("atividades")
    .select("id, atividade")
    .eq("turno", cadastroBaseFallbackTurno)
    .eq("disciplina", cadastroBaseFallbackDisciplina)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.atividade) {
    return cadastroBaseInicial;
  }

  try {
    return normalizarCadastroBase(JSON.parse(data.atividade));
  } catch {
    return cadastroBaseInicial;
  }
}

async function salvarCadastroBaseFallback(cadastro: CadastroBase) {
  const cadastroSemLogo = {
    ...cadastro,
    logoUrl: "",
    obras: cadastro.obras.map((obra) => ({ ...obra, logoUrl: "" })),
  };
  const atividade = JSON.stringify(cadastroSemLogo);
  const payload = {
    obra_id: null,
    prioridade: "C",
    disciplina: cadastroBaseFallbackDisciplina,
    atividade,
    local: "cadastro_base",
    responsavel: "sistema",
    previsto: 0,
    realizado: 0,
    unidade: "un",
    tempo_previsto_horas: 0,
    status: "Planejada",
    progresso: 0,
    turno: cadastroBaseFallbackTurno,
    data_turno: "2000-01-01",
  };

  const { data } = await supabase
    .from("atividades")
    .select("id")
    .eq("turno", cadastroBaseFallbackTurno)
    .eq("disciplina", cadastroBaseFallbackDisciplina)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) {
    await supabase.from("atividades").update(payload).eq("id", data.id);
    return;
  }

  await supabase.from("atividades").insert([payload]);
}

function cadastroTemConteudo(cadastro: CadastroBase) {
  return (
    cadastro.obras.length > 0 ||
    Object.keys(cadastro.dadosPorObra).length > 0 ||
    cadastro.usuarios.length > 0 ||
    cadastro.disciplinas.length > 0 ||
    cadastro.funcoesPrevistas.length > 0 ||
    cadastro.turnos.length > 0
  );
}

function normalizarCadastroBase(cadastro: Partial<CadastroBase>): CadastroBase {
  const obras = Array.isArray(cadastro.obras)
    ? cadastro.obras
        .map((obra) => ({
          ...obra,
          id: Number(obra.id),
          logoUrl: obra.logoUrl ?? cadastro.logoUrl ?? "",
        }))
        .filter((obra) => Number.isFinite(obra.id))
    : [];
  const obraAtivaId =
    cadastro.obraAtivaId &&
    obras.some((obra) => String(obra.id) === String(cadastro.obraAtivaId))
      ? Number(cadastro.obraAtivaId)
      : null;

  return {
    ...cadastroBaseInicial,
    ...cadastro,
    obras,
    obraAtivaId,
    turnoAtivoPorObra: cadastro.turnoAtivoPorObra ?? {},
    turnoAtivoIdPorObra: cadastro.turnoAtivoIdPorObra ?? {},
    dadosPorObra: cadastro.dadosPorObra ?? {},
    operacao: {
      atividades:
        cadastro.operacao?.atividades &&
        typeof cadastro.operacao.atividades === "object"
          ? cadastro.operacao.atividades
          : {},
      restricoesHistorico: Array.isArray(cadastro.operacao?.restricoesHistorico)
        ? cadastro.operacao.restricoesHistorico
        : [],
      controlesTurno:
        cadastro.operacao?.controlesTurno &&
        typeof cadastro.operacao.controlesTurno === "object"
          ? cadastro.operacao.controlesTurno
          : {},
    },
    usuarios: Array.isArray(cadastro.usuarios) ? cadastro.usuarios : [],
    disciplinas: Array.isArray(cadastro.disciplinas)
      ? cadastro.disciplinas
      : [],
    funcoesPrevistas: Array.isArray(cadastro.funcoesPrevistas)
      ? cadastro.funcoesPrevistas
      : [],
    turnos: Array.isArray(cadastro.turnos) ? cadastro.turnos : [],
  };
}

function normalizarDadosObra(
  dados: Partial<CadastroDadosObra>
): CadastroDadosObra {
  return {
    usuarios: Array.isArray(dados.usuarios) ? dados.usuarios : [],
    disciplinas: Array.isArray(dados.disciplinas) ? dados.disciplinas : [],
    funcoesPrevistas: Array.isArray(dados.funcoesPrevistas)
      ? dados.funcoesPrevistas.map((funcao) => ({
          ...funcao,
          quantidade: Number(funcao.quantidade || 0),
          cargaHoraria: Number(funcao.cargaHoraria || 0),
        }))
      : [],
    turnos: Array.isArray(dados.turnos) ? dados.turnos : [],
  };
}
