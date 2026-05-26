"use client";

import { useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  definirDadosObra,
  notificarCadastroBaseAtualizado,
  obterDadosObra,
  obterObraAtiva,
  obterObraAtivaId,
  removerDadosObra,
  salvarCadastroBase,
  type CriticidadeObra,
  type DisciplinaCadastrada,
  type FuncaoPrevistaCadastrada,
  type NivelAcesso,
  type ObraCadastrada,
  type SituacaoObra,
  type TurnoCadastrado,
  type UsuarioCadastrado,
} from "../../lib/cadastro-base";

const situacoes: SituacaoObra[] = [
  "Planejamento",
  "Mobilizacao",
  "Execucao",
  "Pausada",
];

const criticidades: CriticidadeObra[] = ["Baixa", "Media", "Alta"];
const niveisAcesso: NivelAcesso[] = ["Planejador", "Usuario", "Visitante"];
type ModoObra = "criando" | "editando" | "visualizando";

const dataHoje = () => new Date().toISOString().slice(0, 10);
let sequenciaIdTemporario = 0;

function gerarIdTemporario() {
  sequenciaIdTemporario += 1;
  return Date.now() + sequenciaIdTemporario;
}

export default function CadastroObraPage() {
  const [cadastroCarregado, setCadastroCarregado] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cliente, setCliente] = useState("");
  const [contrato, setContrato] = useState("");
  const [inicio, setInicio] = useState(dataHoje);
  const [termino, setTermino] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [situacao, setSituacao] = useState<SituacaoObra>("Planejamento");
  const [criticidade, setCriticidade] = useState<CriticidadeObra>("Media");
  const [escopo, setEscopo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [obras, setObras] = useState<ObraCadastrada[]>([]);
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const [obraEditandoId, setObraEditandoId] = useState<number | null>(null);
  const [obraVisualizandoId, setObraVisualizandoId] = useState<number | null>(
    null
  );

  const [usuarioNome, setUsuarioNome] = useState("");
  const [usuarioFuncao, setUsuarioFuncao] = useState("");
  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [usuarioNivel, setUsuarioNivel] = useState<NivelAcesso>("Usuario");
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([]);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState<number | null>(
    null
  );

  const [disciplinaCodigo, setDisciplinaCodigo] = useState("");
  const [disciplinaNome, setDisciplinaNome] = useState("");
  const [disciplinas, setDisciplinas] = useState<DisciplinaCadastrada[]>([]);
  const [disciplinaEditandoId, setDisciplinaEditandoId] = useState<
    number | null
  >(null);

  const [funcaoPrevistaNome, setFuncaoPrevistaNome] = useState("");
  const [funcoesPrevistas, setFuncoesPrevistas] = useState<
    FuncaoPrevistaCadastrada[]
  >([]);
  const [funcaoEditandoId, setFuncaoEditandoId] = useState<number | null>(null);

  const [turnoNome, setTurnoNome] = useState("");
  const [turnoHoraInicio, setTurnoHoraInicio] = useState("");
  const [turnoHoraFim, setTurnoHoraFim] = useState("");
  const [turnoDescontaRefeicao, setTurnoDescontaRefeicao] = useState(false);
  const [turnos, setTurnos] = useState<TurnoCadastrado[]>([]);
  const [turnoEditandoId, setTurnoEditandoId] = useState<number | null>(null);

  const [mensagem, setMensagem] = useState("");
  const [modoObra, setModoObra] = useState<ModoObra>("criando");
  const obraSelecionada = useMemo(
    () => obras.find((obra) => obra.id === obraAtivaId) ?? null,
    [obraAtivaId, obras]
  );
  const bloqueiaFormularioObra = modoObra === "visualizando";
  const statusCadastro = bloqueiaFormularioObra
    ? "Cadastrado"
    : modoObra === "editando"
    ? "Em edição"
    : "Cadastro em preparo";
  const classeCampoBloqueavel = bloqueiaFormularioObra
    ? "bg-slate-100 text-slate-500"
    : "";
  const classeBotaoPrimario = bloqueiaFormularioObra
    ? "cursor-not-allowed bg-slate-300 text-slate-500"
    : "bg-teal-600 text-white hover:bg-teal-700";
  const obraEmTrabalhoId = obraEditandoId ?? obraAtivaId;
  const podeEditarDadosObra = Boolean(obraEmTrabalhoId) && !bloqueiaFormularioObra;
  const bloqueiaTurnos = !podeEditarDadosObra;
  const classeCampoTurno = bloqueiaTurnos ? classeCampoBloqueavel : "";
  const classeBotaoTurno = podeEditarDadosObra && !bloqueiaTurnos
    ? "bg-teal-600 text-white hover:bg-teal-700"
    : "cursor-not-allowed bg-slate-300 text-slate-500";

  const horasTurnoAtual = calcularHorasTrabalho(
    turnoHoraInicio,
    turnoHoraFim,
    turnoDescontaRefeicao
  );
  const resumo = useMemo(() => {
    const prazoDias = calcularPrazoDias(inicio, termino);
    const orcamentoNumero = Number(orcamento || 0);

    return {
      prazoDias,
      orcamentoFormatado:
        orcamentoNumero > 0
          ? orcamentoNumero.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "Não informado",
    };
  }, [inicio, orcamento, termino]);

  function preencherFormularioObra(obra: ObraCadastrada) {
    setLogoUrl(obra.logoUrl);
    setNome(obra.nome);
    setCodigo(obra.codigo);
    setCliente(obra.cliente);
    setContrato(obra.contrato);
    setInicio(obra.inicio);
    setTermino(obra.termino);
    setOrcamento(obra.orcamento);
    setSituacao(obra.situacao);
    setCriticidade(obra.criticidade);
    setEscopo(obra.escopo);
    setObservacoes(obra.observacoes);
  }

  function limparObra() {
    setNome("");
    setCodigo("");
    setCliente("");
    setContrato("");
    setInicio(dataHoje());
    setTermino("");
    setOrcamento("");
    setSituacao("Planejamento");
    setCriticidade("Media");
    setEscopo("");
    setObservacoes("");
    setLogoUrl("");
    setObraEditandoId(null);
    setObraVisualizandoId(null);
  }

  useEffect(() => {
    function carregarCadastro() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const ativoId = obterObraAtivaId(cadastro);
      const dadosObra = obterDadosObra(cadastro, ativoId);

      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObras(cadastro.obras);
      setObraAtivaId(ativoId);

      if (obraAtiva) {
        preencherFormularioObra(obraAtiva);
        setObraVisualizandoId(obraAtiva.id);
        setObraEditandoId(null);
        setModoObra("visualizando");
      } else {
        limparObra();
        setModoObra("criando");
      }

      setUsuarios(dadosObra.usuarios);
      setDisciplinas(dadosObra.disciplinas);
      setFuncoesPrevistas(dadosObra.funcoesPrevistas);
      setTurnos(dadosObra.turnos);
      setCadastroCarregado(true);
    }

    queueMicrotask(carregarCadastro);
    window.addEventListener(cadastroBaseEvento, carregarCadastro);
    window.addEventListener("storage", carregarCadastro);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarCadastro);
      window.removeEventListener("storage", carregarCadastro);
    };
  }, []);

  useEffect(() => {
    if (!cadastroCarregado) {
      return;
    }

    const obraDestinoId = obraEmTrabalhoId;

    if (!obraDestinoId || modoObra === "criando") {
      return;
    }

    const cadastroAtual = carregarCadastroBase();

    salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          logoUrl,
          obras,
          obraAtivaId: obraDestinoId,
        },
        obraDestinoId,
        {
          usuarios,
          disciplinas,
          funcoesPrevistas,
          turnos,
        }
      )
    );
  }, [
    cadastroCarregado,
    disciplinas,
    funcoesPrevistas,
    logoUrl,
    modoObra,
    obraAtivaId,
    obraEmTrabalhoId,
    obras,
    turnos,
    usuarios,
  ]);

  function carregarLogo(arquivo: File | undefined) {
    if (!arquivo) {
      return;
    }

    const leitor = new FileReader();

    leitor.onload = () => {
      if (typeof leitor.result === "string") {
        setLogoUrl(leitor.result);
        setMensagem("Logo carregado no menu lateral.");
      }
    };

    leitor.readAsDataURL(arquivo);
  }

  function salvarObra() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const editando = modoObra === "editando" && obraEditandoId !== null;
    const obraId = obraEditandoId ?? obraAtivaId ?? gerarIdTemporario();
    const obra: ObraCadastrada = {
      id: obraId,
      logoUrl,
      nome,
      codigo,
      cliente,
      contrato,
      inicio,
      termino,
      orcamento,
      situacao,
      criticidade,
      escopo,
      observacoes,
    };

    const obraJaExiste = obras.some((item) => item.id === obra.id);
    const novasObras =
      editando || obraJaExiste
        ? obras.map((item) => (item.id === obra.id ? obra : item))
        : [obra, ...obras];
    const dadosDaObra = {
      usuarios,
      disciplinas,
      funcoesPrevistas,
      turnos,
    };

    const cadastroAtual = carregarCadastroBase();
    const obraAtivaAposSalvar = obra.id;

    salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          logoUrl,
          obras: novasObras,
          obraAtivaId: obraAtivaAposSalvar,
        },
        obra.id,
        dadosDaObra
      )
    );
    setObras(novasObras);
    setObraAtivaId(obraAtivaAposSalvar);
    preencherFormularioObra(obra);
    setObraVisualizandoId(obra.id);
    setObraEditandoId(null);
    setModoObra("visualizando");
    setMensagem(editando ? "Obra atualizada." : "Obra cadastrada.");
    queueMicrotask(notificarCadastroBaseAtualizado);
  }

  function cadastrarNovaObra() {
    const novoId = gerarIdTemporario();

    limparObra();
    limparUsuario();
    limparTurno();
    limparDisciplina();
    limparFuncaoPrevista();
    setObraAtivaId(novoId);
    setObraEditandoId(novoId);
    setObraVisualizandoId(null);
    setModoObra("criando");
    setUsuarios([]);
    setDisciplinas([]);
    setFuncoesPrevistas([]);
    setTurnos([]);
    setMensagem("Formulario pronto para nova obra.");
  }

  function editarObra(obra: ObraCadastrada) {
    const cadastroAtual = carregarCadastroBase();
    const dadosObra = obterDadosObra(cadastroAtual, obra.id);

    preencherFormularioObra(obra);
    setObraAtivaId(obra.id);
    setUsuarios(dadosObra.usuarios);
    setDisciplinas(dadosObra.disciplinas);
    setFuncoesPrevistas(dadosObra.funcoesPrevistas);
    setTurnos(dadosObra.turnos);
    setObraEditandoId(obra.id);
    setObraVisualizandoId(null);
    setModoObra("editando");
    salvarCadastroBase({ ...cadastroAtual, obraAtivaId: obra.id });
  }

  function editarObraSelecionada() {
    if (!obraSelecionada) {
      return;
    }

    editarObra(obraSelecionada);
  }

  function cancelarEdicaoObra() {
    const cadastroAtual = carregarCadastroBase();
    const idParaRestaurar =
      modoObra === "editando"
        ? obraEditandoId ?? obraAtivaId
        : obterObraAtivaId(cadastroAtual);
    const obraParaRestaurar =
      cadastroAtual.obras.find((obra) => obra.id === idParaRestaurar) ??
      cadastroAtual.obras[0] ??
      null;

    limparUsuario();
    limparTurno();
    limparDisciplina();
    limparFuncaoPrevista();

    if (!obraParaRestaurar) {
      limparObra();
      setObraAtivaId(null);
      setUsuarios([]);
      setDisciplinas([]);
      setFuncoesPrevistas([]);
      setTurnos([]);
      setModoObra("criando");
      setMensagem("Edição cancelada.");
      return;
    }

    const dadosObra = obterDadosObra(cadastroAtual, obraParaRestaurar.id);

    preencherFormularioObra(obraParaRestaurar);
    setObraAtivaId(obraParaRestaurar.id);
    setObraEditandoId(null);
    setObraVisualizandoId(obraParaRestaurar.id);
    setModoObra("visualizando");
    setUsuarios(dadosObra.usuarios);
    setDisciplinas(dadosObra.disciplinas);
    setFuncoesPrevistas(dadosObra.funcoesPrevistas);
    setTurnos(dadosObra.turnos);
    salvarCadastroBase({ ...cadastroAtual, obraAtivaId: obraParaRestaurar.id });
    setMensagem("Edição cancelada.");
  }

  function tornarObraAtualAtivaParaEdicao() {
    const id = obraEmTrabalhoId;

    if (!id) {
      return;
    }

    setObraAtivaId(id);
    setObraEditandoId(id);
    setObraVisualizandoId(null);
    setModoObra(obras.some((obra) => obra.id === id) ? "editando" : "criando");

    if (obras.some((obra) => obra.id === id)) {
      salvarCadastroBase({ ...carregarCadastroBase(), obraAtivaId: id });
    }
  }

  function excluirObra(id: number) {
    const novasObras = obras.filter((item) => item.id !== id);
    const novoAtivoId =
      obraAtivaId === id ? novasObras[0]?.id ?? null : obraAtivaId;
    const cadastroAtual = carregarCadastroBase();

    salvarCadastroBase({
      ...cadastroAtual,
      obras: novasObras,
      obraAtivaId: novoAtivoId,
      dadosPorObra: removerDadosObra(cadastroAtual.dadosPorObra, id),
    });
    setObras(novasObras);
    setObraAtivaId(novoAtivoId);
    if (obraEditandoId === id) {
      limparObra();
    }
    queueMicrotask(notificarCadastroBaseAtualizado);
    setMensagem("Obra excluída.");
  }

  function salvarUsuario() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const usuario: UsuarioCadastrado = {
      id: usuarioEditandoId ?? gerarIdTemporario(),
      nome: usuarioNome,
      funcao: usuarioFuncao,
      email: usuarioEmail,
      nivelAcesso: usuarioNivel,
    };

    setUsuarios((atuais) =>
      usuarioEditandoId
        ? atuais.map((item) => (item.id === usuarioEditandoId ? usuario : item))
        : [...atuais, usuario]
    );
    limparUsuario();
    setMensagem(usuarioEditandoId ? "Usuário atualizado." : "Usuário cadastrado.");
  }

  function limparUsuario() {
    setUsuarioNome("");
    setUsuarioFuncao("");
    setUsuarioEmail("");
    setUsuarioNivel("Usuario");
    setUsuarioEditandoId(null);
  }

  function editarUsuario(usuario: UsuarioCadastrado) {
    tornarObraAtualAtivaParaEdicao();
    setObraVisualizandoId(null);
    setUsuarioNome(usuario.nome);
    setUsuarioFuncao(usuario.funcao);
    setUsuarioEmail(usuario.email);
    setUsuarioNivel(usuario.nivelAcesso);
    setUsuarioEditandoId(usuario.id);
  }

  function excluirUsuario(id: number) {
    if (bloqueiaFormularioObra) {
      return;
    }

    setUsuarios((atuais) => atuais.filter((item) => item.id !== id));
    if (usuarioEditandoId === id) {
      limparUsuario();
    }
    setMensagem("Usuário excluído.");
  }

  function salvarTurno() {
    const obraDestinoId = obraEmTrabalhoId;

    if (!obraDestinoId || bloqueiaTurnos) {
      return;
    }

    const turno: TurnoCadastrado = {
      id: turnoEditandoId ?? gerarIdTemporario(),
      nome: turnoNome,
      horaInicio: turnoHoraInicio,
      horaFim: turnoHoraFim,
      descontaRefeicao: turnoDescontaRefeicao,
      horasTrabalho: horasTurnoAtual,
    };

    const novosTurnos = turnoEditandoId
      ? turnos.map((item) => (item.id === turnoEditandoId ? turno : item))
      : [...turnos, turno];
    const cadastroAtual = carregarCadastroBase();

    salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          obraAtivaId: obraDestinoId,
          turnoAtivoPorObra: {
            ...cadastroAtual.turnoAtivoPorObra,
            [String(obraDestinoId)]: turno.nome,
          },
        },
        obraDestinoId,
        {
          usuarios,
          disciplinas,
          funcoesPrevistas,
          turnos: novosTurnos,
        }
      )
    );

    setTurnos(novosTurnos);
    limparTurno();
    setObraAtivaId(obraDestinoId);
    setMensagem(turnoEditandoId ? "Turno atualizado." : "Turno cadastrado.");
    queueMicrotask(notificarCadastroBaseAtualizado);
  }

  function limparTurno() {
    setTurnoNome("");
    setTurnoHoraInicio("");
    setTurnoHoraFim("");
    setTurnoDescontaRefeicao(false);
    setTurnoEditandoId(null);
  }

  function editarTurno(turno: TurnoCadastrado) {
    if (!obraEmTrabalhoId) {
      return;
    }

    tornarObraAtualAtivaParaEdicao();
    setTurnoNome(turno.nome);
    setTurnoHoraInicio(turno.horaInicio);
    setTurnoHoraFim(turno.horaFim);
    setTurnoDescontaRefeicao(turno.descontaRefeicao);
    setTurnoEditandoId(turno.id);
  }

  function excluirTurno(id: number) {
    const obraDestinoId = obraEmTrabalhoId;

    if (!obraDestinoId || bloqueiaTurnos) {
      return;
    }

    const novosTurnos = turnos.filter((item) => item.id !== id);
    const cadastroAtual = carregarCadastroBase();
    const turnoAtivoAtual = cadastroAtual.turnoAtivoPorObra[String(obraDestinoId)];
    const turnoExcluido = turnos.find((item) => item.id === id);
    const proximoTurnoAtivo =
      turnoAtivoAtual === turnoExcluido?.nome
        ? novosTurnos[0]?.nome ?? ""
        : turnoAtivoAtual ?? "";

    salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          obraAtivaId: obraDestinoId,
          turnoAtivoPorObra: {
            ...cadastroAtual.turnoAtivoPorObra,
            [String(obraDestinoId)]: proximoTurnoAtivo,
          },
        },
        obraDestinoId,
        {
          usuarios,
          disciplinas,
          funcoesPrevistas,
          turnos: novosTurnos,
        }
      )
    );

    setTurnos(novosTurnos);
    setObraAtivaId(obraDestinoId);
    if (turnoEditandoId === id) {
      limparTurno();
    }
    setMensagem("Turno excluído.");
    queueMicrotask(notificarCadastroBaseAtualizado);
  }

  function alterarNivelAcesso(id: number, nivelAcesso: NivelAcesso) {
    if (bloqueiaFormularioObra) {
      return;
    }

    setUsuarios((atuais) =>
      atuais.map((usuario) =>
        usuario.id === id ? { ...usuario, nivelAcesso } : usuario
      )
    );
  }

  function salvarDisciplina() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const disciplina: DisciplinaCadastrada = {
      id: disciplinaEditandoId ?? gerarIdTemporario(),
      codigo: disciplinaCodigo.toUpperCase(),
      nome: disciplinaNome,
    };

    setDisciplinas((atuais) =>
      disciplinaEditandoId
        ? atuais.map((item) =>
            item.id === disciplinaEditandoId ? disciplina : item
          )
        : [...atuais, disciplina]
    );
    limparDisciplina();
    setMensagem(
      disciplinaEditandoId ? "Disciplina atualizada." : "Disciplina cadastrada."
    );
  }

  function limparDisciplina() {
    setDisciplinaCodigo("");
    setDisciplinaNome("");
    setDisciplinaEditandoId(null);
  }

  function editarDisciplina(disciplina: DisciplinaCadastrada) {
    tornarObraAtualAtivaParaEdicao();
    setObraVisualizandoId(null);
    setDisciplinaCodigo(disciplina.codigo);
    setDisciplinaNome(disciplina.nome);
    setDisciplinaEditandoId(disciplina.id);
  }

  function excluirDisciplina(id: number) {
    if (bloqueiaFormularioObra) {
      return;
    }

    setDisciplinas((atuais) => atuais.filter((item) => item.id !== id));
    if (disciplinaEditandoId === id) {
      limparDisciplina();
    }
    setMensagem("Disciplina excluída.");
  }

  function salvarFuncaoPrevista() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const funcao: FuncaoPrevistaCadastrada = {
      id: funcaoEditandoId ?? gerarIdTemporario(),
      nome: funcaoPrevistaNome,
      quantidade: 0,
      cargaHoraria: 0,
    };

    setFuncoesPrevistas((atuais) =>
      funcaoEditandoId
        ? atuais.map((item) => (item.id === funcaoEditandoId ? funcao : item))
        : [...atuais, funcao]
    );
    limparFuncaoPrevista();
    setMensagem(
      funcaoEditandoId
        ? "Função prevista atualizada."
        : "Função prevista cadastrada."
    );
  }

  function limparFuncaoPrevista() {
    setFuncaoPrevistaNome("");
    setFuncaoEditandoId(null);
  }

  function editarFuncaoPrevista(funcao: FuncaoPrevistaCadastrada) {
    tornarObraAtualAtivaParaEdicao();
    setObraVisualizandoId(null);
    setFuncaoPrevistaNome(funcao.nome);
    setFuncaoEditandoId(funcao.id);
  }

  function excluirFuncaoPrevista(id: number) {
    if (bloqueiaFormularioObra) {
      return;
    }

    setFuncoesPrevistas((atuais) => atuais.filter((item) => item.id !== id));
    if (funcaoEditandoId === id) {
      limparFuncaoPrevista();
    }
    setMensagem("Função prevista excluída.");
  }

  return (
    <DesktopLayout
      titulo="Cadastro da Obra"
      subtitulo="Dados base para planejamento, check-in e acompanhamento"
      status={statusCadastro}
      logoUrl={logoUrl || undefined}
    >
      <div className="space-y-4">
        {mensagem && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {mensagem}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <label className="block w-full max-w-md">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Obra ativa
            </span>
            <select
              value={obraAtivaId ?? ""}
              onChange={(e) => {
                const novoId = e.target.value ? Number(e.target.value) : null;
                const cadastro = carregarCadastroBase();
                const obraSelecionada =
                  cadastro.obras.find((obra) => obra.id === novoId) ?? null;
                const dadosObra = obterDadosObra(cadastro, novoId);

                setObraAtivaId(novoId);
                setLogoUrl(obraSelecionada?.logoUrl || cadastro.logoUrl);
                if (obraSelecionada) {
                  preencherFormularioObra(obraSelecionada);
                  setObraVisualizandoId(obraSelecionada.id);
                  setObraEditandoId(null);
                  setModoObra("visualizando");
                } else {
                  limparObra();
                  setModoObra("criando");
                }
                setUsuarios(dadosObra.usuarios);
                setDisciplinas(dadosObra.disciplinas);
                setFuncoesPrevistas(dadosObra.funcoesPrevistas);
                setTurnos(dadosObra.turnos);
                salvarCadastroBase({ ...cadastro, obraAtivaId: novoId });
                queueMicrotask(notificarCadastroBaseAtualizado);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white p-3"
            >
              <option value="">
                {obras.length === 0 ? "Cadastre uma obra" : "Selecionar obra"}
              </option>

              {obras.map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.nome || obra.codigo || "Obra sem nome"}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={cadastrarNovaObra}
            className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            Cadastrar nova obra
          </button>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <SecaoTitulo
                titulo="Informações gerais"
                descricao="Identifique a obra e o contrato que será acompanhado."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <CampoRotulado label="Nome da obra" className="md:col-span-3">
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                    placeholder="Ex.: Laminação L1"
                  />
                </CampoRotulado>

                <CampoRotulado label="Código" className="md:col-span-1">
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                    placeholder="OBR-001"
                  />
                </CampoRotulado>

                <CampoRotulado label="Situação" className="md:col-span-2">
                  <select
                    value={situacao}
                    onChange={(e) =>
                      setSituacao(e.target.value as SituacaoObra)
                    }
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                  >
                    {situacoes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </CampoRotulado>

                <CampoRotulado label="Cliente" className="md:col-span-3">
                  <input
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                    placeholder="Empresa contratante"
                  />
                </CampoRotulado>

                <CampoRotulado label="Contrato" className="md:col-span-2">
                  <input
                    value={contrato}
                    onChange={(e) => setContrato(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                    placeholder="Número"
                  />
                </CampoRotulado>

                <CampoRotulado label="Criticidade" className="md:col-span-1">
                  <select
                    value={criticidade}
                    onChange={(e) =>
                      setCriticidade(e.target.value as CriticidadeObra)
                    }
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                  >
                    {criticidades.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </CampoRotulado>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <SecaoTitulo
                titulo="Planejamento inicial"
                descricao="Defina prazo, orçamento e escopo resumido."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <CampoRotulado label="Início previsto" className="md:col-span-2">
                  <input
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    type="date"
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                  />
                </CampoRotulado>

                <CampoRotulado label="Término previsto" className="md:col-span-2">
                  <input
                    value={termino}
                    onChange={(e) => setTermino(e.target.value)}
                    type="date"
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                  />
                </CampoRotulado>

                <CampoRotulado label="Orçamento" className="md:col-span-1">
                  <input
                    value={orcamento}
                    onChange={(e) => setOrcamento(e.target.value)}
                    type="number"
                    min="0"
                    disabled={bloqueiaFormularioObra}
                    className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                    placeholder="R$"
                  />
                </CampoRotulado>

                <CampoRotulado label="Prazo" className="md:col-span-1">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-bold text-slate-700">
                    {resumo.prazoDias
                      ? `${resumo.prazoDias} dias`
                      : "A definir"}
                  </div>
                </CampoRotulado>

                <CampoRotulado label="Escopo resumido" className="md:col-span-6">
                  <textarea
                    value={escopo}
                    onChange={(e) => setEscopo(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`min-h-[110px] w-full rounded-lg border border-slate-300 p-4 ${classeCampoBloqueavel}`}
                    placeholder="Descreva o escopo principal da obra..."
                  />
                </CampoRotulado>

                <CampoRotulado label="Observações" className="md:col-span-6">
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    disabled={bloqueiaFormularioObra}
                    className={`min-h-[90px] w-full rounded-lg border border-slate-300 p-4 ${classeCampoBloqueavel}`}
                    placeholder="Riscos, premissas, restrições iniciais ou informações de mobilização..."
                  />
                </CampoRotulado>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Resumo da obra</h2>
              <p className="mt-1 text-sm text-slate-500">
                Conferência antes de salvar.
              </p>

              <div className="mt-4 space-y-3">
                <ResumoLinha label="Obra" valor={valorOuTraco(nome)} />
                <ResumoLinha label="Cliente" valor={valorOuTraco(cliente)} />
                <ResumoLinha
                  label="Orçamento"
                  valor={resumo.orcamentoFormatado}
                />
                <ResumoLinha
                  label="Situação"
                  valor={situacao}
                />
              </div>

              <button
                type="button"
                onClick={salvarObra}
                disabled={bloqueiaFormularioObra}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${classeBotaoPrimario}`}
              >
                {obraEditandoId ? "Salvar edição" : "Salvar obra"}
              </button>

              {bloqueiaFormularioObra && obraSelecionada && (
                <button
                  type="button"
                  onClick={editarObraSelecionada}
                  className="mt-3 w-full rounded-xl border border-teal-600 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-50"
                >
                  Editar obra
                </button>
              )}

              {obraEditandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicaoObra}
                  className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancelar edição
                </button>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Logo da empresa</h2>

                {logoUrl && !bloqueiaFormularioObra && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div
                  className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 ${
                    logoUrl ? "min-h-12 p-2" : "h-14"
                  }`}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Prévia do logo"
                      className="max-h-14 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">
                      Prévia do logo
                    </span>
                  )}
                </div>

                <input
                  onChange={(e) => carregarLogo(e.target.files?.[0])}
                  type="file"
                  accept="image/*"
                  disabled={bloqueiaFormularioObra}
                  className={`w-full rounded-lg border border-slate-300 p-2 text-xs ${classeCampoBloqueavel}`}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
              <p className="text-sm font-semibold text-slate-300">
                Próximo passo
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Publicar turnos e atividades
              </h2>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Depois do cadastro, use o check-in para montar o turno da obra e
                acompanhar recursos, frentes e restrições.
              </p>
            </section>
          </aside>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <SecaoTitulo
              titulo="Usuários"
              descricao="Cadastre quem usará o sistema e defina o nível de acesso."
            />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {usuarios.length} usuários
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
            <CampoRotulado label="Nome" className="lg:col-span-2">
              <input
                value={usuarioNome}
                onChange={(e) => setUsuarioNome(e.target.value)}
                disabled={bloqueiaFormularioObra}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                placeholder="Nome"
              />
            </CampoRotulado>

            <CampoRotulado label="Função" className="lg:col-span-1">
              <input
                value={usuarioFuncao}
                onChange={(e) => setUsuarioFuncao(e.target.value)}
                disabled={bloqueiaFormularioObra}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                placeholder="Função"
              />
            </CampoRotulado>

            <CampoRotulado label="E-mail" className="lg:col-span-2">
              <input
                value={usuarioEmail}
                onChange={(e) => setUsuarioEmail(e.target.value)}
                type="email"
                disabled={bloqueiaFormularioObra}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                placeholder="email@empresa.com"
              />
            </CampoRotulado>

            <CampoRotulado label="Nível" className="lg:col-span-1">
              <select
                value={usuarioNivel}
                onChange={(e) => setUsuarioNivel(e.target.value as NivelAcesso)}
                disabled={bloqueiaFormularioObra}
                className={`w-full rounded-lg border border-slate-300 bg-white p-3 ${classeCampoBloqueavel}`}
              >
                {niveisAcesso.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {nivel === "Usuario" ? "Usuário" : nivel}
                  </option>
                ))}
              </select>
            </CampoRotulado>

            <div className="flex justify-end lg:col-span-6">
              <button
                type="button"
                onClick={salvarUsuario}
                disabled={bloqueiaFormularioObra}
                className={`rounded-xl px-6 py-3 text-sm font-bold transition ${classeBotaoPrimario}`}
              >
                {usuarioEditandoId ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>
          </div>

          {usuarioEditandoId && (
            <button
              type="button"
              onClick={limparUsuario}
              className="mb-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar edição de usuário
            </button>
          )}

          {usuarios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Função</th>
                  <th className="p-3 text-left">E-mail</th>
                  <th className="p-3 text-left">Permissão</th>
                  <th className="p-3 text-center">Nível de acesso</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-t text-sm hover:bg-slate-50">
                    <td className="p-3 font-semibold">
                      {valorOuTraco(usuario.nome)}
                    </td>
                    <td className="p-3">{valorOuTraco(usuario.funcao)}</td>
                    <td className="p-3">{valorOuTraco(usuario.email)}</td>
                    <td className="p-3 text-slate-600">
                      {permissaoPorNivel(usuario.nivelAcesso)}
                    </td>
                    <td className="p-3 text-center">
                      <select
                        value={usuario.nivelAcesso}
                        onChange={(e) =>
                          alterarNivelAcesso(
                            usuario.id,
                            e.target.value as NivelAcesso
                          )
                        }
                        disabled={bloqueiaFormularioObra}
                        className={`rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold ${classeCampoBloqueavel}`}
                      >
                        {niveisAcesso.map((nivel) => (
                          <option key={nivel} value={nivel}>
                            {nivel === "Usuario" ? "Usuário" : nivel}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <AcoesLinha
                        onEditar={() => editarUsuario(usuario)}
                        onExcluir={() => excluirUsuario(usuario.id)}
                        desabilitado={bloqueiaFormularioObra}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <SecaoTitulo
              titulo="Turnos"
              descricao="Cadastre horários e calcule a carga de trabalho líquida."
            />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {turnos.length} turnos
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(160px,1fr)_140px_140px_190px_120px_140px]">
            <CampoRotulado label="Nome do turno">
              <input
                value={turnoNome}
                onChange={(e) => setTurnoNome(e.target.value)}
                disabled={!obraAtivaId || bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
                placeholder="Ex.: Dia"
              />
            </CampoRotulado>

            <CampoRotulado label="Início">
              <input
                value={turnoHoraInicio}
                onChange={(e) => setTurnoHoraInicio(e.target.value)}
                type="time"
                disabled={!obraAtivaId || bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
              />
            </CampoRotulado>

            <CampoRotulado label="Fim">
              <input
                value={turnoHoraFim}
                onChange={(e) => setTurnoHoraFim(e.target.value)}
                type="time"
                disabled={!obraAtivaId || bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
              />
            </CampoRotulado>

            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-slate-700">
              <input
                checked={turnoDescontaRefeicao}
                onChange={(e) => setTurnoDescontaRefeicao(e.target.checked)}
                type="checkbox"
                disabled={!obraAtivaId || bloqueiaTurnos}
                className="mb-0.5 h-4 w-4"
              />
              Descontar refeição
            </label>

            <CampoRotulado label="Horas">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center font-bold text-slate-700">
                {formatarHoras(horasTurnoAtual)}
              </div>
            </CampoRotulado>

            <div className="flex items-end">
              <button
                type="button"
                onClick={salvarTurno}
                disabled={!podeEditarDadosObra || bloqueiaTurnos}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${classeBotaoTurno}`}
              >
                {turnoEditandoId ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>
          </div>

          {turnoEditandoId && (
            <button
              type="button"
              onClick={limparTurno}
              className="mb-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar edição de turno
            </button>
          )}

          {turnos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
              Nenhum turno cadastrado ainda.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Turno</th>
                  <th className="p-3 text-center">Início</th>
                  <th className="p-3 text-center">Fim</th>
                  <th className="p-3 text-center">Refeição</th>
                  <th className="p-3 text-center">Horas de trabalho</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {turnos.map((turno) => (
                  <tr key={turno.id} className="border-t text-sm hover:bg-slate-50">
                    <td className="p-3 font-semibold">
                      {valorOuTraco(turno.nome)}
                    </td>
                    <td className="p-3 text-center">
                      {valorOuTraco(turno.horaInicio)}
                    </td>
                    <td className="p-3 text-center">
                      {valorOuTraco(turno.horaFim)}
                    </td>
                    <td className="p-3 text-center">
                      {turno.descontaRefeicao ? "Desconta 1h" : "Não desconta"}
                    </td>
                    <td className="p-3 text-center font-bold text-teal-700">
                      {formatarHoras(turno.horasTrabalho)}
                    </td>
                    <td className="p-3 text-right">
                      <AcoesLinha
                        onEditar={() => editarTurno(turno)}
                        onExcluir={() => excluirTurno(turno.id)}
                        desabilitado={bloqueiaFormularioObra}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <SecaoTitulo
                titulo="Disciplinas"
                descricao="Cadastre as disciplinas usadas no planejamento."
              />

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {disciplinas.length} disciplinas
              </span>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr_140px]">
              <input
                value={disciplinaCodigo}
                onChange={(e) => setDisciplinaCodigo(e.target.value)}
                disabled={bloqueiaFormularioObra}
                className={`rounded-lg border border-slate-300 p-3 uppercase ${classeCampoBloqueavel}`}
                placeholder="MEC"
              />

              <input
                value={disciplinaNome}
                onChange={(e) => setDisciplinaNome(e.target.value)}
                disabled={bloqueiaFormularioObra}
                className={`rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                placeholder="Nome da disciplina"
              />

              <button
                type="button"
                onClick={salvarDisciplina}
                disabled={bloqueiaFormularioObra}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${classeBotaoPrimario}`}
              >
                {disciplinaEditandoId ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>

            {disciplinaEditandoId && (
              <button
                type="button"
                onClick={limparDisciplina}
                className="mb-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar edição de disciplina
              </button>
            )}

            {disciplinas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
                Nenhuma disciplina cadastrada ainda.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Código</th>
                    <th className="p-3 text-left">Disciplina</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {disciplinas.map((disciplina) => (
                    <tr
                      key={disciplina.id}
                      className="border-t text-sm hover:bg-slate-50"
                    >
                      <td className="p-3 font-bold text-teal-700">
                        {valorOuTraco(disciplina.codigo)}
                      </td>
                      <td className="p-3 font-semibold">
                        {valorOuTraco(disciplina.nome)}
                      </td>
                      <td className="p-3 text-right">
                        <AcoesLinha
                          onEditar={() => editarDisciplina(disciplina)}
                          onExcluir={() => excluirDisciplina(disciplina.id)}
                          desabilitado={bloqueiaFormularioObra}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

                    <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <SecaoTitulo
                titulo="Funções disponíveis"
                descricao="Cadastre apenas os cargos usados no planejamento da obra."
              />

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {funcoesPrevistas.length} funções
              </span>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1fr)_112px]">
              <input
                value={funcaoPrevistaNome}
                onChange={(e) => setFuncaoPrevistaNome(e.target.value)}
                disabled={bloqueiaFormularioObra}
                className={`rounded-lg border border-slate-300 p-3 ${classeCampoBloqueavel}`}
                placeholder="Ex.: Mecânico"
              />

              <button
                type="button"
                onClick={salvarFuncaoPrevista}
                disabled={bloqueiaFormularioObra}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${classeBotaoPrimario}`}
              >
                {funcaoEditandoId ? "Salvar alterações" : "Adicionar"}
              </button>
            </div>

            {funcaoEditandoId && (
              <button
                type="button"
                onClick={limparFuncaoPrevista}
                className="mb-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar edição de função
              </button>
            )}

            {funcoesPrevistas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
                Nenhuma função cadastrada ainda.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Função</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {funcoesPrevistas.map((funcao) => (
                    <tr
                      key={funcao.id}
                      className="border-t text-sm hover:bg-slate-50"
                    >
                      <td className="p-3 font-semibold">
                        {valorOuTraco(funcao.nome)}
                      </td>
                      <td className="p-3 text-right">
                        <AcoesLinha
                          onEditar={() => editarFuncaoPrevista(funcao)}
                          onExcluir={() => excluirFuncaoPrevista(funcao.id)}
                          desabilitado={bloqueiaFormularioObra}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Obras cadastradas</h2>
              <p className="text-sm text-slate-500">
                Registros criados nesta sessão.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {obras.length} obras
            </span>
          </div>

          {obras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
              Nenhuma obra cadastrada ainda.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Obra</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Contrato</th>
                  <th className="p-3 text-center">Período</th>
                  <th className="p-3 text-center">Situação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {obras.map((obra) => (
                  <tr key={obra.id} className="border-t text-sm hover:bg-slate-50">
                    <td className="p-3 font-bold text-teal-700">
                      {valorOuTraco(obra.codigo)}
                    </td>
                    <td className="p-3 font-semibold">
                      {valorOuTraco(obra.nome)}
                    </td>
                    <td className="p-3">{valorOuTraco(obra.cliente)}</td>
                    <td className="p-3">{valorOuTraco(obra.contrato)}</td>
                    <td className="p-3 text-center">
                      {formatarPeriodo(obra.inicio, obra.termino)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                        {obra.situacao}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <AcoesLinha
                        onEditar={() => editarObra(obra)}
                        onExcluir={() => excluirObra(obra.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </DesktopLayout>
  );
}

function calcularPrazoDias(inicio: string, termino: string) {
  if (!inicio || !termino) {
    return 0;
  }

  const inicioData = new Date(`${inicio}T00:00:00`);
  const terminoData = new Date(`${termino}T00:00:00`);
  const diferenca = terminoData.getTime() - inicioData.getTime();

  if (diferenca < 0) {
    return 0;
  }

  return Math.round(diferenca / 86400000) + 1;
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

function formatarPeriodo(inicio: string, termino: string) {
  if (!inicio && !termino) {
    return "-";
  }

  return `${inicio ? formatarData(inicio) : "-"} - ${
    termino ? formatarData(termino) : "-"
  }`;
}

function calcularHorasTrabalho(
  horaInicio: string,
  horaFim: string,
  descontaRefeicao: boolean
) {
  if (!horaInicio || !horaFim) {
    return 0;
  }

  const inicioMinutos = converterHoraParaMinutos(horaInicio);
  let fimMinutos = converterHoraParaMinutos(horaFim);

  if (fimMinutos < inicioMinutos) {
    fimMinutos += 24 * 60;
  }

  const desconto = descontaRefeicao ? 60 : 0;
  const minutosLiquidos = Math.max(fimMinutos - inicioMinutos - desconto, 0);

  return minutosLiquidos / 60;
}

function calcularHhDisponivel(quantidade: number, cargaHoraria: number) {
  return quantidade * cargaHoraria;
}

function converterHoraParaMinutos(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);

  if (Number.isNaN(horas) || Number.isNaN(minutos)) {
    return 0;
  }

  return horas * 60 + minutos;
}

function formatarHoras(horas: number) {
  return `${horas.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: horas % 1 === 0 ? 0 : 1,
  })} h`;
}

function permissaoPorNivel(nivel: NivelAcesso) {
  if (nivel === "Planejador") {
    return "Acesso a todas as telas";
  }

  if (nivel === "Visitante") {
    return "Acesso somente ao Painel";
  }

  return "Acesso apenas à tela Campo";
}

function valorOuTraco(valor: string) {
  return valor || "-";
}

function SecaoTitulo({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="text-sm text-slate-500">{descricao}</p>
    </div>
  );
}

function CampoRotulado({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[190px] text-right text-sm font-bold text-slate-900">
        {valor}
      </span>
    </div>
  );
}

function AcoesLinha({
  onEditar,
  onExcluir,
  desabilitado = false,
}: {
  onEditar: () => void;
  onExcluir: () => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onEditar}
        disabled={desabilitado}
        className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
          desabilitado
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
      >
        Editar
      </button>

      <button
        type="button"
        onClick={onExcluir}
        disabled={desabilitado}
        className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
          desabilitado
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        }`}
      >
        Excluir
      </button>
    </div>
  );
}
