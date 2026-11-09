"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DesktopLayout from "../../components/DesktopLayout";
import {
  cadastroBaseEvento,
  cadastroDadosObraInicial,
  carregarCadastroBase,
  definirDadosObra,
  notificarCadastroBaseAtualizado,
  obterDadosObra,
  obterObraAtiva,
  obterObraAtivaId,
  removerDadosObra,
  resolverObraPorParametro,
  salvarCadastroBase,
  sincronizarCadastroBaseRemoto,
  type CriticidadeObra,
  type DisciplinaCadastrada,
  type FuncaoPrevistaCadastrada,
  type NivelAcesso,
  type ObraCadastrada,
  type CadastroBase,
  type SituacaoObra,
  type TurnoCadastrado,
  type UsuarioCadastrado,
} from "../../lib/cadastro-base";
import {
  listarStatusConvitesAcesso,
  obterAdministradorContaAtual,
  sincronizarConvitesUsuarios,
  usuarioTemLogin,
  type StatusConviteAcesso,
} from "../../lib/acessos";
import { descreverLimite, obterPlanoContaAtual, type PlanoComercial } from "../../lib/planos";
import { supabase } from "../../lib/supabase";

const situacoes: SituacaoObra[] = [
  "Planejamento",
  "Mobilizacao",
  "Execucao",
  "Pausada",
];

const criticidades: CriticidadeObra[] = ["Baixa", "Media", "Alta"];
const niveisAcesso: NivelAcesso[] = [
  "Administrador",
  "Planejador",
  "Usuario",
  "Visitante",
];
type ModoObra = "criando" | "editando" | "visualizando";
type UsuarioAdministradorConta = {
  nome: string;
  funcao: string;
  email: string;
};

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
  const [usuarioNome, setUsuarioNome] = useState("");
  const [usuarioFuncao, setUsuarioFuncao] = useState("");
  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [usuarioNivel, setUsuarioNivel] = useState<NivelAcesso>("Usuario");
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([]);
  const [statusConvites, setStatusConvites] = useState<StatusConviteAcesso[]>([]);
  const [statusConvitesCarregados, setStatusConvitesCarregados] =
    useState(false);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState<number | null>(
    null
  );
  const [usuarioAdministradorConta, setUsuarioAdministradorConta] =
    useState<UsuarioAdministradorConta | null>(null);
  const [appAdmin, setAppAdmin] = useState(false);
  const [planoAtual, setPlanoAtual] = useState<PlanoComercial | null>(null);

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
  const modoObraRef = useRef<ModoObra>("criando");
  const carregamentoRemotoInicialRef = useRef(false);
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
  const obraEmTrabalhoId = modoObra === "criando" ? null : obraEditandoId ?? obraAtivaId;
  const podeEditarDadosObra = modoObra !== "visualizando";
  const bloqueiaTurnos = !podeEditarDadosObra;
  const classeCampoTurno = bloqueiaTurnos ? classeCampoBloqueavel : "";
  const classeBotaoTurno = podeEditarDadosObra && !bloqueiaTurnos
    ? "bg-teal-600 text-white hover:bg-teal-700"
    : "cursor-not-allowed bg-slate-300 text-slate-500";
  const niveisAcessoFormulario = appAdmin
    ? niveisAcesso
    : niveisAcesso.filter((nivel) => nivel !== "Administrador");

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
  }

  useEffect(() => {
    modoObraRef.current = modoObra;
  }, [modoObra]);

  useEffect(() => {
    let ativo = true;

    async function carregarUsuarioAdministrador() {
      const [{ data: isAdmin }, administrador] = await Promise.all([
        supabase.rpc("is_app_admin"),
        obterAdministradorContaAtual().catch(() => null),
      ]);

      if (!ativo) {
        return;
      }

      setAppAdmin(Boolean(isAdmin));
      setUsuarioAdministradorConta(
        administrador?.email
          ? {
              nome: administrador.nome,
              funcao: administrador.funcao,
              email: administrador.email,
            }
          : null
      );
    }

    void carregarUsuarioAdministrador();
    void listarStatusConvitesAcesso()
      .then((status) => {
        if (ativo) {
          setStatusConvites(status);
        }
      })
      .catch((error) =>
        console.warn("Nao foi possivel carregar status dos convites.", error)
      )
      .finally(() => {
        if (ativo) {
          setStatusConvitesCarregados(true);
        }
      });
    void obterPlanoContaAtual()
      .then((plano) => {
        if (ativo) {
          setPlanoAtual(plano);
        }
      })
      .catch((error) =>
        console.warn("Nao foi possivel carregar plano atual.", error)
      );

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function carregarCadastro(cadastro = carregarCadastroBase()) {
      const obraParam = new URLSearchParams(window.location.search).get("obraId");
      const obraResolvida = resolverObraPorParametro(cadastro, obraParam);
      const obraAtiva = obraResolvida.obra ?? (
        obraResolvida.parametroInformado ? null : obterObraAtiva(cadastro)
      );
      const ativoId = obraResolvida.parametroInformado
        ? obraResolvida.obraId
        : obterObraAtivaId(cadastro);
      const dadosObra =
        obraAtiva || !obraResolvida.parametroInformado
          ? obterDadosObra(cadastro, ativoId)
          : cadastroDadosObraInicial;

      setLogoUrl(obraAtiva?.logoUrl || cadastro.logoUrl);
      setObras(cadastro.obras);
      setObraAtivaId(ativoId);

      if (obraAtiva) {
        preencherFormularioObra(obraAtiva);
        setObraEditandoId(null);
        setModoObra("visualizando");
      } else {
        limparObra();
        setModoObra("criando");
      }

      const cadastroComAdministrador = garantirAdministradorEmTodasFrentes(
        cadastro,
        usuarioAdministradorConta
      );
      const usuariosDaConta = coletarUsuariosLoginConta(
        cadastroComAdministrador,
        statusConvitesCarregados ? usuariosDeStatusConvites(statusConvites) : []
      );
      const usuariosComAdministrador = mesclarUsuariosContaNaFrente(
        dadosObra.usuarios,
        usuariosDaConta,
        usuarioAdministradorConta
      );
      setUsuarios(usuariosComAdministrador);
      setDisciplinas(dadosObra.disciplinas);
      setFuncoesPrevistas(dadosObra.funcoesPrevistas);
      setTurnos(dadosObra.turnos);
      setCadastroCarregado(true);
      if (statusConvitesCarregados) {
        void sincronizarConvitesUsuarios(usuariosDaConta)
          .then(() => listarStatusConvitesAcesso())
          .then(setStatusConvites)
          .catch((error) =>
            console.warn("Nao foi possivel sincronizar convites de usuarios.", error)
          );
      }

      if (
        statusConvitesCarregados &&
        usuarioAdministradorConta &&
        ativoId &&
        usuariosComAdministrador !== dadosObra.usuarios
      ) {
        const cadastroPersistido = atualizarUsuariosGlobaisConta(
          definirDadosObra(
            cadastroComAdministrador,
            ativoId,
            {
              usuarios: filtrarUsuariosOperacionais(usuariosComAdministrador),
              disciplinas: dadosObra.disciplinas,
              funcoesPrevistas: dadosObra.funcoesPrevistas,
              turnos: dadosObra.turnos,
            }
          ),
          usuariosComAdministrador,
          usuarioAdministradorConta
        );

        void salvarCadastroBase(cadastroPersistido);
      } else if (statusConvitesCarregados && cadastroComAdministrador !== cadastro) {
        const cadastroPersistido = atualizarUsuariosGlobaisConta(
          cadastroComAdministrador,
          usuariosComAdministrador,
          usuarioAdministradorConta
        );
        void salvarCadastroBase(cadastroPersistido);
      }
    }

    async function carregarCadastroRemoto() {
      carregarCadastro(await sincronizarCadastroBaseRemoto());
    }

    function carregarCadastroLocal() {
      if (modoObraRef.current === "editando" || modoObraRef.current === "criando") {
        return;
      }

      carregarCadastro();
    }

    queueMicrotask(() => {
      if (!carregamentoRemotoInicialRef.current) {
        carregamentoRemotoInicialRef.current = true;
        void carregarCadastroRemoto();
        return;
      }

      if (modoObraRef.current === "visualizando") {
        carregarCadastro();
      }
    });
    window.addEventListener(cadastroBaseEvento, carregarCadastroLocal);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarCadastroLocal);
    };
  }, [statusConvites, statusConvitesCarregados, usuarioAdministradorConta]);

  useEffect(() => {
    if (!cadastroCarregado) {
      return;
    }

    const obraDestinoId = obraEmTrabalhoId;

    if (!obraDestinoId || modoObra !== "editando") {
      return;
    }

    const cadastroAtual = carregarCadastroBase();

    void salvarCadastroBase(
      atualizarUsuariosGlobaisConta(
        definirDadosObra(
          {
            ...cadastroAtual,
            logoUrl,
            obras,
            obraAtivaId: cadastroAtual.obraAtivaId,
          },
          obraDestinoId,
          {
            usuarios: filtrarUsuariosOperacionais(usuarios),
            disciplinas,
            funcoesPrevistas,
            turnos,
          }
        ),
        usuarios,
        usuarioAdministradorConta
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
    usuarioAdministradorConta,
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

  async function salvarObra() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const editando = modoObra === "editando" && obraEditandoId !== null;
    const obraId = editando ? obraEditandoId : gerarIdTemporario();

    if (!obraId) {
      setMensagem("Não foi possível identificar a frente para salvar.");
      return;
    }

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
    const erroLimiteFrentes = validarLimiteFrentesAtivas(
      novasObras,
      planoAtual
    );

    if (erroLimiteFrentes) {
      setMensagem(erroLimiteFrentes);
      return;
    }

    const cadastroAtual = carregarCadastroBase();
    const usuariosDaObra = mesclarUsuariosContaNaFrente(
      usuarios,
      coletarUsuariosLoginConta(cadastroAtual, usuarios),
      usuarioAdministradorConta
    );
    const dadosDaObra = {
      usuarios: filtrarUsuariosOperacionais(usuariosDaObra),
      disciplinas,
      funcoesPrevistas,
      turnos,
    };

    try {
      await salvarCadastroBase(
        atualizarUsuariosGlobaisConta(
          definirDadosObra(
            {
              ...cadastroAtual,
              logoUrl,
              obras: novasObras,
              obraAtivaId: obra.id,
            },
            obra.id,
            dadosDaObra
          ),
          usuariosDaObra,
          usuarioAdministradorConta
        )
      );
    } catch (error) {
      console.error("Erro ao salvar frente no Supabase.", error);
      setMensagem(
        erroEhLimitePlano(error)
          ? obterMensagemErro(error)
          : `Erro ao salvar frente no Supabase: ${obterMensagemErro(error)}`
      );
      return;
    }
    setObras(novasObras);
    setObraAtivaId(obra.id);
    preencherFormularioObra(obra);
    setObraEditandoId(null);
    setModoObra("visualizando");
    atualizarObraIdNaUrl(obra.id);
    setMensagem(
      editando
        ? "Frente atualizada."
        : "Frente cadastrada e selecionada como ativa."
    );
    queueMicrotask(notificarCadastroBaseAtualizado);
  }

  function cadastrarNovaObra() {
    const erroLimiteFrentes = validarLimiteNovaFrenteAtiva(obras, planoAtual);

    if (erroLimiteFrentes) {
      setMensagem(erroLimiteFrentes);
      return;
    }

    atualizarObraIdNaUrl(null);
    limparObra();
    limparUsuario();
    limparTurno();
    limparDisciplina();
    limparFuncaoPrevista();
    setObraAtivaId(null);
    setObraEditandoId(null);
    setModoObra("criando");
    setUsuarios(
      mesclarUsuariosContaNaFrente(
        [],
        coletarUsuariosLoginConta(carregarCadastroBase(), []),
        usuarioAdministradorConta
      )
    );
    setDisciplinas([]);
    setFuncoesPrevistas([]);
    setTurnos([]);
    setMensagem("Formulario pronto para nova frente.");
  }

  function editarObra(obra: ObraCadastrada) {
    const cadastroAtual = carregarCadastroBase();
    const dadosObra = obterDadosObra(cadastroAtual, obra.id);

    preencherFormularioObra(obra);
    setObraAtivaId(obra.id);
    setUsuarios(
      mesclarUsuariosContaNaFrente(
        dadosObra.usuarios,
        coletarUsuariosLoginConta(cadastroAtual, []),
        usuarioAdministradorConta
      )
    );
    setDisciplinas(dadosObra.disciplinas);
    setFuncoesPrevistas(dadosObra.funcoesPrevistas);
    setTurnos(dadosObra.turnos);
    setObraEditandoId(obra.id);
    setModoObra("editando");
    atualizarObraIdNaUrl(obra.id);
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
      null;

    limparUsuario();
    limparTurno();
    limparDisciplina();
    limparFuncaoPrevista();

    if (!obraParaRestaurar) {
      limparObra();
      setObraAtivaId(null);
      setUsuarios(
        mesclarUsuariosContaNaFrente(
          [],
          coletarUsuariosLoginConta(cadastroAtual, []),
          usuarioAdministradorConta
        )
      );
      setDisciplinas([]);
      setFuncoesPrevistas([]);
      setTurnos([]);
      setModoObra("criando");
      atualizarObraIdNaUrl(null);
      setMensagem("Edição cancelada.");
      return;
    }

    const dadosObra = obterDadosObra(cadastroAtual, obraParaRestaurar.id);

    preencherFormularioObra(obraParaRestaurar);
    setObraAtivaId(obraParaRestaurar.id);
    setObraEditandoId(null);
    setModoObra("visualizando");
    setUsuarios(
      mesclarUsuariosContaNaFrente(
        dadosObra.usuarios,
        coletarUsuariosLoginConta(cadastroAtual, []),
        usuarioAdministradorConta
      )
    );
    setDisciplinas(dadosObra.disciplinas);
    setFuncoesPrevistas(dadosObra.funcoesPrevistas);
    setTurnos(dadosObra.turnos);
    atualizarObraIdNaUrl(obraParaRestaurar.id);
    setMensagem("Edição cancelada.");
  }

  function tornarObraAtualAtivaParaEdicao() {
    const id = obraEmTrabalhoId;

    if (!id) {
      return;
    }

    setObraAtivaId(id);
    setObraEditandoId(id);
    setModoObra(obras.some((obra) => obra.id === id) ? "editando" : "criando");
    atualizarObraIdNaUrl(id);

  }

  function excluirObra(id: number) {
    const novasObras = obras.filter((item) => item.id !== id);
    const cadastroAtual = carregarCadastroBase();
    const novoAtivoId = cadastroAtual.obraAtivaId === id ? null : cadastroAtual.obraAtivaId;

    void salvarCadastroBase({
      ...cadastroAtual,
      obras: novasObras,
      obraAtivaId: novoAtivoId,
      dadosPorObra: removerDadosObra(cadastroAtual.dadosPorObra, id),
    });
    setObras(novasObras);
    setObraAtivaId(novoAtivoId);
    atualizarObraIdNaUrl(novoAtivoId);
    if (obraEditandoId === id) {
      limparObra();
    }
    queueMicrotask(notificarCadastroBaseAtualizado);
    setMensagem("Frente excluída.");
  }

  async function sincronizarAcessosDaConta(proximosUsuarios: UsuarioCadastrado[]) {
    try {
      await sincronizarConvitesUsuarios(
        coletarUsuariosLoginConta(carregarCadastroBase(), proximosUsuarios)
      );
      await carregarStatusConvites();
    } catch (error) {
      console.warn("Nao foi possivel sincronizar convites de usuarios.", error);
      setMensagem(
        `UsuÃ¡rio salvo, mas o acesso de login nÃ£o foi sincronizado: ${obterMensagemErro(error)}`
      );
    }
  }

  async function carregarStatusConvites() {
    try {
      setStatusConvites(await listarStatusConvitesAcesso());
    } catch (error) {
      console.warn("Nao foi possivel carregar status dos convites.", error);
    }
  }

  async function salvarUsuariosDaTela(proximosUsuarios: UsuarioCadastrado[]) {
    const cadastroAtual = carregarCadastroBase();
    const obraDestinoId = obraEmTrabalhoId;
    const cadastroBase =
      obraDestinoId
        ? definirDadosObra(cadastroAtual, obraDestinoId, {
            usuarios: filtrarUsuariosOperacionais(proximosUsuarios),
            disciplinas,
            funcoesPrevistas,
            turnos,
          })
        : cadastroAtual;

    await salvarCadastroBase(
      atualizarUsuariosGlobaisConta(
        cadastroBase,
        proximosUsuarios,
        usuarioAdministradorConta
      )
    );
    await sincronizarAcessosDaConta(proximosUsuarios);
  }

  function salvarUsuario() {
    if (bloqueiaFormularioObra) {
      return;
    }

    const usuarioProtegidoEmEdicao = usuarios.find(
      (item) => item.id === usuarioEditandoId && usuarioEhAdministradorProtegido(item)
    );

    if (usuarioProtegidoEmEdicao && !appAdmin) {
      setMensagem("O administrador da conta não pode ser alterado por usuários da empresa.");
      return;
    }

    if (usuarioNivel === "Administrador" && !appAdmin && !usuarioProtegidoEmEdicao) {
      setMensagem("Somente o administrador global pode cadastrar outro administrador.");
      return;
    }

    const usuario: UsuarioCadastrado = {
      id: usuarioEditandoId ?? gerarIdTemporario(),
      nome: usuarioNome,
      funcao: usuarioFuncao,
      email: usuarioEmail,
      nivelAcesso: usuarioNivel,
      protegido: usuarioProtegidoEmEdicao?.protegido,
      origem: usuarioProtegidoEmEdicao?.origem,
    };

    const proximosUsuarios = usuarioEditandoId
      ? usuarios.map((item) => (item.id === usuarioEditandoId ? usuario : item))
      : [...usuarios, usuario];
    const erroLimiteUsuarios = validarLimiteUsuariosPlano(
      proximosUsuarios,
      planoAtual
    );

    if (erroLimiteUsuarios) {
      setMensagem(erroLimiteUsuarios);
      return;
    }

    setUsuarios(proximosUsuarios);
    void salvarUsuariosDaTela(proximosUsuarios);
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
    if (usuarioEhAdministradorProtegido(usuario) && !appAdmin) {
      setMensagem("O administrador da conta só pode ser alterado pelo suporte Frentia.");
      return;
    }

    tornarObraAtualAtivaParaEdicao();
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

    const usuario = usuarios.find((item) => item.id === id);

    if (usuario && usuarioEhAdministradorProtegido(usuario) && !appAdmin) {
      setMensagem("O administrador da conta não pode ser excluído pela empresa.");
      return;
    }

    const proximosUsuarios = usuarios.filter((item) => item.id !== id);
    setUsuarios(proximosUsuarios);
    void salvarUsuariosDaTela(proximosUsuarios);
    if (usuarioEditandoId === id) {
      limparUsuario();
    }
    setMensagem("Usuário excluído.");
  }

  async function salvarTurno() {
    const obraDestinoId = obraEmTrabalhoId;

    if (bloqueiaTurnos) {
      return;
    }

    if (!turnoNome || !turnoHoraInicio || !turnoHoraFim) {
      setMensagem("Preencha nome, inicio e fim do turno antes de adicionar.");
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

    if (modoObra === "criando" || !obraDestinoId) {
      setTurnos(novosTurnos);
      limparTurno();
      setMensagem(turnoEditandoId ? "Turno atualizado." : "Turno cadastrado.");
      return;
    }

    const cadastroAtual = carregarCadastroBase();

    await salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          obraAtivaId: cadastroAtual.obraAtivaId,
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
    if (!obraEmTrabalhoId && modoObra !== "criando") {
      return;
    }

    if (modoObra !== "criando") {
      tornarObraAtualAtivaParaEdicao();
    }
    setTurnoNome(turno.nome);
    setTurnoHoraInicio(turno.horaInicio);
    setTurnoHoraFim(turno.horaFim);
    setTurnoDescontaRefeicao(turno.descontaRefeicao);
    setTurnoEditandoId(turno.id);
  }

  function excluirTurno(id: number) {
    const obraDestinoId = obraEmTrabalhoId;

    if (bloqueiaTurnos) {
      return;
    }

    const novosTurnos = turnos.filter((item) => item.id !== id);

    if (modoObra === "criando" || !obraDestinoId) {
      setTurnos(novosTurnos);
      if (turnoEditandoId === id) {
        limparTurno();
      }
      setMensagem("Turno excluido.");
      return;
    }

    const cadastroAtual = carregarCadastroBase();
    const turnoAtivoAtual = cadastroAtual.turnoAtivoPorObra[String(obraDestinoId)];
    const turnoAtivoIdAtual = cadastroAtual.turnoAtivoIdPorObra[String(obraDestinoId)];
    const turnoExcluido = turnos.find((item) => item.id === id);
    const proximoTurnoAtivo =
      turnoAtivoAtual === turnoExcluido?.nome || turnoAtivoIdAtual === id
        ? ""
        : turnoAtivoAtual ?? "";
    const proximoTurnoAtivoId =
      turnoAtivoIdAtual === id ? undefined : turnoAtivoIdAtual;
    const novoTurnoAtivoIdPorObra = { ...cadastroAtual.turnoAtivoIdPorObra };

    if (proximoTurnoAtivoId) {
      novoTurnoAtivoIdPorObra[String(obraDestinoId)] = proximoTurnoAtivoId;
    } else {
      delete novoTurnoAtivoIdPorObra[String(obraDestinoId)];
    }

    void salvarCadastroBase(
      definirDadosObra(
        {
          ...cadastroAtual,
          obraAtivaId: cadastroAtual.obraAtivaId,
          turnoAtivoPorObra: {
            ...cadastroAtual.turnoAtivoPorObra,
            [String(obraDestinoId)]: proximoTurnoAtivo,
          },
          turnoAtivoIdPorObra: novoTurnoAtivoIdPorObra,
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

    const usuario = usuarios.find((item) => item.id === id);

    if (usuario && usuarioEhAdministradorProtegido(usuario) && !appAdmin) {
      setMensagem("O nível do administrador da conta só pode ser alterado pelo suporte Frentia.");
      return;
    }

    if (nivelAcesso === "Administrador" && !appAdmin) {
      setMensagem("Somente o administrador global pode definir outro administrador.");
      return;
    }

    const proximosUsuarios = usuarios.map((usuario) =>
      usuario.id === id ? { ...usuario, nivelAcesso } : usuario
    );
    const erroLimiteUsuarios = validarLimiteUsuariosPlano(
      proximosUsuarios,
      planoAtual
    );

    if (erroLimiteUsuarios) {
      setMensagem(erroLimiteUsuarios);
      return;
    }

    setUsuarios(proximosUsuarios);
    void salvarUsuariosDaTela(proximosUsuarios);
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
      titulo="Cadastro da Frente"
      subtitulo="Dados base para planejamento, check-in e acompanhamento"
      status={statusCadastro}
      logoUrl={logoUrl || undefined}
    >
      <div className="space-y-4">
        {mensagem && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              mensagemEhAviso(mensagem)
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {mensagem}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">
              Frente ativa
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {obraSelecionada?.nome || obraSelecionada?.codigo || "Selecione uma frente no menu lateral"}
            </p>
          </div>

          <button
            type="button"
            onClick={cadastrarNovaObra}
            className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            Cadastrar nova frente
          </button>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <SecaoTitulo
                titulo="Informações gerais"
                descricao="Identifique a frente e o contrato que será acompanhado."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <CampoRotulado label="Nome da frente" className="md:col-span-3">
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
                        {rotuloSituacao(item)}
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
                        {rotuloCriticidade(item)}
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
                    placeholder="Descreva o escopo principal da frente..."
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
              <h2 className="text-lg font-bold">Resumo da frente</h2>
              <p className="mt-1 text-sm text-slate-500">
                Conferência antes de salvar.
              </p>

              <div className="mt-4 space-y-3">
                <ResumoLinha label="Frente" valor={valorOuTraco(nome)} />
                <ResumoLinha label="Cliente" valor={valorOuTraco(cliente)} />
                <ResumoLinha
                  label="Orçamento"
                  valor={resumo.orcamentoFormatado}
                />
                <ResumoLinha
                  label="Situação"
                  valor={rotuloSituacao(situacao)}
                />
              </div>

              <button
                type="button"
                onClick={salvarObra}
                disabled={bloqueiaFormularioObra}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${classeBotaoPrimario}`}
              >
                {obraEditandoId ? "Salvar edição" : "Salvar frente"}
              </button>

              {bloqueiaFormularioObra && obraSelecionada && (
                <button
                  type="button"
                  onClick={editarObraSelecionada}
                  className="mt-3 w-full rounded-xl border border-teal-600 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-50"
                >
                  Editar frente
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
                Depois do cadastro, use o check-in para montar o turno da frente e
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
                {niveisAcessoFormulario.map((nivel) => (
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
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-left">Permissão</th>
                  <th className="p-3 text-center">Nível de acesso</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => {
                  const usuarioProtegido =
                    usuarioEhAdministradorProtegido(usuario) && !appAdmin;
                  const niveisLinha =
                    appAdmin || usuario.nivelAcesso === "Administrador"
                      ? niveisAcesso
                      : niveisAcessoFormulario;
                  const statusUsuario = obterStatusUsuario(usuario, statusConvites);

                  return (
                  <tr key={usuario.id} className="border-t text-sm hover:bg-slate-50">
                    <td className="p-3 font-semibold">
                      <div className="flex flex-col gap-1">
                        <span>{valorOuTraco(usuario.nome)}</span>
                        {usuarioEhAdministradorProtegido(usuario) && (
                          <span className="w-fit rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                            Dono da conta
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{valorOuTraco(usuario.funcao)}</td>
                    <td className="p-3">{valorOuTraco(usuario.email)}</td>
                    <td className="p-3 text-center">
                      <StatusUsuarioBadge ativo={statusUsuario === "Ativo"} />
                    </td>
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
                        disabled={bloqueiaFormularioObra || usuarioProtegido}
                        className={`rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold ${classeCampoBloqueavel}`}
                      >
                        {niveisLinha.map((nivel) => (
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
                        desabilitado={bloqueiaFormularioObra || usuarioProtegido}
                      />
                    </td>
                  </tr>
                  );
                })}
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
                disabled={bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
                placeholder="Ex.: Dia"
              />
            </CampoRotulado>

            <CampoRotulado label="Início">
              <input
                value={turnoHoraInicio}
                onChange={(e) => setTurnoHoraInicio(e.target.value)}
                type="time"
                disabled={bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
              />
            </CampoRotulado>

            <CampoRotulado label="Fim">
              <input
                value={turnoHoraFim}
                onChange={(e) => setTurnoHoraFim(e.target.value)}
                type="time"
                disabled={bloqueiaTurnos}
                className={`w-full rounded-lg border border-slate-300 p-3 ${classeCampoTurno}`}
              />
            </CampoRotulado>

            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-slate-700">
              <input
                checked={turnoDescontaRefeicao}
                onChange={(e) => setTurnoDescontaRefeicao(e.target.checked)}
                type="checkbox"
                disabled={bloqueiaTurnos}
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
                descricao="Cadastre apenas os cargos usados no planejamento da frente."
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
              <h2 className="text-lg font-bold">Frentes cadastradas</h2>
              <p className="text-sm text-slate-500">
                Registros criados nesta sessão.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {obras.length} frentes
            </span>
          </div>

          {obras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
              Nenhuma frente cadastrada ainda.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Frente</th>
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
                        {rotuloSituacao(obra.situacao)}
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

function rotuloSituacao(situacao: SituacaoObra) {
  const rotulos: Record<SituacaoObra, string> = {
    Planejamento: "Planejamento",
    Mobilizacao: "Mobilização",
    Execucao: "Execução",
    Pausada: "Pausada",
  };

  return rotulos[situacao];
}

function rotuloCriticidade(criticidade: CriticidadeObra) {
  const rotulos: Record<CriticidadeObra, string> = {
    Baixa: "Baixa",
    Media: "Média",
    Alta: "Alta",
  };

  return rotulos[criticidade];
}

function permissaoPorNivel(nivel: NivelAcesso) {
  if (nivel === "Administrador") {
    return "Acesso completo à conta";
  }

  if (nivel === "Planejador") {
    return "Acesso a todas as telas";
  }

  if (nivel === "Visitante") {
    return "Visualiza Check-in, Painel, Check-out e Indicadores";
  }

  return "Responsavel operacional, sem login no sistema";
}

function validarLimiteFrentesAtivas(
  obras: ObraCadastrada[],
  plano: PlanoComercial | null
) {
  if (!plano) {
    return "";
  }

  const limite = plano.limites.frentesAtivas;

  if (limite === null) {
    return "";
  }

  const frentesAtivas = obras.filter((obra) => obra.situacao !== "Pausada").length;

  if (frentesAtivas <= limite) {
    return "";
  }

  return criarMensagemLimitePlano(
    plano,
    `${descreverLimite(limite)} frente(s) ativa(s)`
  );
}

function validarLimiteNovaFrenteAtiva(
  obras: ObraCadastrada[],
  plano: PlanoComercial | null
) {
  if (!plano) {
    return "";
  }

  const limite = plano.limites.frentesAtivas;

  if (limite === null) {
    return "";
  }

  const frentesAtivas = obras.filter((obra) => obra.situacao !== "Pausada").length;

  if (frentesAtivas < limite) {
    return "";
  }

  return criarMensagemLimitePlano(
    plano,
    `${descreverLimite(limite)} frente(s) ativa(s)`
  );
}

function validarLimiteUsuariosPlano(
  usuarios: UsuarioCadastrado[],
  plano: PlanoComercial | null
) {
  if (!plano) {
    return "";
  }

  const planejadores = contarUsuariosPorNivel(usuarios, "Planejador");
  const visitantes = contarUsuariosPorNivel(usuarios, "Visitante");
  const limitePlanejadores = plano.limites.planejadores;
  const limiteVisitantes = plano.limites.visitantes;

  if (limitePlanejadores !== null && planejadores > limitePlanejadores) {
    return criarMensagemLimitePlano(
      plano,
      `${descreverLimite(limitePlanejadores)} planejador(es)`
    );
  }

  if (limiteVisitantes !== null && visitantes > limiteVisitantes) {
    return criarMensagemLimitePlano(
      plano,
      `${descreverLimite(limiteVisitantes)} visitante(s)`
    );
  }

  return "";
}

function criarMensagemLimitePlano(plano: PlanoComercial, limite: string) {
  const proximoPlano = obterProximoPlano(plano);
  const sugestao = proximoPlano
    ? ` Atualize para o plano ${proximoPlano} para ampliar esse limite.`
    : " Esse plano nao possui limite superior disponivel.";

  return `Limite de cadastro atingido no plano ${plano.nome}: permite ate ${limite}.${sugestao}`;
}

function obterProximoPlano(plano: PlanoComercial) {
  if (plano.codigo === "enterprise") {
    return "";
  }

  if (plano.codigo === "premium") {
    return "Empresarial";
  }

  return "Profissional";
}

function mensagemEhAviso(mensagem: string) {
  return (
    mensagem.includes("Limite de cadastro atingido") ||
    mensagem.includes("Limite do plano atingido")
  );
}

function contarUsuariosPorNivel(
  usuarios: UsuarioCadastrado[],
  nivel: NivelAcesso
) {
  const emails = new Set<string>();

  for (const usuario of usuarios) {
    if (usuario.nivelAcesso !== nivel) {
      continue;
    }

    const email = usuario.email.trim().toLowerCase();
    emails.add(email || String(usuario.id));
  }

  return emails.size;
}

function garantirAdministradorConta(
  usuarios: UsuarioCadastrado[],
  administrador: UsuarioAdministradorConta | null
) {
  if (!administrador?.email) {
    return usuarios;
  }

  const emailAdministrador = administrador.email.trim().toLowerCase();
  const existente = usuarios.find(
    (usuario) => usuario.email.trim().toLowerCase() === emailAdministrador
  );

  if (!existente) {
    return [
      criarUsuarioAdministradorConta(administrador),
      ...usuarios,
    ];
  }

  const atualizado: UsuarioCadastrado = {
    ...existente,
    nome: existente.nome || administrador.nome,
    funcao: existente.funcao || administrador.funcao,
    email: administrador.email,
    nivelAcesso: "Administrador",
    protegido: true,
    origem: "owner",
  };

  if (
    existente.nome === atualizado.nome &&
    existente.funcao === atualizado.funcao &&
    existente.email === atualizado.email &&
    existente.nivelAcesso === atualizado.nivelAcesso &&
    existente.protegido === atualizado.protegido &&
    existente.origem === atualizado.origem
  ) {
    return usuarios;
  }

  return usuarios.map((usuario) =>
    usuario.id === existente.id ? atualizado : usuario
  );
}

function mesclarUsuariosContaNaFrente(
  usuariosFrente: UsuarioCadastrado[],
  usuariosConta: UsuarioCadastrado[],
  administrador: UsuarioAdministradorConta | null
) {
  const usuariosGlobais = garantirAdministradorConta(
    usuariosConta.filter(usuarioEhGlobalDaConta),
    administrador
  );
  const emailsGlobais = new Set(
    usuariosGlobais.map((usuario) => normalizarEmailUsuario(usuario))
  );
  const operacionais = usuariosFrente.filter((usuario) => {
    const email = normalizarEmailUsuario(usuario);
    return !usuarioEhGlobalDaConta(usuario) && (!email || !emailsGlobais.has(email));
  });

  return [...usuariosGlobais, ...operacionais];
}

function filtrarUsuariosOperacionais(usuarios: UsuarioCadastrado[]) {
  return usuarios.filter((usuario) => !usuarioEhGlobalDaConta(usuario));
}

function atualizarUsuariosGlobaisConta(
  cadastro: CadastroBase,
  usuariosTela: UsuarioCadastrado[],
  administrador: UsuarioAdministradorConta | null
) {
  const usuariosGlobais = garantirAdministradorConta(
    coletarUsuariosLoginConta(cadastro, usuariosTela),
    administrador
  );
  const dadosPorObra = Object.fromEntries(
    Object.entries(cadastro.dadosPorObra).map(([obraId, dados]) => [
      obraId,
      {
        ...dados,
        usuarios: filtrarUsuariosOperacionais(dados.usuarios),
      },
    ])
  );

  return {
    ...cadastro,
    usuarios: usuariosGlobais,
    dadosPorObra,
  };
}

function garantirAdministradorEmTodasFrentes(
  cadastro: CadastroBase,
  administrador: UsuarioAdministradorConta | null
) {
  if (!administrador?.email) {
    return cadastro;
  }

  let alterou = false;
  const dadosPorObra = Object.fromEntries(
    Object.entries(cadastro.dadosPorObra).map(([obraId, dados]) => {
      const usuariosAtualizados = garantirAdministradorConta(
        dados.usuarios,
        administrador
      );

      if (usuariosAtualizados !== dados.usuarios) {
        alterou = true;
        return [obraId, { ...dados, usuarios: usuariosAtualizados }];
      }

      return [obraId, dados];
    })
  );

  const usuariosRaiz = garantirAdministradorConta(
    cadastro.usuarios,
    administrador
  );

  if (usuariosRaiz !== cadastro.usuarios) {
    alterou = true;
  }

  return alterou
    ? {
        ...cadastro,
        usuarios: usuariosRaiz,
        dadosPorObra,
      }
    : cadastro;
}

function coletarUsuariosLoginConta(
  cadastro: CadastroBase,
  usuariosAtuais: UsuarioCadastrado[]
) {
  const porEmail = new Map<string, UsuarioCadastrado>();
  const listas = [
    cadastro.usuarios,
    usuariosAtuais,
    ...Object.values(cadastro.dadosPorObra).map((dados) => dados.usuarios),
  ];

  for (const lista of listas) {
    for (const usuario of lista) {
      const email = usuario.email.trim().toLowerCase();

      if (!email || !usuarioEhGlobalDaConta(usuario) || porEmail.has(email)) {
        continue;
      }

      porEmail.set(email, { ...usuario, email });
    }
  }

  return Array.from(porEmail.values());
}

function usuariosDeStatusConvites(statusConvites: StatusConviteAcesso[]) {
  return statusConvites
    .filter(
      (status) =>
        status.nivelAcesso === "Planejador" ||
        status.nivelAcesso === "Visitante"
    )
    .map<UsuarioCadastrado>((status, indice) => ({
      id: -100_000 - indice,
      nome:
        status.nome.trim() ||
        status.email.split("@")[0] ||
        status.nivelAcesso,
      funcao: status.funcao.trim() || status.nivelAcesso,
      email: status.email,
      nivelAcesso: status.nivelAcesso as NivelAcesso,
    }));
}

function usuarioEhGlobalDaConta(usuario: UsuarioCadastrado) {
  return (
    usuario.nivelAcesso === "Administrador" || usuarioTemLogin(usuario.nivelAcesso)
  );
}

function normalizarEmailUsuario(usuario: UsuarioCadastrado) {
  return usuario.email.trim().toLowerCase();
}

function criarUsuarioAdministradorConta(
  administrador: UsuarioAdministradorConta
): UsuarioCadastrado {
  return {
    id: -1,
    nome: administrador.nome,
    funcao: administrador.funcao,
    email: administrador.email,
    nivelAcesso: "Administrador",
    protegido: true,
    origem: "owner",
  };
}

function usuarioEhAdministradorProtegido(usuario: UsuarioCadastrado) {
  return (
    usuario.nivelAcesso === "Administrador" &&
    usuario.protegido === true &&
    usuario.origem === "owner"
  );
}

function valorOuTraco(valor: string) {
  return valor || "-";
}

function obterMensagemErro(error: unknown) {
  const erro = error as { message?: string } | null;
  return erro?.message ?? "verifique as policies e tabelas no Supabase.";
}

function erroEhLimitePlano(error: unknown) {
  return obterMensagemErro(error).includes("Limite do plano atingido");
}

function atualizarObraIdNaUrl(obraId: number | null) {
  const params = new URLSearchParams(window.location.search);

  if (obraId) {
    params.set("obraId", String(obraId));
  } else {
    params.delete("obraId");
  }

  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname
  );
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

function StatusUsuarioBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        ativo
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function obterStatusUsuario(
  usuario: UsuarioCadastrado,
  statusConvites: StatusConviteAcesso[]
) {
  if (
    usuario.nivelAcesso === "Administrador" ||
    !usuarioTemLogin(usuario.nivelAcesso)
  ) {
    return "Ativo";
  }

  const email = usuario.email.trim().toLowerCase();
  const convite = statusConvites.find((item) => item.email === email);

  return convite?.ativo ? "Ativo" : "Inativo";
}
