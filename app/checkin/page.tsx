"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import { supabase } from "../../lib/supabase";
import type {
  Atividade,
  AtividadeRecurso,
  PrioridadeAtividade,
  RecursoDisponivelTurno,
} from "../../lib/types";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterDadosObra,
  obterObraAtiva,
  obterTurnoAtivoNome,
  salvarTurnoAtivo,
  type DisciplinaCadastrada,
  type FuncaoPrevistaCadastrada,
  type TurnoCadastrado,
  type UsuarioCadastrado,
} from "../../lib/cadastro-base";
import {
  chaveTurno,
  checkoutFechamentosStorageKey,
  carregarObjetoLocal,
} from "../../lib/operacao";

type RecursoFormulario = {
  id: number;
  funcao: string;
  quantidade_prevista: number;
};

type AtividadeInsert = {
  obra_id: number;
  prioridade: PrioridadeAtividade;
  disciplina: string;
  atividade: string;
  local: string;
  responsavel: string;
  previsto: number;
  unidade: string;
  tempo_previsto_horas: number;
  realizado: number;
  status: "Planejada";
  progresso: number;
  turno: string;
  data_turno: string;
  origem_atividade_id?: number | null;
};

const unidades = [
  "un",
  "m",
  "m2",
  "m3",
  "kg",
  "t",
  "peca",
  "suporte",
  "base",
  "equipamento",
  "linha",
  "lance",
];

const dataHoje = () => new Date().toISOString().slice(0, 10);
let sequenciaRecursoFormulario = 0;
const recursosDisponiveisStorageKey = "obraboard:recursos-disponiveis-local";

function criarIdTemporario() {
  sequenciaRecursoFormulario += 1;
  return sequenciaRecursoFormulario;
}

function carregarRecursosDisponiveisLocais() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(recursosDisponiveisStorageKey) || "[]"
    ) as RecursoDisponivelTurno[];
  } catch {
    return [];
  }
}

function salvarRecursosDisponiveisLocais(recursos: RecursoDisponivelTurno[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    recursosDisponiveisStorageKey,
    JSON.stringify(recursos)
  );
}

export default function CheckinPage() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [dataTurno, setDataTurno] = useState(dataHoje);
  const [turno, setTurno] = useState("");
  const [planejador, setPlanejador] = useState("Luis Villaca");
  const [prioridade, setPrioridade] = useState<PrioridadeAtividade>("A");
  const [disciplina, setDisciplina] = useState("");
  const [atividade, setAtividade] = useState("");
  const [local, setLocal] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [previsto, setPrevisto] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [tempoPrevistoHoras, setTempoPrevistoHoras] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [recursosPorAtividade, setRecursosPorAtividade] = useState<
    Record<number, AtividadeRecurso[]>
  >({});
  const [recursosAtividade, setRecursosAtividade] = useState<
    RecursoFormulario[]
  >([]);
  const [turnosCadastrados, setTurnosCadastrados] = useState<
    TurnoCadastrado[]
  >([]);
  const [disciplinasCadastradas, setDisciplinasCadastradas] = useState<
    DisciplinaCadastrada[]
  >([]);
  const [usuariosCadastrados, setUsuariosCadastrados] = useState<
    UsuarioCadastrado[]
  >([]);
  const [funcoesPrevistasCadastradas, setFuncoesPrevistasCadastradas] =
    useState<FuncaoPrevistaCadastrada[]>([]);
  const [recursosDisponiveis, setRecursosDisponiveis] = useState<
    RecursoDisponivelTurno[]
  >([]);
  const [funcaoRecurso, setFuncaoRecurso] = useState("");
  const [quantidadeRecurso, setQuantidadeRecurso] = useState("");
  const [funcaoDisponivel, setFuncaoDisponivel] = useState("");
  const [quantidadeDisponivel, setQuantidadeDisponivel] = useState("");
  const [cargaHorariaDisponivel, setCargaHorariaDisponivel] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [atividadeEditandoId, setAtividadeEditandoId] = useState<number | null>(
    null
  );
  const [atividadeExcluindoId, setAtividadeExcluindoId] = useState<
    number | null
  >(null);
  const [edicao, setEdicao] = useState({
    prioridade: "A" as PrioridadeAtividade,
    disciplina: "",
    atividade: "",
    local: "",
    responsavel: "",
    previsto: "",
    unidade: "un",
    tempoPrevistoHoras: "",
  });
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [fechamentos, setFechamentos] = useState<Record<string, { encerradoEm: string }>>(
    () => carregarObjetoLocal(checkoutFechamentosStorageKey, {})
  );

  const turnoEncerrado = Boolean(fechamentos[chaveTurno(obraId, dataTurno, turno)]);

  const atividadesTurno = useMemo(
    () =>
      atividades.filter(
        (item) =>
          item.obra_id === obraId &&
          item.data_turno === dataTurno &&
          item.turno === turno
      ),
    [atividades, dataTurno, obraId, turno]
  );

  const recursosDisponiveisPorFuncao = useMemo(() => {
    const mapa = new Map<string, number>();

    recursosDisponiveis.forEach((item) => {
      mapa.set(item.funcao, (mapa.get(item.funcao) ?? 0) + item.quantidade);
    });

    return mapa;
  }, [recursosDisponiveis]);

  const hhDisponivelTurno = useMemo(
    () =>
      recursosDisponiveis.reduce(
        (total, item) =>
          total + Number(item.quantidade || 0) * Number(item.cargaHoraria || 0),
        0
      ),
    [recursosDisponiveis]
  );

  const hhAtividadeEmEdicao = useMemo(() => {
    if (!atividadeEditandoId) {
      return 0;
    }

    const atividade = atividades.find((item) => item.id === atividadeEditandoId);
    const equipe = somarRecursosAtividade(atividadeEditandoId);

    return Number(atividade?.tempo_previsto_horas || 0) * equipe;
    // somarRecursosAtividade depende do mapa atualizado em memoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividadeEditandoId, atividades, recursosPorAtividade]);

  const hhNovoAtividade = useMemo(
    () =>
      Number(tempoPrevistoHoras || 0) *
      recursosAtividade.reduce(
        (total, item) => total + Number(item.quantidade_prevista || 0),
        0
      ),
    [recursosAtividade, tempoPrevistoHoras]
  );

  const hhCadastradoTurno = useMemo(() => {
    return atividades
      .filter(
        (item) =>
          item.obra_id === obraId &&
          item.data_turno === dataTurno &&
          item.turno === turno
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.tempo_previsto_horas || 0) * somarRecursosAtividade(item.id),
        0
      );
    // somarRecursosAtividade depende do mapa atualizado em memoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividades, dataTurno, obraId, recursosPorAtividade, turno]);

  const totais = useMemo(() => {
    const planejadas = atividadesTurno.filter(
      (item) => item.status === "Planejada"
    ).length;
    const prioridadeA = atividadesTurno.filter(
      (item) => item.prioridade === "A"
    ).length;
    const totalPrevisto = atividadesTurno.reduce(
      (total, item) => total + Number(item.previsto || 0),
      0
    );
    const equipePrevista = atividadesTurno.reduce(
      (total, item) =>
        total +
        (recursosPorAtividade[item.id] ?? []).reduce(
          (subtotal, recurso) =>
            subtotal + Number(recurso.quantidade_prevista || 0),
          0
        ),
      0
    );

    return {
      planejadas,
      prioridadeA,
      totalPrevisto,
      equipePrevista,
    };
  }, [atividadesTurno, recursosPorAtividade]);

  async function carregarAtividades(obraAtualId = obraId) {
    if (!obraAtualId) {
      setAtividades([]);
      setRecursosPorAtividade({});
      setCarregando(false);
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase
      .from("atividades")
      .select("*")
      .eq("obra_id", obraAtualId)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setErro(
        "Nao foi possivel carregar atividades. Execute o SQL atualizado no Supabase."
      );
      setAtividades([]);
      setRecursosPorAtividade({});
      setCarregando(false);
      return;
    }

    const atividadesCarregadas = (data || []) as Atividade[];
    setAtividades(atividadesCarregadas);
    await carregarRecursosAtividades(atividadesCarregadas);
    setCarregando(false);
  }

  async function carregarRecursosAtividades(atividadesCarregadas: Atividade[]) {
    const ids = atividadesCarregadas.map((item) => item.id);

    if (ids.length === 0) {
      setRecursosPorAtividade({});
      return;
    }

    const { data, error } = await supabase
      .from("atividade_recursos")
      .select("*")
      .in("atividade_id", ids);

    if (error) {
      console.error(error);
      setErro(
        "Nao foi possivel carregar recursos das atividades. Execute o SQL atualizado no Supabase."
      );
      setRecursosPorAtividade({});
      return;
    }

    const agrupado = ((data || []) as AtividadeRecurso[]).reduce<
      Record<number, AtividadeRecurso[]>
    >((mapa, recurso) => {
      mapa[recurso.atividade_id] = [
        ...(mapa[recurso.atividade_id] ?? []),
        recurso,
      ];
      return mapa;
    }, {});

    setRecursosPorAtividade(agrupado);
  }

  async function carregarRecursosDisponiveis(
    obraAtualId = obraId,
    dataAtual = dataTurno,
    turnoAtual = turno
  ) {
    if (!obraAtualId || !dataAtual || !turnoAtual) {
      setRecursosDisponiveis([]);
      return;
    }

    const locais = carregarRecursosDisponiveisLocais().filter(
      (item) =>
        item.obra_id === obraAtualId &&
        item.data_turno === dataAtual &&
        item.turno === turnoAtual
    );

    const { data, error } = await supabase
      .from("recursos_disponiveis")
      .select("*")
      .eq("obra_id", obraAtualId)
      .eq("data_turno", dataAtual)
      .eq("turno", turnoAtual)
      .order("id", { ascending: true });

    if (error) {
      console.warn("Tabela recursos_disponiveis indisponivel, usando localStorage.", error);
      setRecursosDisponiveis(locais);
      return;
    }

    const banco = (data || []).map((item: Record<string, unknown>) => ({
      id: Number(item.id),
      obra_id: Number(item.obra_id),
      data_turno: String(item.data_turno),
      turno: String(item.turno),
      funcao: String(item.funcao),
      quantidade: Number(item.quantidade || 0),
      cargaHoraria: Number(item.carga_horaria || 0),
    }));

    setRecursosDisponiveis([...banco, ...locais]);
  }

  useEffect(() => {
    function carregarContextoObra() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const dadosObra = obterDadosObra(cadastro, obraAtiva?.id ?? null);
      const turnoAtivo = obterTurnoAtivoNome(
        cadastro,
        obraAtiva?.id ?? null,
        dadosObra.turnos
      );
      setObraId(obraAtiva?.id ?? null);
      setObra(obraAtiva?.nome ?? "Sem obra selecionada");
      setTurnosCadastrados(dadosObra.turnos);
      setDisciplinasCadastradas(dadosObra.disciplinas);
      setUsuariosCadastrados(dadosObra.usuarios);
      setFuncoesPrevistasCadastradas(dadosObra.funcoesPrevistas);

      if (turnoAtivo) {
        setTurno(turnoAtivo);
      } else {
        setTurno("");
      }

      void carregarAtividades(obraAtiva?.id ?? null);
      setFechamentos(carregarObjetoLocal(checkoutFechamentosStorageKey, {}));
    }

    queueMicrotask(carregarContextoObra);
    window.addEventListener(cadastroBaseEvento, carregarContextoObra);
    window.addEventListener("storage", carregarContextoObra);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoObra);
      window.removeEventListener("storage", carregarContextoObra);
    };
    // carregarAtividades recebe o id atual explicitamente neste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void carregarRecursosDisponiveis(obraId, dataTurno, turno);
    });
    // carregarRecursosDisponiveis recebe os parametros explicitamente neste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId, dataTurno, turno]);

  async function adicionarAtividade() {
    setMensagem("");
    setErro("");

    if (!obraId) {
      setErro("Selecione uma obra ativa antes de cadastrar atividades.");
      return;
    }

    if (!turno) {
      setErro("Cadastre e selecione um turno antes de cadastrar atividades.");
      return;
    }

    if (
      !atividade ||
      !disciplina ||
      !local ||
      !responsavel ||
      !previsto ||
      !tempoPrevistoHoras
    ) {
      setErro(
        "Preencha disciplina, atividade, local, responsavel, previsao e tempo previsto."
      );
      return;
    }

    if (recursosAtividade.length === 0) {
      setErro("Informe ao menos um recurso previsto para a atividade.");
      return;
    }

    const tempo = Number(tempoPrevistoHoras);
    const quantidade = Number(previsto);

    if (tempo <= 0 || quantidade <= 0) {
      setErro("Previsao e tempo previsto devem ser maiores que zero.");
      return;
    }

    const erroRecursos = validarLimiteRecursos(turno, recursosAtividade);

    if (erroRecursos) {
      setErro(erroRecursos);
      return;
    }

    if (atividadeEditandoId) {
      await atualizarAtividadeEditando(atividadeEditandoId);
      return;
    }

    const hhCadastradoAtual = hhCadastradoTurno - hhAtividadeEmEdicao;
    const hhRestante =
      hhDisponivelTurno > 0
        ? Math.max(hhDisponivelTurno - hhCadastradoAtual, 0)
        : hhNovoAtividade;
    const horasRestantes =
      hhNovoAtividade > 0 ? Math.min(tempo, (hhRestante / hhNovoAtividade) * tempo) : tempo;

    if (hhDisponivelTurno > 0 && hhCadastradoAtual + hhNovoAtividade > hhDisponivelTurno) {
      const aceitouProgramar = window.confirm(
        "O HH cadastrado ultrapassa o HH disponivel do turno. Deseja programar o excedente para os turnos seguintes?"
      );

      if (!aceitouProgramar) {
        setErro("O HH cadastrado excede o HH disponivel no turno.");
        return;
      }

      const proximoTurno = obterProximoTurno(turno);

      if (!proximoTurno) {
        setErro(
          "Nao existe proximo turno cadastrado para programar as horas excedentes."
        );
        return;
      }

      const erroRecursosProximoTurno = validarLimiteRecursos(
        proximoTurno.nome,
        recursosAtividade
      );

      if (erroRecursosProximoTurno) {
        setErro(erroRecursosProximoTurno);
        return;
      }

      await salvarAtividadeComExcedente(horasRestantes, tempo, proximoTurno);
      return;
    }

    setSalvando(true);
    await salvarParteAtividade({
      tempoPrevisto: tempo,
      quantidadePrevista: quantidade,
      turnoDestino: turno,
      origemAtividadeId: null,
    });
    await finalizarCadastro("Atividade adicionada ao turno.");
  }

  async function atualizarAtividadeEditando(id: number) {
    setSalvando(true);

    const { data, error } = await supabase
      .from("atividades")
      .update({
        prioridade,
        disciplina,
        atividade,
        local,
        responsavel,
        previsto: Number(previsto),
        unidade,
        tempo_previsto_horas: Number(tempoPrevistoHoras),
      })
      .eq("id", id)
      .select("id");

    if (error) {
      console.error(error);
      setErro("Erro ao editar atividade.");
      setSalvando(false);
      return;
    }

    if (!data.length) {
      setErro(
        "O Supabase nao autorizou a edicao desta atividade. Verifique a politica de update da tabela atividades."
      );
      setSalvando(false);
      return;
    }

    await salvarRecursosDaAtividade(id, recursosAtividade);
    await finalizarCadastro("Atividade atualizada.");
  }

  async function salvarAtividadeComExcedente(
    horasRestantes: number,
    tempoTotal: number,
    proximoTurno: TurnoCadastrado
  ) {
    setSalvando(true);

    const quantidadeTotal = Number(previsto);
    let origemAtividadeId: number | null = null;

    if (horasRestantes > 0) {
      const quantidadeTurnoAtual = calcularQuantidadeProporcional(
        quantidadeTotal,
        horasRestantes,
        tempoTotal
      );
      origemAtividadeId = await salvarParteAtividade({
        tempoPrevisto: horasRestantes,
        quantidadePrevista: quantidadeTurnoAtual,
        turnoDestino: turno,
        origemAtividadeId: null,
      });
    }

    const horasExcedentes = tempoTotal - horasRestantes;
    const quantidadeExcedente =
      horasRestantes > 0
        ? Math.max(quantidadeTotal - calcularQuantidadeProporcional(
            quantidadeTotal,
            horasRestantes,
            tempoTotal
          ), 0)
        : quantidadeTotal;

    await salvarParteAtividade({
      tempoPrevisto: horasExcedentes,
      quantidadePrevista: quantidadeExcedente,
      turnoDestino: proximoTurno.nome,
      origemAtividadeId,
    });

    await finalizarCadastro("Atividade programada com excedente no proximo turno.");
  }

  async function salvarParteAtividade({
    tempoPrevisto,
    quantidadePrevista,
    turnoDestino,
    origemAtividadeId,
  }: {
    tempoPrevisto: number;
    quantidadePrevista: number;
    turnoDestino: string;
    origemAtividadeId: number | null;
  }) {
    if (!obraId) {
      throw new Error("Obra ativa nao definida.");
    }

    const payload: AtividadeInsert = {
      obra_id: obraId,
      prioridade,
      disciplina,
      atividade,
      local,
      responsavel,
      previsto: quantidadePrevista,
      unidade,
      tempo_previsto_horas: tempoPrevisto,
      realizado: 0,
      status: "Planejada",
      progresso: 0,
      turno: turnoDestino,
      data_turno: dataTurno,
      origem_atividade_id: origemAtividadeId,
    };

    const { data, error } = await supabase
      .from("atividades")
      .insert([payload])
      .select("id")
      .single();

    if (error || !data) {
      console.error(error);
      setErro("Erro ao salvar atividade. Verifique o SQL atualizado no Supabase.");
      setSalvando(false);
      throw error ?? new Error("Atividade sem id retornado.");
    }

    await salvarRecursosDaAtividade(data.id, recursosAtividade);
    return data.id as number;
  }

  async function salvarRecursosDaAtividade(
    atividadeId: number,
    recursos: RecursoFormulario[]
  ) {
    await supabase
      .from("atividade_recursos")
      .delete()
      .eq("atividade_id", atividadeId);

    const recursosValidos = recursos.filter(
      (item) => item.funcao && item.quantidade_prevista > 0
    );

    if (recursosValidos.length === 0) {
      return;
    }

    const { error } = await supabase.from("atividade_recursos").insert(
      recursosValidos.map((item) => ({
        atividade_id: atividadeId,
        funcao: item.funcao,
        quantidade_prevista: item.quantidade_prevista,
      }))
    );

    if (error) {
      console.error(error);
      setErro("Erro ao salvar recursos da atividade.");
      throw error;
    }
  }

  async function finalizarCadastro(textoMensagem: string) {
    await carregarAtividades(obraId);
    limparFormularioAtividade();
    setMensagem(textoMensagem);
    setSalvando(false);
  }

  function validarLimiteRecursos(
    turnoAlvo: string,
    recursosNovos: RecursoFormulario[]
  ) {
    for (const recurso of recursosNovos) {
      const disponivel = recursosDisponiveisPorFuncao.get(recurso.funcao) ?? 0;
      const usado = somarRecursoPorFuncao(turnoAlvo, recurso.funcao);
      const recursoDaEdicao =
        atividadeEditandoId && turnoAlvo === turno
          ? somarRecursoDaAtividadePorFuncao(atividadeEditandoId, recurso.funcao)
          : 0;
      const total = usado - recursoDaEdicao + recurso.quantidade_prevista;

      if (total > disponivel) {
        return `Quantidade de ${recurso.funcao} excede o total disponivel para esta obra/turno.`;
      }
    }

    return "";
  }

  function somarRecursoPorFuncao(turnoAlvo: string, funcao: string) {
    return atividades
      .filter(
        (item) =>
          item.obra_id === obraId &&
          item.data_turno === dataTurno &&
          item.turno === turnoAlvo
      )
      .reduce(
        (total, item) => total + somarRecursoDaAtividadePorFuncao(item.id, funcao),
        0
      );
  }

  function somarRecursoDaAtividadePorFuncao(atividadeId: number, funcao: string) {
    return (recursosPorAtividade[atividadeId] ?? [])
      .filter((item) => item.funcao === funcao)
      .reduce((total, item) => total + Number(item.quantidade_prevista || 0), 0);
  }

  function somarRecursosAtividade(atividadeId: number) {
    return (recursosPorAtividade[atividadeId] ?? []).reduce(
      (total, item) => total + Number(item.quantidade_prevista || 0),
      0
    );
  }

  function obterProximoTurno(turnoAtual: string) {
    if (turnosCadastrados.length < 2) {
      return null;
    }

    const indiceAtual = turnosCadastrados.findIndex(
      (item) => item.nome === turnoAtual
    );
    const proximoIndice =
      indiceAtual >= 0 ? (indiceAtual + 1) % turnosCadastrados.length : 0;

    return turnosCadastrados[proximoIndice] ?? null;
  }

  function adicionarRecursoDaAtividade() {
    setMensagem("");
    setErro("");

    if (!funcaoRecurso || !quantidadeRecurso) {
      setErro("Informe funcao e quantidade para o recurso da atividade.");
      return;
    }

    const quantidade = Number(quantidadeRecurso);

    if (quantidade <= 0) {
      setErro("Quantidade do recurso deve ser maior que zero.");
      return;
    }

    setRecursosAtividade((atuais) => {
      const existente = atuais.find((item) => item.funcao === funcaoRecurso);

      if (existente) {
        return atuais.map((item) =>
          item.funcao === funcaoRecurso
            ? {
                ...item,
                quantidade_prevista: item.quantidade_prevista + quantidade,
              }
            : item
        );
      }

      return [
        ...atuais,
        {
          id: criarIdTemporario(),
          funcao: funcaoRecurso,
          quantidade_prevista: quantidade,
        },
      ];
    });
    setFuncaoRecurso("");
    setQuantidadeRecurso("");
  }

  function removerRecursoDaAtividade(id: number) {
    setRecursosAtividade((atuais) => atuais.filter((item) => item.id !== id));
  }

  async function adicionarRecursoDisponivel() {
    setMensagem("");
    setErro("");

    if (!obraId || !dataTurno || !turno) {
      setErro("Selecione obra, data e turno antes de cadastrar recursos.");
      return;
    }

    if (!funcaoDisponivel || !quantidadeDisponivel || !cargaHorariaDisponivel) {
      setErro("Informe funcao, quantidade e horas por pessoa do recurso disponivel.");
      return;
    }

    const quantidade = Number(quantidadeDisponivel);
    const cargaHoraria = Number(cargaHorariaDisponivel);

    if (quantidade <= 0 || cargaHoraria <= 0) {
      setErro("Quantidade e horas por pessoa devem ser maiores que zero.");
      return;
    }

    const payload = {
      obra_id: obraId,
      data_turno: dataTurno,
      turno,
      funcao: funcaoDisponivel,
      quantidade,
      carga_horaria: cargaHoraria,
    };

    const { error } = await supabase.from("recursos_disponiveis").insert([payload]);

    if (error) {
      console.warn("Salvando recurso disponivel no localStorage.", error);
      const locais = carregarRecursosDisponiveisLocais();
      locais.push({
        id: -Date.now(),
        obra_id: obraId,
        data_turno: dataTurno,
        turno,
        funcao: funcaoDisponivel,
        quantidade,
        cargaHoraria,
      });
      salvarRecursosDisponiveisLocais(locais);
    }

    setFuncaoDisponivel("");
    setQuantidadeDisponivel("");
    setCargaHorariaDisponivel("");
    setMensagem("Recurso disponivel cadastrado no turno.");
    await carregarRecursosDisponiveis(obraId, dataTurno, turno);
  }

  async function removerRecursoDisponivel(recurso: RecursoDisponivelTurno) {
    setMensagem("");
    setErro("");

    if (recurso.id > 0) {
      const { error } = await supabase
        .from("recursos_disponiveis")
        .delete()
        .eq("id", recurso.id);

      if (error) {
        setErro("Erro ao remover recurso disponivel.");
        return;
      }
    } else {
      salvarRecursosDisponiveisLocais(
        carregarRecursosDisponiveisLocais().filter((item) => item.id !== recurso.id)
      );
    }

    setMensagem("Recurso disponivel removido.");
    await carregarRecursosDisponiveis(obraId, dataTurno, turno);
  }

  function iniciarEdicao(item: Atividade) {
    setMensagem("");
    setErro("");
    setAtividadeExcluindoId(null);
    setAtividadeEditandoId(item.id);
    setPrioridade(item.prioridade);
    setDisciplina(item.disciplina);
    setAtividade(item.atividade);
    setLocal(item.local);
    setResponsavel(item.responsavel);
    setPrevisto(String(item.previsto));
    setUnidade(item.unidade || "un");
    setTempoPrevistoHoras(String(item.tempo_previsto_horas || ""));
    setRecursosAtividade(
      (recursosPorAtividade[item.id] ?? []).map((recurso) => ({
        id: recurso.id,
        funcao: recurso.funcao,
        quantidade_prevista: Number(recurso.quantidade_prevista || 0),
      }))
    );
    setEdicao({
      prioridade: item.prioridade,
      disciplina: item.disciplina,
      atividade: item.atividade,
      local: item.local,
      responsavel: item.responsavel,
      previsto: String(item.previsto),
      unidade: item.unidade || "un",
      tempoPrevistoHoras: String(item.tempo_previsto_horas || ""),
    });
  }

  function cancelarEdicao() {
    limparFormularioAtividade();
  }

  function limparFormularioAtividade() {
    setAtividadeEditandoId(null);
    setPrioridade("A");
    setDisciplina("");
    setAtividade("");
    setLocal("");
    setResponsavel("");
    setPrevisto("");
    setUnidade("un");
    setTempoPrevistoHoras("");
    setRecursosAtividade([]);
    setFuncaoRecurso("");
    setQuantidadeRecurso("");
  }

  async function salvarEdicao(id: number) {
    setMensagem("");
    setErro("");

    if (
      !edicao.atividade ||
      !edicao.disciplina ||
      !edicao.local ||
      !edicao.responsavel ||
      !edicao.previsto ||
      !edicao.tempoPrevistoHoras
    ) {
      setErro("Preencha todos os campos antes de salvar a edicao.");
      return;
    }

    const tempo = Number(edicao.tempoPrevistoHoras);
    const quantidade = Number(edicao.previsto);

    if (tempo <= 0 || quantidade <= 0) {
      setErro("Previsao e tempo previsto devem ser maiores que zero.");
      return;
    }

    if (
      hhDisponivelTurno > 0 &&
      hhCadastradoTurno - hhAtividadeEmEdicao + hhNovoAtividade >
        hhDisponivelTurno
    ) {
      setErro("O HH cadastrado excede o HH disponivel no turno.");
      return;
    }

    setSalvando(true);

    const { data, error } = await supabase
      .from("atividades")
      .update({
        prioridade: edicao.prioridade,
        disciplina: edicao.disciplina,
        atividade: edicao.atividade,
        local: edicao.local,
        responsavel: edicao.responsavel,
        previsto: quantidade,
        unidade: edicao.unidade,
        tempo_previsto_horas: tempo,
      })
      .eq("id", id)
      .select("id");

    if (error) {
      console.error(error);
      setErro("Erro ao editar atividade.");
      setSalvando(false);
      return;
    }

    if (!data.length) {
      setErro(
        "O Supabase nao autorizou a edicao desta atividade. Verifique a politica de update da tabela atividades."
      );
      setSalvando(false);
      return;
    }

    await carregarAtividades(obraId);
    setAtividadeEditandoId(null);
    setAtividadeExcluindoId(null);
    setMensagem("Atividade atualizada.");
    setSalvando(false);
  }

  function pedirExclusao(id: number) {
    setMensagem("");
    setErro("");
    setAtividadeEditandoId(null);
    setAtividadeExcluindoId(id);
  }

  function cancelarExclusao() {
    setAtividadeExcluindoId(null);
  }

  async function confirmarExclusao(id: number) {
    setMensagem("");
    setErro("");
    setSalvando(true);

    await supabase.from("atividade_recursos").delete().eq("atividade_id", id);

    const { data, error } = await supabase
      .from("atividades")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error(error);
      setErro("Erro ao excluir atividade.");
      setSalvando(false);
      return;
    }

    if (!data.length) {
      setErro(
        "O Supabase nao autorizou a exclusao desta atividade. Verifique a politica de delete da tabela atividades."
      );
      setSalvando(false);
      return;
    }

    await carregarAtividades(obraId);
    setAtividadeEditandoId(null);
    setAtividadeExcluindoId(null);
    setMensagem("Atividade excluída.");
    setSalvando(false);
  }

  function alterarTurnoSelecionado(novoTurno: string) {
    setTurno(novoTurno);
    salvarTurnoAtivo(obraId, novoTurno);
  }

  function publicarTurno() {
    setMensagem("");
    setErro("");

    if (!obraId || !dataTurno || !planejador) {
      setErro("Complete obra, data e planejador antes de publicar.");
      return;
    }

    if (atividadesTurno.length === 0) {
      setErro("Adicione ao menos uma atividade antes de publicar o turno.");
      return;
    }

    setMensagem("Turno pronto para execucao no campo.");
  }

  return (
    <DesktopLayout
      titulo="Check-in Operacional"
      subtitulo="Plano de turno, prioridades e recursos previstos"
      status={`${atividadesTurno.length} atividades no turno`}
    >
      <div className="space-y-4">
        {(mensagem || erro) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
              erro
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {erro || mensagem}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div>
              <p className="text-xs font-bold uppercase text-teal-700">
                Preparação do turno
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                {obra}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Defina o pacote de trabalho, valide responsáveis e publique uma
                lista objetiva para a equipe de campo executar.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <ResumoCompacto label="Data" valor={formatarData(dataTurno)} />
              <ResumoCompacto label="Turno" valor={turno || "-"} />
              <ResumoCompacto
                label="Planejador"
                valor={planejador || "-"}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CampoRotulado label="Obra">
              <input
                value={obra}
                readOnly
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-600"
                placeholder="Obra"
              />
            </CampoRotulado>

            <CampoRotulado label="Data">
              <input
                value={dataTurno}
                onChange={(e) => setDataTurno(e.target.value)}
                type="date"
                className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </CampoRotulado>

            <CampoRotulado label="Turno">
              <select
                value={turno}
                onChange={(e) => alterarTurnoSelecionado(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                {turnosCadastrados.length === 0 ? (
                  <option value="">Cadastre turnos na obra</option>
                ) : (
                  turnosCadastrados.map((item) => (
                    <option key={item.id} value={item.nome}>
                      {item.nome || "Turno sem nome"} -{" "}
                      {formatarHoras(item.horasTrabalho)}
                    </option>
                  ))
                )}
              </select>
            </CampoRotulado>

            <CampoRotulado label="Planejador">
              <input
                value={planejador}
                onChange={(e) => setPlanejador(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="Planejador"
              />
            </CampoRotulado>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ResumoCard titulo="Atividades" valor={String(atividadesTurno.length)} />
          <ResumoCard titulo="Planejadas" valor={String(totais.planejadas)} />
          <ResumoCard
            titulo="Prioridade A"
            valor={String(totais.prioridadeA)}
            destaque="text-red-500"
          />
          <ResumoCard
            titulo="Equipe prevista"
            valor={String(totais.equipePrevista)}
            destaque="text-teal-600"
          />
          <ResumoCard
            titulo="HH cadastrado"
            valor={`${formatarHoras(hhCadastradoTurno)} / ${formatarHoras(
              hhDisponivelTurno
            )}`}
            destaque={
              hhDisponivelTurno > 0 &&
              hhCadastradoTurno > hhDisponivelTurno
                ? "text-red-500"
                : "text-teal-600"
            }
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {atividadeEditandoId ? "Editar atividade" : "Nova atividade"}
                </h2>
                <p className="text-sm text-slate-500">
                  Cadastre o pacote que será acompanhado no campo.
                </p>
              </div>

              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                Previsão total: {totais.totalPrevisto}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[92px_minmax(150px,190px)_1fr]">
              <CampoRotulado label="Pri">
                <select
                  value={prioridade}
                  onChange={(e) =>
                    setPrioridade(e.target.value as PrioridadeAtividade)
                  }
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  <option>A</option>
                  <option>B</option>
                  <option>C</option>
                </select>
              </CampoRotulado>

              <CampoRotulado label="Disciplina">
                <select
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  <option value="">Selecionar</option>
                  {disciplinasCadastradas.map((item) => (
                    <option key={item.id} value={item.codigo || item.nome}>
                      {item.codigo ? `${item.codigo} - ${item.nome}` : item.nome}
                    </option>
                  ))}
                </select>
              </CampoRotulado>

              <CampoRotulado label="Atividade">
                <input
                  value={atividade}
                  onChange={(e) => setAtividade(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  placeholder="Ex.: Montagem de estrutura"
                />
              </CampoRotulado>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_120px_120px_150px]">
              <CampoRotulado label="Local">
                <input
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  placeholder="Frente / área"
                />
              </CampoRotulado>

              <CampoRotulado label="Responsável">
                <input
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  list="responsaveis-checkin"
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  placeholder="Responsável"
                />
                <datalist id="responsaveis-checkin">
                  {usuariosCadastrados.map((item) => (
                    <option key={item.id} value={item.nome} />
                  ))}
                </datalist>
              </CampoRotulado>

              <CampoRotulado label="Previsão">
                <input
                  value={previsto}
                  onChange={(e) => setPrevisto(e.target.value)}
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  placeholder="0"
                />
              </CampoRotulado>

              <CampoRotulado label="Unidade">
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                >
                  {unidades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </CampoRotulado>

              <CampoRotulado label="Tempo previsto">
                <input
                  value={tempoPrevistoHoras}
                  onChange={(e) => setTempoPrevistoHoras(e.target.value)}
                  type="number"
                  min="0"
                  step="0.5"
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  placeholder="Horas"
                />
              </CampoRotulado>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <h3 className="font-bold">Recursos da atividade</h3>
                <p className="text-sm text-slate-500">
                  Informe função e quantidade previstas para esta atividade.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_120px_160px]">
                <select
                  value={funcaoRecurso}
                  onChange={(e) => setFuncaoRecurso(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white p-3 text-sm"
                >
                  <option value="">Função</option>
                  {funcoesPrevistasCadastradas.map((item) => (
                    <option key={item.id} value={item.nome}>
                      {item.nome}
                    </option>
                  ))}
                </select>

                <input
                  value={quantidadeRecurso}
                  onChange={(e) => setQuantidadeRecurso(e.target.value)}
                  type="number"
                  min="0"
                  className="rounded-lg border border-slate-300 bg-white p-3 text-sm"
                  placeholder="Qtd"
                />

                <button
                  type="button"
                  onClick={adicionarRecursoDaAtividade}
                  className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-100"
                >
                  Adicionar recurso
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {recursosAtividade.length === 0 ? (
                  <span className="text-sm font-semibold text-slate-500">
                    Nenhum recurso vinculado à atividade.
                  </span>
                ) : (
                  recursosAtividade.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold"
                    >
                      {item.funcao}: {item.quantidade_prevista}
                      <button
                        type="button"
                        onClick={() => removerRecursoDaAtividade(item.id)}
                        className="text-xs font-bold text-red-600"
                      >
                        Remover
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
              {atividadeEditandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:text-slate-400"
                >
                  Cancelar edição
                </button>
              )}

              <button
                type="button"
                onClick={adicionarAtividade}
                disabled={salvando || turnoEncerrado}
                className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {turnoEncerrado
                  ? "Turno encerrado"
                  : salvando
                  ? "Salvando..."
                  : atividadeEditandoId
                  ? "Salvar atividade"
                  : "Adicionar atividade"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold">Recursos disponiveis</h2>
              <p className="text-sm text-slate-500">
                Quantitativo do turno selecionado, usado como origem do HH.
              </p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <select
                value={funcaoDisponivel}
                onChange={(e) => setFuncaoDisponivel(e.target.value)}
                className="min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="">Função</option>
                {funcoesPrevistasCadastradas.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome}
                  </option>
                ))}
              </select>

              <input
                value={quantidadeDisponivel}
                onChange={(e) => setQuantidadeDisponivel(e.target.value)}
                type="number"
                min="0"
                className="min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm"
                placeholder="Qtd"
              />

              <input
                value={cargaHorariaDisponivel}
                onChange={(e) => setCargaHorariaDisponivel(e.target.value)}
                type="number"
                min="0"
                step="0.5"
                className="min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm"
                placeholder="Horas/pess."
              />

              <button
                type="button"
                onClick={adicionarRecursoDisponivel}
                disabled={turnoEncerrado}
                className="min-w-0 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Adicionar
              </button>
            </div>

            <div className="space-y-2">
              {recursosDisponiveis.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
                  Nenhum recurso disponivel cadastrado no check-in deste turno.
                </p>
              ) : (
                recursosDisponiveis.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.funcao}</p>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {item.quantidade}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-teal-700">
                        HH disponivel: {formatarHoras(item.quantidade * item.cargaHoraria)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removerRecursoDisponivel(item)}
                        disabled={turnoEncerrado}
                        className="text-xs font-bold text-red-600 disabled:text-slate-400"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Atividades do turno</h2>
              <p className="text-sm text-slate-500">
                Lista filtrada pela obra ativa, data e turno selecionados.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {atividadesTurno.length} atividades
            </span>
          </div>

          <div className="overflow-x-auto">
            {carregando ? (
              <div className="m-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
                Carregando atividades...
              </div>
            ) : atividadesTurno.length === 0 ? (
              <div className="m-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
                Nenhuma atividade cadastrada para esta obra e turno.
              </div>
            ) : (
              <table className="w-full min-w-[1120px]">
                <thead className="bg-slate-50 text-sm">
                  <tr>
                    <th className="p-3 text-left">Pri</th>
                    <th className="p-3 text-left">Disciplina</th>
                    <th className="p-3 text-left">Atividade</th>
                    <th className="p-3 text-left">Local</th>
                    <th className="p-3 text-left">Responsável</th>
                    <th className="p-3 text-center">Previsão</th>
                    <th className="p-3 text-center">Tempo</th>
                    <th className="p-3 text-center">Equipe prevista</th>
                    <th className="p-3 text-center">Situação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {atividadesTurno.map((item) => {
                    const editando = atividadeEditandoId === item.id;
                    const excluindo = atividadeExcluindoId === item.id;

                    return (
                      <tr key={item.id} className="border-t text-sm hover:bg-slate-50">
                        <td className="p-3">
                          {editando ? (
                            <select
                              value={edicao.prioridade}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  prioridade: e.target
                                    .value as PrioridadeAtividade,
                                }))
                              }
                              className="w-16 rounded-lg border border-slate-300 p-2 text-sm"
                            >
                              <option>A</option>
                              <option>B</option>
                              <option>C</option>
                            </select>
                          ) : (
                            <PrioridadeBadge prioridade={item.prioridade} />
                          )}
                        </td>

                        <td className="p-3">
                          {editando ? (
                            <input
                              value={edicao.disciplina}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  disciplina: e.target.value,
                                }))
                              }
                              className="w-24 rounded-lg border border-slate-300 p-2 text-sm"
                            />
                          ) : (
                            item.disciplina
                          )}
                        </td>

                        <td className="p-3 font-medium">
                          {editando ? (
                            <input
                              value={edicao.atividade}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  atividade: e.target.value,
                                }))
                              }
                              className="w-full min-w-56 rounded-lg border border-slate-300 p-2 text-sm"
                            />
                          ) : (
                            <div>
                              <p>{item.atividade}</p>
                              {item.origem_atividade_id && (
                                <p className="text-xs font-semibold text-teal-700">
                                  Excedente programado
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          {editando ? (
                            <input
                              value={edicao.local}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  local: e.target.value,
                                }))
                              }
                              className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
                            />
                          ) : (
                            item.local
                          )}
                        </td>

                        <td className="p-3">
                          {editando ? (
                            <input
                              value={edicao.responsavel}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  responsavel: e.target.value,
                                }))
                              }
                              className="w-36 rounded-lg border border-slate-300 p-2 text-sm"
                            />
                          ) : (
                            item.responsavel
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {editando ? (
                            <div className="flex justify-center gap-2">
                              <input
                                value={edicao.previsto}
                                onChange={(e) =>
                                  setEdicao((atual) => ({
                                    ...atual,
                                    previsto: e.target.value,
                                  }))
                                }
                                type="number"
                                min="0"
                                className="w-24 rounded-lg border border-slate-300 p-2 text-center text-sm"
                              />
                              <select
                                value={edicao.unidade}
                                onChange={(e) =>
                                  setEdicao((atual) => ({
                                    ...atual,
                                    unidade: e.target.value,
                                  }))
                                }
                                className="w-24 rounded-lg border border-slate-300 p-2 text-sm"
                              >
                                {unidades.map((unidadeItem) => (
                                  <option key={unidadeItem} value={unidadeItem}>
                                    {unidadeItem}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            `${item.previsto} ${item.unidade || "un"}`
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {editando ? (
                            <input
                              value={edicao.tempoPrevistoHoras}
                              onChange={(e) =>
                                setEdicao((atual) => ({
                                  ...atual,
                                  tempoPrevistoHoras: e.target.value,
                                }))
                              }
                              type="number"
                              min="0"
                              step="0.5"
                              className="w-24 rounded-lg border border-slate-300 p-2 text-center text-sm"
                            />
                          ) : (
                            formatarHoras(Number(item.tempo_previsto_horas || 0))
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <div className="font-bold">
                            {somarRecursosAtividade(item.id)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatarRecursosAtividade(
                              recursosPorAtividade[item.id] ?? []
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <StatusBadge status={item.status} />
                        </td>

                        <td className="p-3 text-right">
                          {editando ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => salvarEdicao(item.id)}
                                disabled={salvando}
                                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:bg-slate-400"
                              >
                                Salvar
                              </button>

                              <button
                                type="button"
                                onClick={cancelarEdicao}
                                disabled={salvando}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:text-slate-400"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : excluindo ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => confirmarExclusao(item.id)}
                                disabled={salvando}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                              >
                                Confirmar
                              </button>

                              <button
                                type="button"
                                onClick={cancelarExclusao}
                                disabled={salvando}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:text-slate-400"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(item)}
                                disabled={turnoEncerrado}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:text-slate-400"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => pedirExclusao(item.id)}
                                disabled={turnoEncerrado}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:text-slate-400"
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Observações do turno</h2>

            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-slate-300 p-4 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Registre liberações, riscos, premissas e combinados do turno..."
            />
          </div>

          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-sm font-semibold text-slate-300">
              {obra} - Turno {turno || "-"}
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-tight">
              {atividadesTurno.length} atividades e {totais.equipePrevista}{" "}
              recursos previstos
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Revise prioridades, responsáveis e recursos antes de liberar a
              execução no campo.
            </p>

            <button
              type="button"
              onClick={publicarTurno}
              disabled={turnoEncerrado}
              className="mt-5 w-full rounded-xl bg-white px-6 py-4 text-base font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {turnoEncerrado ? "Turno encerrado" : "Publicar turno"}
            </button>
          </div>
        </section>
      </div>
    </DesktopLayout>
  );
}

function ResumoCard({
  titulo,
  valor,
  destaque = "text-slate-900",
}: {
  titulo: string;
  valor: string;
  destaque?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{titulo}</p>
      <h3 className={`text-3xl font-bold ${destaque}`}>{valor}</h3>
    </div>
  );
}

function ResumoCompacto({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{valor}</p>
    </div>
  );
}

function CampoRotulado({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: PrioridadeAtividade }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-bold ${
        prioridade === "A"
          ? "bg-red-100 text-red-700"
          : prioridade === "B"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {prioridade}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusNormalizado = status.toLowerCase();

  if (status === "Finalizada") {
    return (
      <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
        Finalizada
      </span>
    );
  }

  if (statusNormalizado.startsWith("restri")) {
    return (
      <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
        Restrição
      </span>
    );
  }

  if (status === "Parcial") {
    return (
      <span className="rounded-md bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">
        Parcial
      </span>
    );
  }

  return (
    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
      {status}
    </span>
  );
}

function calcularQuantidadeProporcional(
  quantidadeTotal: number,
  horasParte: number,
  horasTotal: number
) {
  if (horasTotal <= 0) {
    return quantidadeTotal;
  }

  return Number(((quantidadeTotal * horasParte) / horasTotal).toFixed(2));
}

function formatarRecursosAtividade(recursos: AtividadeRecurso[]) {
  if (recursos.length === 0) {
    return "Sem recursos";
  }

  return recursos
    .map((item) => `${item.funcao} ${Number(item.quantidade_prevista || 0)}`)
    .join(" | ");
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
}

function formatarData(dataTurno: string) {
  const [ano, mes, dia] = dataTurno.split("-");

  if (!ano || !mes || !dia) {
    return dataTurno;
  }

  return `${dia}/${mes}/${ano}`;
}
