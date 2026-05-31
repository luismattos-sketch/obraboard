import { supabase } from "./supabase";
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
};

export async function carregarControlesTurnoRemotos(
  obraId: number | null,
  dataTurno?: string | null,
  turno?: string | null
): Promise<ControlesTurno> {
  if (!obraId) {
    return {};
  }

  let consulta = supabase.from("turnos_operacao").select("*").eq("obra_id", obraId);

  if (dataTurno) {
    consulta = consulta.eq("data_turno", dataTurno);
  }

  if (turno) {
    consulta = consulta.eq("turno", turno);
  }

  const { data, error } = await consulta;

  if (error) {
    console.warn("Nao foi possivel carregar turnos_operacao.", error);
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
  controle: ControleTurno
) {
  const { error } = await supabase.from("turnos_operacao").upsert(
    {
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
    },
    { onConflict: "obra_id,data_turno,turno" }
  );

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
    console.warn("Nao foi possivel carregar checkout_validacoes.", error);
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
  status: RestricaoStatus
) {
  const agora = new Date().toISOString();
  const { data: existente } = await supabase
    .from("restricoes_historico")
    .select("id,status,parada_em,retomada_em")
    .eq("atividade_id", atividade.id)
    .in("status", ["aberta", "parada", "reprogramada"])
    .order("registrada_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    atividade_id: atividade.id,
    obra_id: atividade.obra_id ?? null,
    turno_id: atividade.turno_id ?? null,
    data_turno: atividade.data_turno ?? null,
    turno: atividade.turno ?? null,
    atividade: atividade.atividade,
    responsavel: atividade.responsavel,
    texto,
    status,
    parada_em:
      status === "parada"
        ? (existente as { parada_em?: string | null } | null)?.parada_em ?? agora
        : (existente as { parada_em?: string | null } | null)?.parada_em ?? null,
    retomada_em:
      (existente as { status?: string; retomada_em?: string | null } | null)?.status ===
        "parada" && status !== "parada"
        ? (existente as { retomada_em?: string | null } | null)?.retomada_em ?? agora
        : (existente as { retomada_em?: string | null } | null)?.retomada_em ?? null,
    encerrada_em: status === "aberta" || status === "parada" ? null : agora,
  };

  if ((existente as { id?: string } | null)?.id) {
    const { error } = await supabase
      .from("restricoes_historico")
      .update(payload)
      .eq("id", (existente as { id: string }).id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("restricoes_historico").insert([
    {
      ...payload,
      registrada_em: agora,
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function listarRestricoesHistoricoRemoto(
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null
): Promise<RestricaoHistorico[]> {
  if (!obraId) {
    return [];
  }

  let consulta = supabase
    .from("restricoes_historico")
    .select("*")
    .eq("obra_id", obraId)
    .order("registrada_em", { ascending: false });

  if (dataTurno) {
    consulta = consulta.eq("data_turno", dataTurno);
  }

  if (turno) {
    consulta = consulta.eq("turno", turno);
  }

  const { data, error } = await consulta;

  if (error) {
    console.warn("Nao foi possivel carregar restricoes_historico.", error);
    return [];
  }

  return ((data || []) as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id),
    atividadeId: Number(item.atividade_id),
    obraId: item.obra_id === null ? null : Number(item.obra_id),
    turnoId: item.turno_id === null ? null : Number(item.turno_id),
    dataTurno: item.data_turno ? String(item.data_turno) : null,
    turno: item.turno ? String(item.turno) : null,
    atividade: String(item.atividade || ""),
    responsavel: String(item.responsavel || ""),
    texto: String(item.texto || ""),
    status: String(item.status || "aberta") as RestricaoStatus,
    registradaEm: String(item.registrada_em || ""),
    paradaEm: item.parada_em ? String(item.parada_em) : null,
    retomadaEm: item.retomada_em ? String(item.retomada_em) : null,
    encerradaEm: item.encerrada_em ? String(item.encerrada_em) : null,
  }));
}
