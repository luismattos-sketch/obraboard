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
  dadosPorObra: Record<string, CadastroDadosObra>;
  usuarios: UsuarioCadastrado[];
  disciplinas: DisciplinaCadastrada[];
  funcoesPrevistas: FuncaoPrevistaCadastrada[];
  turnos: TurnoCadastrado[];
};

export const cadastroBaseStorageKey = "obraboard:cadastro-base";
export const cadastroBaseEvento = "obraboard:cadastro-base-atualizado";
const cadastroBaseRemotoId = "default";

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
  dadosPorObra: {},
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
    salvarCadastroBase(cadastro);
  }

  return cadastro;
}

export function salvarCadastroBase(cadastro: CadastroBase) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cadastroBaseStorageKey, JSON.stringify(cadastro));
    void salvarCadastroBaseRemoto(cadastro);
  } catch {
    try {
      const cadastroSemLogo = { ...cadastro, logoUrl: "" };
      window.localStorage.setItem(cadastroBaseStorageKey, JSON.stringify(cadastroSemLogo));
      void salvarCadastroBaseRemoto(cadastroSemLogo);
    } catch {
      // Mantem a tela funcionando mesmo se o armazenamento local estiver cheio.
    }
  }
}

export async function sincronizarCadastroBaseRemoto() {
  if (typeof window === "undefined") {
    return cadastroBaseInicial;
  }

  const cadastroLocal = carregarCadastroBase();

  const { data, error } = await supabase
    .from("cadastro_base")
    .select("dados")
    .eq("id", cadastroBaseRemotoId)
    .maybeSingle();

  if (error) {
    console.warn("Cadastro remoto indisponivel, usando cache local.", error);
    return cadastroLocal;
  }

  if (!data?.dados) {
    if (cadastroTemConteudo(cadastroLocal)) {
      await salvarCadastroBaseRemoto(cadastroLocal);
    }

    return cadastroLocal;
  }

  const cadastroRemoto = normalizarCadastroBase(data.dados as Partial<CadastroBase>);

  if (!cadastroTemConteudo(cadastroLocal) && cadastroTemConteudo(cadastroRemoto)) {
    salvarCadastroBaseLocal(cadastroRemoto);
    notificarCadastroBaseAtualizado();
    return cadastroRemoto;
  }

  if (cadastroTemConteudo(cadastroLocal) && !cadastroTemConteudo(cadastroRemoto)) {
    await salvarCadastroBaseRemoto(cadastroLocal);
    return cadastroLocal;
  }

  salvarCadastroBaseLocal(cadastroRemoto);
  notificarCadastroBaseAtualizado();
  return cadastroRemoto;
}

export function criarCadastroBaseVazio(): CadastroBase {
  return {
    logoUrl: "",
    obras: [],
    obraAtivaId: null,
    turnoAtivoPorObra: {},
    dadosPorObra: {},
    usuarios: [],
    disciplinas: [],
    funcoesPrevistas: [],
    turnos: [],
  };
}

export function obterObraAtiva(cadastro: CadastroBase) {
  return (
    cadastro.obras.find((obra) => obra.id === cadastro.obraAtivaId) ??
    cadastro.obras[0] ??
    null
  );
}

export function obterObraAtivaId(cadastro: CadastroBase) {
  return obterObraAtiva(cadastro)?.id ?? null;
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
    obraAtivaId: obraId,
    dadosPorObra: {
      ...cadastro.dadosPorObra,
      [String(obraId)]: normalizarDadosObra(dados),
    },
  };
}

export function salvarObraAtivaId(obraId: number | null) {
  const cadastro = carregarCadastroBase();
  const obraExiste = obraId
    ? cadastro.obras.some((obra) => obra.id === obraId)
    : false;

  salvarCadastroBase({
    ...cadastro,
    obraAtivaId: obraExiste ? obraId : cadastro.obras[0]?.id ?? null,
  });
  notificarCadastroBaseAtualizado();
}

export function obterTurnoAtivoNome(
  cadastro: CadastroBase,
  obraId: number | null,
  turnos: TurnoCadastrado[]
) {
  if (!obraId) {
    return turnos[0]?.nome ?? "";
  }

  const turnoSalvo = cadastro.turnoAtivoPorObra[String(obraId)];

  return turnos.some((turno) => turno.nome === turnoSalvo)
    ? turnoSalvo
    : turnos[0]?.nome ?? "";
}

export function salvarTurnoAtivo(obraId: number | null, turnoNome: string) {
  if (!obraId || !turnoNome) {
    return;
  }

  const cadastro = carregarCadastroBase();

  salvarCadastroBase({
    ...cadastro,
    turnoAtivoPorObra: {
      ...cadastro.turnoAtivoPorObra,
      [String(obraId)]: turnoNome,
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
  }
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
    ? cadastro.obras.map((obra) => ({
        ...obra,
        logoUrl: obra.logoUrl ?? cadastro.logoUrl ?? "",
      }))
    : [];
  const obraAtivaId =
    cadastro.obraAtivaId && obras.some((obra) => obra.id === cadastro.obraAtivaId)
      ? cadastro.obraAtivaId
      : obras[0]?.id ?? null;

  return {
    ...cadastroBaseInicial,
    ...cadastro,
    obras,
    obraAtivaId,
    turnoAtivoPorObra: cadastro.turnoAtivoPorObra ?? {},
    dadosPorObra: cadastro.dadosPorObra ?? {},
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
