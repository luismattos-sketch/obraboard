"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarSupabaseCampo } from "../../lib/supabase";
import type {
  Atividade,
  AtividadeRecurso,
  AtualizacaoAtividade,
  StatusAtividade,
} from "../../lib/types";
import {
  cadastroBaseEvento,
  normalizarObraId,
  type FuncaoPrevistaCadastrada,
  type ObraCadastrada,
  type UsuarioCadastrado,
} from "../../lib/cadastro-base";
import {
  calcularAvancoReal,
  iniciarControleTurno,
  obterControleTurno,
  pausarControleTurno,
  pertenceAoTurno,
  type ControlesTurno,
} from "../../lib/operacao";
import {
  carregarControlesTurnoRemotos,
  descreverErroSupabase,
  listarRestricoesHistoricoRemoto,
  registrarRestricaoHistoricoRemoto,
  salvarControleTurnoRemoto,
} from "../../lib/operacao-remota";

type FiltroStatus = "Todas" | "Pendentes" | "Execução" | "Restrição" | "Finalizada";

type ControleAtividade = {
  elapsedMs: number;
  runningSince: number | null;
};

type RestricaoAtividade = {
  id: string;
  texto: string;
  status: "aberta" | "resolvida" | "parada" | "reprogramada";
};

type MaoObraReal = {
  id: number;
  obra_id?: number | null;
  turno_id?: number | null;
  atividade_id?: number | null;
  funcao: string | null;
  quantidade: number | null;
  turno?: string | null;
  data_turno?: string | null;
};

const mensagemLinkInvalido = "Link inválido ou turno não encontrado.";

type ParametrosCampoUrl = {
  token: string | null;
};

export default function CampoPage() {
  return <CampoPageContent />;
}

function CampoPageContent() {
  const [parametrosUrl, setParametrosUrl] = useState<ParametrosCampoUrl | null>(null);
  const publicToken = parametrosUrl?.token?.trim() ?? "";
  const supabaseCampo = useMemo(
    () => criarSupabaseCampo(publicToken),
    [publicToken]
  );
  const [dataTurnoParametro, setDataTurnoParametro] = useState<string | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [maoObraReal, setMaoObraReal] = useState<MaoObraReal[]>([]);
  const [obraIdCampo, setObraIdCampo] = useState<number | null>(null);
  const [turnoIdCampo, setTurnoIdCampo] = useState<number | null>(null);
  const [obra, setObra] = useState("Sem obra selecionada");
  const [avisoObra, setAvisoObra] = useState("");
  const [mensagemCampo, setMensagemCampo] = useState(mensagemLinkInvalido);
  const [statusLinkCampo, setStatusLinkCampo] = useState<
    "carregando" | "valido" | "invalido"
  >("carregando");
  const [funcoesPrevistasCadastradas, setFuncoesPrevistasCadastradas] =
    useState<FuncaoPrevistaCadastrada[]>([]);
  const [usuariosCadastrados, setUsuariosCadastrados] = useState<UsuarioCadastrado[]>([]);
  const [recursosPorAtividade, setRecursosPorAtividade] = useState<
    Record<number, AtividadeRecurso[]>
  >({});
  const [turno, setTurno] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("Todas");
  const [atividadeMaoObraId, setAtividadeMaoObraId] = useState<number | null>(null);
  const [funcao, setFuncao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [controles, setControles] = useState<Record<number, ControleAtividade>>({});
  const [restricoes, setRestricoes] = useState<Record<number, RestricaoAtividade[]>>({});
  const [restricaoEditandoId, setRestricaoEditandoId] = useState<number | null>(null);
  const [restricaoSalvandoId, setRestricaoSalvandoId] = useState<number | null>(null);
  const restricaoSalvandoRef = useRef<number | null>(null);
  const [restricaoTexto, setRestricaoTexto] = useState("");
  const [atividadesEditaveis, setAtividadesEditaveis] = useState<Record<number, boolean>>({});
  const [realizadoAtividade, setRealizadoAtividade] = useState<Record<number, string>>({});
  const [dataTurnoCampo, setDataTurnoCampo] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const dataTurnoAtual =
    dataTurnoParametro ??
    dataTurnoCampo ??
    obterDataTurnoAtual(
      turno ? atividades.filter((item) => item.turno === turno) : atividades
    );

  const responsaveisDisponiveis = useMemo(() => {
    const nomes = new Set<string>();

    usuariosCadastrados.forEach((usuario) => {
      if (usuario.nome) {
        nomes.add(usuario.nome);
      }
    });
    atividades.forEach((atividade) => {
      if (atividade.responsavel) {
        nomes.add(atividade.responsavel);
      }
    });

    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [atividades, usuariosCadastrados]);

  const atividadesTurno = useMemo(
    () =>
      atividades.filter((item) => {
        const mesmaObra =
          obraIdCampo !== null && Number(item.obra_id) === Number(obraIdCampo);

        const mesmoTurno =
          turnoIdCampo !== null &&
          item.turno_id !== null &&
          item.turno_id !== undefined &&
          Number(item.turno_id) === Number(turnoIdCampo);

        const mesmoTurnoPorNome =
          Boolean(turno) &&
          String(item.turno ?? "").trim().toLowerCase() ===
            String(turno).trim().toLowerCase();

        const mesmaData =
          Boolean(dataTurnoAtual) && item.data_turno === dataTurnoAtual;

        const mesmoResponsavel =
          !responsavelFiltro || item.responsavel === responsavelFiltro;

        return (
          mesmaObra &&
          mesmaData &&
          (mesmoTurno || mesmoTurnoPorNome) &&
          mesmoResponsavel
        );
      }),
    [atividades, dataTurnoAtual, obraIdCampo, responsavelFiltro, turno, turnoIdCampo]
  );

  const atividadesFiltradas = useMemo(() => {
    if (filtro === "Todas") {
      return atividadesTurno;
    }

    if (filtro === "Pendentes") {
      return atividadesTurno.filter(
        (item) => item.status === "Planejada" || item.status === "Parcial"
      );
    }

    return atividadesTurno.filter((item) => item.status === filtro);
  }, [atividadesTurno, filtro]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function lerParametrosUrl() {
      const params = new URLSearchParams(window.location.search);

      setParametrosUrl({
        token: params.get("token"),
      });
      setStatusLinkCampo("carregando");
    }

    lerParametrosUrl();
    window.addEventListener("popstate", lerParametrosUrl);

    return () => {
      window.removeEventListener("popstate", lerParametrosUrl);
    };
  }, []);

  async function carregarAtividades(
    obraAtualId = obraIdCampo,
    turnoAtualId = turnoIdCampo,
    turnoAtualNome = turno,
    dataAtualTurno = dataTurnoAtual
  ) {
    if (!obraAtualId || !turnoAtualId || !turnoAtualNome) {
      setAtividades([]);
      setRecursosPorAtividade({});
      return;
    }

    let consulta = supabaseCampo
      .from("atividades")
      .select("*")
      .eq("obra_id", obraAtualId)
      .eq("turno_id", turnoAtualId);

    if (dataAtualTurno) {
      consulta = consulta.eq("data_turno", dataAtualTurno);
    }

    let { data, error } = await consulta.order("id", { ascending: true });

    if (colunaInexistente(error, "turno_id")) {
      let consultaSemTurnoId = supabaseCampo
        .from("atividades")
        .select("*")
        .eq("obra_id", obraAtualId)
        .eq("turno", turnoAtualNome);

      if (dataAtualTurno) {
        consultaSemTurnoId = consultaSemTurnoId.eq("data_turno", dataAtualTurno);
      }

      const resultado = await consultaSemTurnoId.order("id", { ascending: true });
      data = resultado.data;
      error = resultado.error;
    }

    if (error) {
      console.error(error);
      setAtividades([]);
      setRecursosPorAtividade({});
      return;
    }

    const carregadas = ((data || []) as Atividade[]).filter(
      (item) =>
        pertenceAoTurno(item, {
          obraId: obraAtualId,
          turnoId: turnoAtualId,
          turno: turnoAtualNome,
          dataTurno: dataAtualTurno,
        }) &&
        (!dataAtualTurno || item.data_turno === dataAtualTurno)
    );
    const dataAtual = obterDataTurnoAtual(carregadas);
    if (dataAtual) {
      setDataTurnoCampo(dataAtual);
    }
    const historicoRestricoes = await listarRestricoesHistoricoRemoto(
      obraAtualId,
      dataAtual,
      turnoAtualNome,
      turnoAtualId,
      supabaseCampo
    );

    setRestricoes(
      historicoRestricoes.reduce<Record<number, RestricaoAtividade[]>>(
        (mapa, restricao) => {
          if (restricaoEstaVisivelNoCampo(restricao.status)) {
            mapa[restricao.atividadeId] = mesclarRestricoesAtividade(
              mapa[restricao.atividadeId] ?? [],
              {
                id: restricao.id,
                texto: restricao.texto,
                status: restricao.status,
              }
            );
          }

          return mapa;
        },
        {}
      )
    );
    setAtividades(carregadas);
    setControles(
      carregadas.reduce<Record<number, ControleAtividade>>((mapa, atividade) => {
        const registro = atividade as Atividade & {
          tempo_acumulado_ms?: number | null;
          iniciado_em?: string | null;
          status?: StatusAtividade;
        };

        mapa[atividade.id] = {
          elapsedMs: Number(registro.tempo_acumulado_ms || 0),
          runningSince:
            registro.status === "Execução" && registro.iniciado_em
              ? new Date(registro.iniciado_em).getTime()
              : null,
        };
        return mapa;
      }, {})
    );
    setRealizadoAtividade(
      carregadas.reduce<Record<number, string>>((mapa, atividade) => {
        mapa[atividade.id] = String(atividade.realizado ?? 0);
        return mapa;
      }, {})
    );
    await carregarRecursosAtividades(carregadas);
  }

  async function carregarRecursosAtividades(atividadesCarregadas: Atividade[]) {
    const ids = atividadesCarregadas.map((item) => item.id);

    if (ids.length === 0) {
      setRecursosPorAtividade({});
      return;
    }

    const { data, error } = await supabaseCampo
      .from("atividade_recursos")
      .select("*")
      .in("atividade_id", ids);

    if (error) {
      console.warn("Recursos planejados indisponiveis no campo.", error);
      setRecursosPorAtividade({});
      return;
    }

    setRecursosPorAtividade(
      ((data || []) as AtividadeRecurso[]).reduce<Record<number, AtividadeRecurso[]>>(
        (mapa, recurso) => {
          mapa[recurso.atividade_id] = [
            ...(mapa[recurso.atividade_id] ?? []),
            recurso,
          ];
          return mapa;
        },
        {}
      )
    );
  }

  async function carregarMaoObraReal(
    obraAtualId = obraIdCampo,
    turnoAtualId = turnoIdCampo,
    turnoAtualNome = turno
  ) {
    if (!obraAtualId || !turnoAtualId || !turnoAtualNome) {
      setMaoObraReal([]);
      return;
    }

    let { data, error } = await supabaseCampo
      .from("mao_obra")
      .select("*")
      .eq("obra_id", obraAtualId)
      .eq("turno_id", turnoAtualId)
      .order("id", { ascending: true });

    if (colunaInexistente(error, "turno_id")) {
      const resultado = await supabaseCampo
        .from("mao_obra")
        .select("*")
        .eq("obra_id", obraAtualId)
        .eq("turno", turnoAtualNome)
        .order("id", { ascending: true });

      data = resultado.data;
      error = resultado.error;
    }

    if (error) {
      console.error(error);
      setMaoObraReal([]);
      return;
    }

    setMaoObraReal(
      ((data || []) as MaoObraReal[]).filter(
        (item) =>
          pertenceAoTurno(item, {
            obraId: obraAtualId,
            turnoId: turnoAtualId,
            turno: turnoAtualNome,
          })
      )
    );
  }

  function limparCampoInvalido(motivo: string, texto = mensagemLinkInvalido) {
    console.error("Link Campo invalido:", motivo);
    setObraIdCampo(null);
    setTurnoIdCampo(null);
    setObra("Obra não encontrada");
    setTurno("");
    setAvisoObra(texto);
    setMensagemCampo(texto);
    setStatusLinkCampo("invalido");
    setAtividades([]);
    setMaoObraReal([]);
    setRecursosPorAtividade({});
    setFuncoesPrevistasCadastradas([]);
    setUsuariosCadastrados([]);
  }

  async function resolverContextoCampoPorToken() {
    const { data, error } = await supabaseCampo.rpc("campo_contexto_token", {
      p_token: publicToken,
    });

    if (error || !data || typeof data !== "object") {
      if (error) {
        console.warn("Nao foi possivel carregar o contexto do Campo.", error);
      }
      return null;
    }

    const contexto = data as Record<string, unknown>;
    const operacaoLinha = contexto.operacao as Record<string, unknown> | null;
    const obraLinha = contexto.obra as Record<string, unknown> | null;
    const turnoLinha = contexto.turno as Record<string, unknown> | null;
    const funcoes = Array.isArray(contexto.funcoes) ? contexto.funcoes : [];
    const usuarios = Array.isArray(contexto.usuarios) ? contexto.usuarios : [];

    if (!operacaoLinha || !obraLinha || !turnoLinha) {
      return null;
    }

    return {
      operacao: {
        obraId: normalizarObraId(
          operacaoLinha.obra_id as string | number | null | undefined
        ),
        turnoId: normalizarIdParametro(
          (operacaoLinha.turno_id as string | number | null | undefined) ?? null
        ),
        dataTurno: operacaoLinha.data_turno
          ? String(operacaoLinha.data_turno)
          : null,
        turno: String(operacaoLinha.turno || ""),
      },
      obra: {
        id: Number(obraLinha.id),
        nome: String(obraLinha.nome || obraLinha.codigo || "Obra sem nome"),
        codigo: String(obraLinha.codigo || ""),
        logoUrl: String(obraLinha.logo_url || ""),
      } as Pick<ObraCadastrada, "id" | "nome" | "codigo" | "logoUrl">,
      turno: {
        id: Number(turnoLinha.id),
        nome: String(turnoLinha.nome || ""),
      },
      funcoes: (funcoes as Array<Record<string, unknown>>).map<FuncaoPrevistaCadastrada>(
        (item) => ({
          id: Number(item.id),
          nome: String(item.nome || ""),
          quantidade: Number(item.quantidade || 0),
          cargaHoraria: Number(item.carga_horaria || 0),
        })
      ),
      usuarios: (usuarios as Array<Record<string, unknown>>).map<UsuarioCadastrado>(
        (item) => ({
          id: Number(item.id),
          nome: String(item.nome || ""),
          funcao: String(item.funcao || ""),
          email: "",
          nivelAcesso: String(item.nivel_acesso || "Usuario") as UsuarioCadastrado["nivelAcesso"],
        })
      ),
    };
  }

  useEffect(() => {
    async function carregarContextoObra() {
      if (!parametrosUrl) {
        return;
      }

      if (!publicToken) {
        limparCampoInvalido("token ausente");
        return;
      }

      const contextoDireto = await resolverContextoCampoPorToken();

      if (!contextoDireto) {
        const { data: statusConta } = await supabaseCampo.rpc(
          "campo_status_token",
          { p_token: publicToken }
        );
        const mensagemStatus = mensagemContaCampo(
          typeof statusConta === "string" ? statusConta : "invalid"
        );
        limparCampoInvalido(
          mensagemStatus ? "conta indisponivel" : "token invalido ou turno nao publicado",
          mensagemStatus || mensagemLinkInvalido
        );
        return;
      }

      const obraIdToken = contextoDireto.operacao.obraId;
      const turnoIdToken = contextoDireto.operacao.turnoId;
      const dataTurnoToken = contextoDireto.operacao.dataTurno;

      if (!obraIdToken || !turnoIdToken || !dataTurnoToken) {
        limparCampoInvalido("token sem contexto operacional completo");
        return;
      }

      setDataTurnoParametro(dataTurnoToken);

      setMensagemCampo(mensagemLinkInvalido);
      setStatusLinkCampo("valido");
      setObraIdCampo(obraIdToken);
      setTurnoIdCampo(turnoIdToken);
      setDataTurnoCampo(dataTurnoToken);
      setObra(
        contextoDireto.obra.nome ||
          contextoDireto.obra.codigo ||
          "Obra sem nome"
      );
      setAvisoObra("");
      setFuncoesPrevistasCadastradas(contextoDireto.funcoes ?? []);
      setUsuariosCadastrados(contextoDireto.usuarios ?? []);
      setTurno(contextoDireto.turno.nome || contextoDireto.operacao.turno);

      void carregarAtividades(
        obraIdToken,
        turnoIdToken,
        contextoDireto.turno.nome || contextoDireto.operacao.turno,
        dataTurnoToken
      );
      void carregarMaoObraReal(
        obraIdToken,
        turnoIdToken,
        contextoDireto.turno.nome || contextoDireto.operacao.turno
      );
    }

    queueMicrotask(() => {
      void carregarContextoObra();
    });
    const intervaloContexto = window.setInterval(() => {
      void carregarContextoObra();
    }, 5000);
    const recarregarContextoRemoto = () => {
      void carregarContextoObra();
    };
    window.addEventListener(cadastroBaseEvento, recarregarContextoRemoto);

    return () => {
      window.clearInterval(intervaloContexto);
      window.removeEventListener(cadastroBaseEvento, recarregarContextoRemoto);
    };
    // As cargas recebem os ids da URL explicitamente neste efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametrosUrl, publicToken, supabaseCampo]);

  useEffect(() => {
    if (!obraIdCampo || !turnoIdCampo) {
      return;
    }

    const intervalo = window.setInterval(() => {
      void carregarAtividades();
      void carregarMaoObraReal();
    }, 3000);

    return () => {
      window.clearInterval(intervalo);
    };
    // As funcoes usam o estado atual da tela Campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraIdCampo, turnoIdCampo, dataTurnoAtual, turno, supabaseCampo]);

  async function atualizarAtividade(
    id: number,
    status: StatusAtividade,
    realizado?: number,
    responsavel?: string,
    pararTurnoSeTodasFinalizadas = false
  ) {
    const atividadeAtual = atividades.find((atividade) => atividade.id === id);
    const previsto = Number(atividadeAtual?.previsto || 0);
    const quantidadeRealizada =
      realizado === undefined ? undefined : Math.max(0, realizado);
    const percentual =
      quantidadeRealizada === undefined || previsto <= 0
        ? undefined
        : Math.min(100, Math.round((quantidadeRealizada / previsto) * 100));
    const controleAtual = controles[id];
    const tempoAcumulado =
      controleAtual?.elapsedMs && controleAtual.runningSince
        ? controleAtual.elapsedMs + agora - controleAtual.runningSince
        : controleAtual?.elapsedMs ?? 0;
    const atualizacao: AtualizacaoAtividade &
      Record<string, string | number | null | undefined> = {
      status,
      tempo_acumulado_ms: Math.round(tempoAcumulado),
      iniciado_em:
        status === "Execução"
          ? atividadeAtual && (atividadeAtual as Atividade & { iniciado_em?: string | null }).iniciado_em
            ? (atividadeAtual as Atividade & { iniciado_em?: string | null }).iniciado_em
            : new Date().toISOString()
          : undefined,
      pausado_em: status === "Parcial" || status === "Restrição" ? new Date().toISOString() : undefined,
      finalizado_em: status === "Finalizada" ? new Date().toISOString() : undefined,
    };

    if (quantidadeRealizada !== undefined) {
      atualizacao.realizado = quantidadeRealizada;
      atualizacao.progresso = percentual;
      atualizacao.status = status;
    }

    if (responsavel !== undefined) {
      atualizacao.responsavel = responsavel;
    }

    const dataTurnoGravacao = dataTurnoAtual ?? atividadeAtual?.data_turno ?? null;

    if (!obraIdCampo || !turnoIdCampo || !dataTurnoGravacao) {
      alert(mensagemLinkInvalido);
      return;
    }

    let { error } = await supabaseCampo
      .from("atividades")
      .update(atualizacao)
      .eq("id", id);

    if (colunaInexistente(error, "turno_id")) {
      const resultado = await supabaseCampo
        .from("atividades")
        .update(atualizacao)
        .eq("id", id);

      error = resultado.error;
    }

    if (error) {
      const resultado = await supabaseCampo
        .from("atividades")
        .update(atualizacao)
        .eq("id", id);
      error = resultado.error;
    }

    if (error) {
      console.error(error);
      alert(descreverErroSupabase(error, "atualizar a atividade"));
      return;
    }

    const atividadeAtualizada = atividadeAtual
      ? ({ ...atividadeAtual, ...atualizacao } as Atividade)
      : null;

    if (atividadeAtualizada) {
      setAtividades((atuais) =>
        atuais.map((atividade) =>
          atividade.id === id ? atividadeAtualizada : atividade
        )
      );
      if (atualizacao.realizado !== undefined) {
        setRealizadoAtividade((atuais) => ({
          ...atuais,
          [id]: String(atualizacao.realizado ?? 0),
        }));
      }

      await sincronizarControleTurnoPorAtividades(
        atividadeAtualizada,
        dataTurnoGravacao,
        pararTurnoSeTodasFinalizadas
      );
    }

    try {
      await carregarAtividades(obraIdCampo, turnoIdCampo, turno, dataTurnoGravacao);
    } catch (error) {
      console.error("Atividade atualizada, mas a tela Campo não recarregou.", error);
      alert("Avanço salvo. Recarregue a tela se os dados não atualizarem.");
    }
  }

  async function sincronizarControleTurnoPorAtividades(
    atividadeAtualizada: Atividade,
    dataTurnoGravacao: string,
    pararTurnoSeTodasFinalizadas = false
  ) {
    if (!obraIdCampo || !turnoIdCampo || !turno || !dataTurnoGravacao) {
      return;
    }

    const controlesTurno = await carregarControlesTurnoRemotos(
      obraIdCampo,
      dataTurnoGravacao,
      turno,
      supabaseCampo
    );

    let novosControles: ControlesTurno | null = null;

    if (atividadeAtualizada.status === "Execução") {
      novosControles = iniciarControleTurno(
        controlesTurno,
        obraIdCampo,
        dataTurnoGravacao,
        turno
      );
    } else if (
      pararTurnoSeTodasFinalizadas &&
      atividadeAtualizada.status === "Finalizada"
    ) {
      const atividadesAtualizadas = atividades.map((atividade) =>
        atividade.id === atividadeAtualizada.id ? atividadeAtualizada : atividade
      );
      const atividadesDoTurno = atividadesAtualizadas.filter((atividade) =>
        pertenceAoTurno(atividade, {
          obraId: obraIdCampo,
          turnoId: turnoIdCampo,
          turno,
          dataTurno: dataTurnoGravacao,
        })
      );
      const todasEncerradas =
        atividadesDoTurno.length > 0 &&
        atividadesDoTurno.every(
          (atividade) => atividade.status === "Finalizada"
        );

      if (todasEncerradas) {
        novosControles = pausarControleTurno(
          controlesTurno,
          obraIdCampo,
          dataTurnoGravacao,
          turno
        );
      }
    }

    const controle = novosControles
      ? obterControleTurno(novosControles, obraIdCampo, dataTurnoGravacao, turno)
      : null;

    if (!controle) {
      return;
    }

    await salvarControleTurnoRemoto(
      obraIdCampo,
      dataTurnoGravacao,
      turno,
      turnoIdCampo,
      controle,
      supabaseCampo,
      true
    );
  }

  async function iniciarAtividade(id: number) {
    if (!atividadeTemEquipeReal(id)) {
      alert("Informe a equipe real antes de iniciar a atividade.");
      return;
    }

    setControles((atuais) => {
      const atual = atuais[id] ?? { elapsedMs: 0, runningSince: null };

      if (atual.runningSince) {
        return atuais;
      }

      return {
        ...atuais,
        [id]: {
          ...atual,
          runningSince: Date.now(),
        },
      };
    });
    await atualizarAtividade(id, "Execução");
  }

  async function finalizarAtividade(atividade: Atividade) {
    if (!atividadeFoiIniciada(atividade)) {
      alert("Inicie a atividade antes de finalizar.");
      return;
    }

    const realizadoInformado = obterRealizadoInformado(
      atividade.id,
      realizadoAtividade[atividade.id] ?? atividade.realizado ?? 0
    );

    setRealizadoAtividade((atuais) => ({
      ...atuais,
      [atividade.id]: String(realizadoInformado),
    }));
    pausarCronometro(atividade.id);
    await atualizarAtividade(
      atividade.id,
      "Finalizada",
      realizadoInformado,
      atividade.responsavel,
      true
    );
    setAtividadesEditaveis((atuais) => {
      const novos = { ...atuais };
      delete novos[atividade.id];
      return novos;
    });
  }

  async function continuarAtividadeFinalizada(atividade: Atividade) {
    setAtividadesEditaveis((atuais) => ({ ...atuais, [atividade.id]: true }));
    setRealizadoAtividade((atuais) => ({
      ...atuais,
      [atividade.id]: String(atividade.realizado ?? 0),
    }));
    setControles((atuais) => {
      const atual = atuais[atividade.id] ?? { elapsedMs: 0, runningSince: null };

      return {
        ...atuais,
        [atividade.id]: {
          ...atual,
          runningSince: atual.runningSince ?? Date.now(),
        },
      };
    });
    await atualizarAtividade(
      atividade.id,
      "Execução",
      Number(atividade.realizado || 0),
      atividade.responsavel
    );
  }

  function pausarCronometro(id: number) {
    setControles((atuais) => {
      const atual = atuais[id];

      if (!atual?.runningSince) {
        return atuais;
      }

      return {
        ...atuais,
        [id]: {
          elapsedMs: atual.elapsedMs + Date.now() - atual.runningSince,
          runningSince: null,
        },
      };
    });
  }

  async function abrirRestricao(atividade: Atividade) {
    if (!atividadeFoiIniciada(atividade)) {
      alert("Inicie a atividade antes de cadastrar restrição.");
      return;
    }

    setRestricaoEditandoId(atividade.id);
    setRestricaoTexto("");
  }

  function atividadeTemEquipeReal(atividadeId: number) {
    return maoObraReal.some(
      (item) =>
        Number(item.atividade_id) === Number(atividadeId) &&
        Number(item.quantidade || 0) > 0
    );
  }

  function atividadeFoiIniciada(atividade: Atividade) {
    const registro = atividade as Atividade & {
      iniciado_em?: string | null;
      tempo_acumulado_ms?: number | null;
    };
    const controle = controles[atividade.id];

    return Boolean(
      registro.iniciado_em ||
        Number(registro.tempo_acumulado_ms || 0) > 0 ||
        controle?.runningSince ||
        Number(controle?.elapsedMs || 0) > 0
    );
  }

  async function salvarRestricao(id: number) {
    if (!restricaoTexto.trim()) {
      alert("Informe a restrição.");
      return;
    }

    if (restricaoSalvandoRef.current === id) {
      return;
    }

    const atividade = atividades.find((item) => item.id === id);
    const texto = restricaoTexto.trim();

    try {
      restricaoSalvandoRef.current = id;
      setRestricaoSalvandoId(id);
      if (atividade) {
        pausarCronometro(id);
        await registrarRestricaoHistoricoRemoto(
          atividade,
          texto,
          "aberta",
          undefined,
          supabaseCampo
        );
        await atualizarAtividade(id, "Restrição");
      }
      setRestricaoEditandoId(null);
      setRestricaoTexto("");
    } catch (error) {
      console.error(error);
      alert(descreverErroSupabase(error, "salvar a restrição"));
    } finally {
      restricaoSalvandoRef.current = null;
      setRestricaoSalvandoId(null);
    }
  }

  async function resolverRestricao(id: number, restricaoId: string) {
    const atividade = atividades.find((item) => item.id === id);
    const restricaoAtual = restricoes[id]?.find((item) => item.id === restricaoId);
    const aindaTemRestricaoAberta = (restricoes[id] ?? []).some(
      (item) => item.id !== restricaoId && item.status === "aberta"
    );

    try {
      if (atividade) {
        await registrarRestricaoHistoricoRemoto(
          atividade,
          atuaisTextoRestricao(restricaoAtual?.texto, restricaoTexto),
          "resolvida",
          restricaoId,
          supabaseCampo
        );
      }
      setRestricoes((atuais) => ({
        ...atuais,
        [id]: (atuais[id] ?? []).map((item) =>
          item.id === restricaoId ? { ...item, status: "resolvida" } : item
        ),
      }));
      setRestricaoEditandoId(null);
      setRestricaoTexto("");
      setControles((atuais) => {
        const atual = atuais[id] ?? { elapsedMs: 0, runningSince: null };

        return {
          ...atuais,
          [id]: {
            ...atual,
            runningSince: atual.runningSince ?? Date.now(),
          },
        };
      });
      await atualizarAtividade(
        id,
        aindaTemRestricaoAberta ? "Restrição" : "Execução",
        normalizarNumeroOperacional(realizadoAtividade[id] ?? atividade?.realizado ?? 0),
        atividade?.responsavel
      );
    } catch (error) {
      console.error(error);
      alert(descreverErroSupabase(error, "resolver a restrição"));
    }
  }

  async function adicionarMaoObra() {
    if (!atividadeMaoObraId || !funcao || !quantidade) {
      alert("Informe atividade, função e quantidade.");
      return;
    }

    if (!obraIdCampo || !turnoIdCampo || !dataTurnoAtual || !turno) {
      alert("A tela Campo precisa estar vinculada a obra, data e turno.");
      return;
    }

    const payload = {
      atividade_id: atividadeMaoObraId,
      obra_id: obraIdCampo,
      turno_id: turnoIdCampo,
      funcao,
      quantidade: Number(quantidade),
      turno,
      data_turno: dataTurnoAtual,
    };

    const { error } = await salvarMaoObraSubstituindo(payload);

    if (error) {
      console.error(error);
      alert("Erro ao salvar mão de obra.");
      return;
    }

    setFuncao("");
    setQuantidade("");
    await carregarMaoObraReal();
  }

  async function salvarMaoObraSubstituindo(payload: {
    atividade_id: number;
    obra_id: number;
    turno_id: number;
    funcao: string;
    quantidade: number;
    turno: string;
    data_turno: string;
  }) {
    const payloadSemTurnoId = {
      atividade_id: payload.atividade_id,
      obra_id: payload.obra_id,
      funcao: payload.funcao,
      quantidade: payload.quantidade,
      turno: payload.turno,
      data_turno: payload.data_turno,
    };

    let consulta = await supabaseCampo
      .from("mao_obra")
      .select("id")
      .eq("atividade_id", payload.atividade_id)
      .eq("obra_id", payload.obra_id)
      .eq("turno_id", payload.turno_id)
      .eq("data_turno", payload.data_turno)
      .eq("funcao", payload.funcao)
      .order("id", { ascending: true });

    const semColunaTurnoId = colunaInexistente(consulta.error, "turno_id");

    if (semColunaTurnoId) {
      consulta = await supabaseCampo
        .from("mao_obra")
        .select("id")
        .eq("atividade_id", payload.atividade_id)
        .eq("obra_id", payload.obra_id)
        .eq("turno", payload.turno)
        .eq("data_turno", payload.data_turno)
        .eq("funcao", payload.funcao)
        .order("id", { ascending: true });
    }

    if (consulta.error) {
      return { error: consulta.error };
    }

    const existentes = ((consulta.data || []) as Array<{ id: number }>).filter(
      (item) => Number.isFinite(Number(item.id))
    );

    if (existentes.length === 0) {
      const insercao = await supabaseCampo
        .from("mao_obra")
        .insert([semColunaTurnoId ? payloadSemTurnoId : payload]);

      return { error: insercao.error };
    }

    const principalId = existentes[0].id;
    const atualizacao = await supabaseCampo
      .from("mao_obra")
      .update(semColunaTurnoId ? payloadSemTurnoId : payload)
      .eq("id", principalId);

    if (atualizacao.error) {
      return { error: atualizacao.error };
    }

    const duplicados = existentes.slice(1).map((item) => item.id);

    if (duplicados.length > 0) {
      const remocao = await supabaseCampo.from("mao_obra").delete().in("id", duplicados);

      if (remocao.error) {
        return { error: remocao.error };
      }
    }

    return { error: null };
  }

  if (statusLinkCampo === "carregando") {
    return <MensagemCampo texto="Carregando link do Campo..." />;
  }

  if (statusLinkCampo === "invalido") {
    return <MensagemCampo texto={mensagemCampo} />;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <header className="mb-4 rounded-xl bg-slate-900 p-4 text-white">
        <p className="text-xs font-semibold text-teal-200">Obra ativa: {obra}</p>
        <h1 className="text-2xl font-bold">Minhas Atividades</h1>
        <p className="text-sm text-slate-300">Campo · Turno {turno || "-"}</p>
        {avisoObra && (
          <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-teal-100">
            {avisoObra}
          </p>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Obra</p>
            <p className="mt-1 text-sm font-semibold text-white">{obra}</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Data</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {dataTurnoAtual ? formatarDataTurno(dataTurnoAtual) : "-"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Turno</p>
            <p className="mt-1 text-sm font-semibold text-white">{turno || "-"}</p>
          </div>

          <label className="block rounded-lg border border-slate-700 bg-slate-800 p-3">
            <span className="block text-xs font-bold uppercase text-slate-400">
              Responsável
            </span>
            <select
              value={responsavelFiltro}
              onChange={(e) => setResponsavelFiltro(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm font-semibold text-white"
            >
              <option value="">Todos os responsáveis</option>
              {responsaveisDisponiveis.map((responsavel) => (
                <option key={responsavel} value={responsavel}>
                  {responsavel}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <ResumoCard titulo="Total" valor={String(atividadesTurno.length)} />
        <ResumoCard
          titulo="Execução"
          valor={String(atividadesTurno.filter((a) => a.status === "Execução").length)}
        />
        <ResumoCard
          titulo="Restrição"
          valor={String(atividadesTurno.filter((a) => a.status === "Restrição").length)}
          destaque="text-red-500"
        />
        <ResumoCard
          titulo="Finalizadas"
          valor={String(atividadesTurno.filter((a) => a.status === "Finalizada").length)}
          destaque="text-green-600"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["Todas", "Pendentes", "Execução", "Restrição", "Finalizada"] as FiltroStatus[]).map(
          (item) => (
            <button
              key={item}
              onClick={() => setFiltro(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ${
                filtro === item ? "bg-teal-600 text-white" : "bg-white text-slate-700"
              }`}
            >
              {item}
            </button>
          )
        )}
      </div>

      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Mão de obra real</h2>
          <p className="text-sm text-slate-500">
            Vincule a equipe mobilizada a uma atividade do turno.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_120px]">
          <select
            value={atividadeMaoObraId ?? ""}
            onChange={(e) =>
              setAtividadeMaoObraId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg border border-slate-300 p-3 text-sm"
          >
            <option value="">Atividade</option>
            {atividadesTurno.map((item) => (
              <option key={item.id} value={item.id}>
                {item.atividade}
              </option>
            ))}
          </select>

          <select
            value={funcao}
            onChange={(e) => {
              const nome = e.target.value;
              const funcaoBase = funcoesPrevistasCadastradas.find(
                (item) => item.nome === nome
              );

              setFuncao(nome);

              if (funcaoBase) {
                setQuantidade(String(funcaoBase.quantidade));
              }
            }}
            className="rounded-lg border border-slate-300 p-3 text-sm"
          >
            <option value="">Função</option>
            {funcoesPrevistasCadastradas.map((item) => (
              <option key={item.id} value={item.nome}>
                {item.nome}
              </option>
            ))}
          </select>

          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            type="number"
            className="rounded-lg border border-slate-300 p-3 text-sm"
            placeholder="Qtd"
          />
        </div>

        <button
          onClick={adicionarMaoObra}
          className="mt-3 w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
        >
          Adicionar
        </button>
      </section>

      <section className="space-y-4">
        {atividadesFiltradas.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
            Nenhuma atividade para este filtro.
          </p>
        ) : (
          atividadesFiltradas.map((atividade) => {
            const previsto = atividade.previsto || 0;
            const realizado = Number(
              realizadoAtividade[atividade.id] ?? atividade.realizado ?? 0
            );
            const percentual = calcularAvancoReal(previsto, realizado);
            const tempo = obterTempoDecorrido(controles[atividade.id], agora);
            const recursosAtividade = maoObraReal.filter(
              (item) => item.atividade_id === atividade.id
            );
            const recursosPlanejados = recursosPorAtividade[atividade.id] ?? [];
            const restricoesAtividade = restricoes[atividade.id] ?? [];
            const temEquipeReal = recursosAtividade.some(
              (item) => Number(item.quantidade || 0) > 0
            );
            const foiIniciada = atividadeFoiIniciada(atividade);
            const bloqueadaFinalizada =
              atividade.status === "Finalizada" && !atividadesEditaveis[atividade.id];
            const responsavelSelecionado = atividade.responsavel ?? "";

            return (
              <div key={atividade.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${
                          atividade.prioridade === "A"
                            ? "bg-red-100 text-red-700"
                            : atividade.prioridade === "B"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {atividade.prioridade}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {atividade.disciplina}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold leading-tight">
                      {atividade.atividade}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Local: {atividade.local}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Resp: {atividade.responsavel || "-"}
                    </p>
                  </div>

                  <div className="text-right">
                    <StatusBadge status={atividade.status} />
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Tempo: {formatarDuracao(tempo)}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Avanço</span>
                    <span className="font-bold">{percentual}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full ${
                        percentual >= 100
                          ? "bg-green-500"
                          : percentual >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(percentual, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Previsto</p>
                    <p className="text-lg font-bold">
                      {previsto} {atividade.unidade || "un"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Realizado</p>
                    <input
                      data-realizado-atividade-id={atividade.id}
                      type="number"
                      value={realizadoAtividade[atividade.id] ?? String(realizado)}
                      onChange={(e) => {
                        const valorDigitado = e.currentTarget.value;
                        setRealizadoAtividade((atuais) => ({
                          ...atuais,
                          [atividade.id]: valorDigitado,
                        }));
                      }}
                      disabled={bloqueadaFinalizada}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-lg font-bold"
                      onBlur={(e) => {
                        const valor = normalizarNumeroOperacional(e.target.value);
                        setRealizadoAtividade((atuais) => ({
                          ...atuais,
                          [atividade.id]: String(valor),
                        }));
                        void atualizarAtividade(
                          atividade.id,
                          atividade.status,
                          valor,
                          responsavelSelecionado
                        );
                      }}
                    />
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-teal-50 p-3 text-sm">
                  <p className="font-bold text-teal-800">Equipe planejada</p>
                  {recursosPlanejados.length === 0 ? (
                    <p className="mt-1 text-teal-700">Nenhuma equipe planejada vinculada.</p>
                  ) : (
                    <p className="mt-1 text-teal-700">
                      {recursosPlanejados
                        .map(
                          (item) =>
                            `${item.funcao}: ${Number(item.quantidade_prevista || 0)}`
                        )
                        .join(" | ")}
                    </p>
                  )}
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-bold text-slate-700">Mão de obra vinculada</p>
                  {recursosAtividade.length === 0 ? (
                    <p className="mt-1 text-slate-500">Nenhuma equipe lançada.</p>
                  ) : (
                    <p className="mt-1 text-slate-600">
                      {recursosAtividade
                        .map((item) => `${item.funcao}: ${item.quantidade}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                {restricoesAtividade.map((restricao) => (
                  <div
                    key={restricao.id}
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-red-700">Restrição</p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-red-700">
                        {restricao.status}
                      </span>
                    </div>
                    <p className="mt-1 text-red-700">{restricao.texto || "Sem descrição"}</p>
                    {restricao.status === "aberta" && restricaoEditandoId !== atividade.id && (
                      <button
                        onClick={() => resolverRestricao(atividade.id, restricao.id)}
                        className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Resolvido
                      </button>
                    )}
                  </div>
                ))}

                {restricaoEditandoId === atividade.id && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <label className="block text-sm font-bold text-red-700">
                      Informe a restrição
                    </label>
                    <textarea
                      value={restricaoTexto}
                      onChange={(e) => setRestricaoTexto(e.target.value)}
                      className="mt-2 min-h-[80px] w-full rounded-lg border border-red-200 bg-white p-3 text-sm"
                      placeholder="Descreva o impedimento, responsável e condição de liberação..."
                    />
                    <div className="mt-3">
                      <button
                        onClick={() => salvarRestricao(atividade.id)}
                        disabled={restricaoSalvandoId === atividade.id}
                        className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-red-300"
                      >
                        {restricaoSalvandoId === atividade.id
                          ? "Salvando..."
                          : "Salvar restrição"}
                      </button>
                    </div>
                  </div>
                )}

                {bloqueadaFinalizada ? (
                  <button
                    onClick={() => continuarAtividadeFinalizada(atividade)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Continuar
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => iniciarAtividade(atividade.id)}
                      disabled={!temEquipeReal}
                      className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Iniciar
                    </button>
                    <button
                      onClick={() => abrirRestricao(atividade)}
                      disabled={!temEquipeReal || !foiIniciada}
                      className="rounded-lg bg-red-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Restrição
                    </button>
                    <button
                      onClick={() => finalizarAtividade(atividade)}
                      disabled={!temEquipeReal || !foiIniciada}
                      className="rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Finalizar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function MensagemCampo({ texto }: { texto: string }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <p className="rounded-xl bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
        {texto}
      </p>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classe =
    status === "Restrição"
      ? "bg-red-100 text-red-700"
      : status === "Execução"
      ? "bg-blue-100 text-blue-700"
      : status === "Finalizada"
      ? "bg-green-100 text-green-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classe}`}>
      {status}
    </span>
  );
}

function obterTempoDecorrido(controle: ControleAtividade | undefined, agora: number) {
  if (!controle) {
    return 0;
  }

  return controle.elapsedMs + (controle.runningSince ? agora - controle.runningSince : 0);
}

function formatarDuracao(ms: number) {
  const segundosTotais = Math.floor(ms / 1000);
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.floor((segundosTotais % 3600) / 60);
  const segundos = segundosTotais % 60;

  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(
    2,
    "0"
  )}:${String(segundos).padStart(2, "0")}`;
}

function obterDataTurnoAtual(atividades: Array<{ data_turno?: string | null }>) {
  const datas = atividades
    .map((item) => item.data_turno)
    .filter((data): data is string => Boolean(data))
    .sort();

  return datas.at(-1) ?? null;
}

function formatarDataTurno(dataTurno: string) {
  const [ano, mes, dia] = dataTurno.split("-");

  if (!ano || !mes || !dia) {
    return dataTurno;
  }

  return `${dia}/${mes}/${ano}`;
}

function normalizarIdParametro(id: string | number | null) {
  if (!id) {
    return null;
  }

  const numero = Number(id);

  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function colunaInexistente(error: unknown, coluna: string) {
  const erro = error as { code?: string; message?: string } | null;

  return erro?.code === "42703" && erro.message?.includes(coluna);
}

function atuaisTextoRestricao(textoSalvo: string | undefined, textoEditando: string) {
  return textoEditando.trim() || textoSalvo || "Sem descrição";
}

function restricaoEstaVisivelNoCampo(status: string) {
  return ["aberta", "resolvida", "parada", "reprogramada"].includes(status);
}

function mensagemContaCampo(status: string) {
  const mensagens: Record<string, string> = {
    suspended: "Conta temporariamente suspensa.",
    cancelled: "O acesso desta conta foi cancelado.",
    banned: "Esta conta não está autorizada a operar.",
    deleted_pending: "Conta indisponível.",
    deleted: "Conta indisponível.",
  };

  return mensagens[status] ?? "";
}

function mesclarRestricoesAtividade(
  atuais: RestricaoAtividade[],
  nova: RestricaoAtividade
) {
  const mapa = new Map(atuais.map((item) => [item.id, item]));
  const textoNova = normalizarTextoRestricao(nova.texto);

  if (restricaoEstaAtivaNoCampo(nova.status)) {
    atuais.forEach((item) => {
      if (
        item.id !== nova.id &&
        restricaoEstaAtivaNoCampo(item.status) &&
        normalizarTextoRestricao(item.texto) === textoNova
      ) {
        mapa.delete(item.id);
      }
    });
  }

  mapa.set(nova.id, { ...mapa.get(nova.id), ...nova });

  return Array.from(mapa.values());
}

function restricaoEstaAtivaNoCampo(status: string) {
  return ["aberta", "parada", "reprogramada"].includes(status);
}

function normalizarTextoRestricao(texto: string) {
  return texto.trim().replace(/\s+/g, " ").toLowerCase();
}

function obterRealizadoInformado(atividadeId: number, fallback: string | number | null) {
  if (typeof document === "undefined") {
    return normalizarNumeroOperacional(fallback);
  }

  const campo = document.querySelector<HTMLInputElement>(
    `input[data-realizado-atividade-id="${atividadeId}"]`
  );
  const valor = campo?.value ?? String(fallback ?? 0);

  return normalizarNumeroOperacional(valor);
}

function normalizarNumeroOperacional(valor: string | number | null | undefined) {
  const texto = String(valor ?? "0").trim().replace(",", ".");
  const numero = Number(texto || 0);

  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
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
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-2xl font-bold ${destaque}`}>{valor}</p>
    </div>
  );
}
