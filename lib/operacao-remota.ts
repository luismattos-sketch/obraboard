import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Atividade } from "./types";
import {
  chaveTurno,
  type ControleTurno,
  type ControlesTurno,
  type FechamentosTurno,
  type RestricaoHistorico,
  type RestricaoStatus,
} from "./operacao";

type ControleTurnoLinha = {
  obra_id: number | null;
  data_turno: string | null;
  turno: string | null;
  turno_id?: number | null;
  status: ControleTurno["status"];
  publicado_em?: string | null;
  iniciado_em?: string | null;
  pausado_em?: string | null;
  encerrado_em?: string | null;
  rdo_gerado_em?: string | null;
  tempo_acumulado_ms?: number | null;
  running_since?: string | null;
  public_token?: string | null;
};

export function descreverErroSupabase(error: unknown, acao = "salvar") {
  const erro = error as { code?: string; message?: string; details?: string } | null;

  if (erro?.code === "42501" || erro?.message?.toLowerCase().includes("row-level security")) {
    return `Não foi possível ${acao}: o Supabase bloqueou a operação por RLS. Aplique a migração SaaS atualizada no Supabase.`;
  }

  if (erro?.code === "42703") {
    return `Não foi possível ${acao}: falta coluna no Supabase. Aplique a migração SaaS atualizada.`;
  }

  return erro?.message ? `Não foi possível ${acao}: ${erro.message}` : `Não foi possível ${acao}.`;
}

export async function carregarControlesTurnoRemotos(
  obraId: number | null,
  dataTurno?: string | null,
  turno?: string | null,
  cliente: SupabaseClient = supabase
): Promise<ControlesTurno> {
  if (!obraId) {
    return {};
  }

  let consulta = cliente.from("turnos_operacao").select("*").eq("obra_id", obraId);

  if (dataTurno) {
    consulta = consulta.eq("data_turno", dataTurno);
  }

  if (turno) {
    consulta = consulta.eq("turno", turno);
  }

  const { data, error } = await consulta;

  if (error) {
    console.warn("Não foi possível carregar turnos_operacao.", error);
    return {};
  }

  return ((data || []) as ControleTurnoLinha[]).reduce<ControlesTurno>(
    (mapa, item) => {
      mapa[chaveTurno(item.obra_id, item.data_turno, item.turno)] = {
        status: item.status ?? "planejado",
        publicadoEm: item.publicado_em ?? undefined,
        iniciadoEm: item.iniciado_em ?? undefined,
        pausadoEm: item.pausado_em ?? undefined,
        encerradoEm: item.encerrado_em ?? undefined,
        rdoGeradoEm: item.rdo_gerado_em ?? undefined,
        elapsedMs: Number(item.tempo_acumulado_ms || 0),
        runningSince: item.running_since
          ? new Date(item.running_since).getTime()
          : null,
        publicToken: item.public_token ?? undefined,
      };
      return mapa;
    },
    {}
  );
}

export async function salvarControleTurnoRemoto(
  obraId: number,
  dataTurno: string,
  turno: string,
  turnoId: number | null,
  controle: ControleTurno,
  cliente: SupabaseClient = supabase,
  somenteAtualizar = false
) {
  const payload = {
    obra_id: obraId,
    turno_id: turnoId,
    data_turno: dataTurno,
    turno,
    status: controle.status,
    publicado_em: controle.publicadoEm ?? null,
    iniciado_em: controle.iniciadoEm ?? null,
    pausado_em: controle.pausadoEm ?? null,
    encerrado_em: controle.encerradoEm ?? null,
    rdo_gerado_em: controle.rdoGeradoEm ?? null,
    tempo_acumulado_ms: Math.round(Number(controle.elapsedMs || 0)),
    running_since: controle.runningSince
      ? new Date(controle.runningSince).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const resultado = somenteAtualizar
    ? await cliente
        .from("turnos_operacao")
        .update(payload)
        .eq("obra_id", obraId)
        .eq("data_turno", dataTurno)
        .eq("turno", turno)
    : await cliente
        .from("turnos_operacao")
        .upsert(payload, { onConflict: "obra_id,data_turno,turno" });
  const { error } = resultado;

  if (error) {
    throw error;
  }
}

export async function carregarFechamentosTurnoRemotos(
  obraId: number | null
): Promise<FechamentosTurno> {
  const controles = await carregarControlesTurnoRemotos(obraId);
  return Object.entries(controles).reduce<FechamentosTurno>(
    (mapa, [chave, controle]) => {
      if (controle.status === "encerrado" && controle.encerradoEm) {
        mapa[chave] = {
          encerradoEm: controle.encerradoEm,
          rdoGeradoEm: controle.rdoGeradoEm,
          tempoFinalMs: controle.elapsedMs,
        };
      }
      return mapa;
    },
    {}
  );
}

export async function carregarValidacoesCheckoutRemotas(
  atividadesIds: number[]
): Promise<Record<string, true>> {
  if (atividadesIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("checkout_validacoes")
    .select("atividade_id")
    .in("atividade_id", atividadesIds);

  if (error) {
    console.warn("Não foi possível carregar checkout_validacoes.", error);
    return {};
  }

  return ((data || []) as Array<{ atividade_id: number }>).reduce<Record<string, true>>(
    (mapa, item) => {
      mapa[String(item.atividade_id)] = true;
      return mapa;
    },
    {}
  );
}

export async function salvarValidacaoCheckoutRemota(
  atividade: Atividade,
  validada: boolean
) {
  if (!validada) {
    await supabase.from("checkout_validacoes").delete().eq("atividade_id", atividade.id);
    return;
  }

  const { error } = await supabase.from("checkout_validacoes").upsert(
    {
      atividade_id: atividade.id,
      obra_id: atividade.obra_id ?? null,
      turno_id: atividade.turno_id ?? null,
      data_turno: atividade.data_turno ?? null,
      turno: atividade.turno ?? null,
      validado_em: new Date().toISOString(),
    },
    { onConflict: "atividade_id" }
  );

  if (error) {
    throw error;
  }
}

export async function registrarRestricaoHistoricoRemoto(
  atividade: Atividade,
  texto: string,
  status: RestricaoStatus,
  restricaoId?: string | null,
  cliente: SupabaseClient = supabase
): Promise<string | null> {
  const agora = new Date().toISOString();
  const textoNormalizado = texto.trim() || "Sem descrição";

  const payloadBase = {
    atividade_id: atividade.id,
    obra_id: atividade.obra_id ?? null,
    turno_id: atividade.turno_id ?? null,
    data_turno: atividade.data_turno ?? null,
    turno: atividade.turno ?? null,
    atividade: atividade.atividade,
    responsavel: atividade.responsavel,
    texto: textoNormalizado,
    descricao: textoNormalizado,
    observacao: textoNormalizado,
    status,
    atualizada_em: agora,
  };

  if (status === "aberta") {
    const { data: existente } = await cliente
      .from("restricoes_historico")
      .select("id")
      .eq("atividade_id", atividade.id)
      .eq("texto", textoNormalizado)
      .in("status", ["aberta", "parada", "reprogramada"])
      .order("registrada_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((existente as { id?: string } | null)?.id) {
      const idExistente = (existente as { id: string }).id;
      const { error } = await cliente
        .from("restricoes_historico")
        .update({
          ...payloadBase,
          status: "aberta",
          encerrada_em: null,
          resolvida_em: null,
        })
        .eq("id", idExistente);

      if (error) {
        throw error;
      }

      return String(idExistente);
    }

    const { data, error } = await cliente
      .from("restricoes_historico")
      .insert([
        {
          ...payloadBase,
          registrada_em: agora,
          aberta_em: agora,
          parada_em: null,
          retomada_em: null,
          encerrada_em: null,
          resolvida_em: null,
          duracao_ms: null,
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw error;
    }
    const idCriado = (data as { id?: string | number } | null)?.id;
    return idCriado === undefined || idCriado === null ? null : String(idCriado);
  }

  let consultaExistente = cliente
    .from("restricoes_historico")
    .select("id,status,parada_em,retomada_em,registrada_em,aberta_em");

  if (restricaoId) {
    consultaExistente = consultaExistente.eq("id", restricaoId);
  } else {
    consultaExistente = consultaExistente
      .eq("atividade_id", atividade.id)
      .in("status", ["aberta", "parada", "reprogramada"])
      .order("registrada_em", { ascending: false })
      .limit(1);
  }

  const { data: existente } = await consultaExistente.maybeSingle();

  const existenteTipado = existente as
    | {
        id?: string;
        status?: string;
        parada_em?: string | null;
        retomada_em?: string | null;
        registrada_em?: string | null;
        aberta_em?: string | null;
      }
    | null;
  const abertaEm = existenteTipado?.aberta_em ?? existenteTipado?.registrada_em ?? agora;
  const resolvidaEm = status === "resolvida" ? agora : null;
  const duracaoMs =
    resolvidaEm && abertaEm
      ? Math.max(0, new Date(resolvidaEm).getTime() - new Date(abertaEm).getTime())
      : null;
  const payload = {
    ...payloadBase,
    aberta_em: abertaEm,
    parada_em:
      status === "parada"
        ? existenteTipado?.parada_em ?? agora
        : existenteTipado?.parada_em ?? null,
    retomada_em:
      existenteTipado?.status === "parada" && status !== "parada"
        ? existenteTipado?.retomada_em ?? agora
        : existenteTipado?.retomada_em ?? null,
    encerrada_em: status === "parada" ? null : agora,
    resolvida_em: resolvidaEm,
    duracao_ms: duracaoMs,
  };

  if (existenteTipado?.id) {
    const { error } = await cliente
      .from("restricoes_historico")
      .update(payload)
      .eq("id", existenteTipado.id);
    if (error) {
      throw error;
    }
    return null;
  }

  const { error } = await cliente.from("restricoes_historico").insert([
    {
      ...payload,
      registrada_em: agora,
      aberta_em: abertaEm,
    },
  ]);

  if (error) {
    throw error;
  }

  return null;
}

export async function listarRestricoesHistoricoRemoto(
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null,
  turnoId?: number | null,
  cliente: SupabaseClient = supabase
): Promise<RestricaoHistorico[]> {
  if (!obraId) {
    return [];
  }

  let consulta = cliente
    .from("restricoes_historico")
    .select("*")
    .eq("obra_id", obraId)
    .order("registrada_em", { ascending: false });

  if (dataTurno) {
    consulta = consulta.eq("data_turno", dataTurno);
  }

  const { data, error } = await consulta;

  if (error) {
    console.warn("Não foi possível carregar restricoes_historico.", error);
    return [];
  }

  return ((data || []) as Array<Record<string, unknown>>)
    .filter((item) => pertenceAoFiltroTurnoHistorico(item, turnoId, turno))
    .map((item) => ({
    id: String(item.id),
    atividadeId: Number(item.atividade_id),
    obraId: item.obra_id === null ? null : Number(item.obra_id),
    turnoId: item.turno_id === null ? null : Number(item.turno_id),
    dataTurno: item.data_turno ? String(item.data_turno) : null,
    turno: item.turno ? String(item.turno) : null,
    atividade: String(item.atividade || ""),
    responsavel: String(item.responsavel || ""),
    texto: String(item.texto || item.descricao || item.observacao || ""),
    status: String(item.status || "aberta") as RestricaoStatus,
    registradaEm: String(item.aberta_em || item.registrada_em || ""),
    paradaEm: item.parada_em ? String(item.parada_em) : null,
    retomadaEm: item.retomada_em ? String(item.retomada_em) : null,
    encerradaEm: item.resolvida_em || item.encerrada_em ? String(item.resolvida_em || item.encerrada_em) : null,
    abertaEm: item.aberta_em ? String(item.aberta_em) : null,
    resolvidaEm: item.resolvida_em ? String(item.resolvida_em) : null,
    duracaoMs:
      item.duracao_ms === null || item.duracao_ms === undefined
        ? null
        : Number(item.duracao_ms),
  }));
}

function pertenceAoFiltroTurnoHistorico(
  item: Record<string, unknown>,
  turnoId?: number | null,
  turno?: string | null
) {
  if (!turnoId && !turno) {
    return true;
  }

  const itemTurnoId =
    item.turno_id === null || item.turno_id === undefined
      ? null
      : Number(item.turno_id);
  const mesmoTurnoId =
    Boolean(turnoId) && itemTurnoId !== null && Number(turnoId) === itemTurnoId;
  const mesmoTurnoNome =
    Boolean(turno) &&
    String(item.turno ?? "").trim().toLowerCase() ===
      String(turno).trim().toLowerCase();

  return Boolean(mesmoTurnoId || mesmoTurnoNome);
}
