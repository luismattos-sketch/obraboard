import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function registrarSessaoAtual() {
  const { data } = await supabase.auth.getSession();
  const sessionId = obterSessionId(data.session);

  if (!sessionId) {
    return true;
  }

  const { error } = await supabase.rpc("registrar_sessao_ativa", {
    p_session_id: sessionId,
  });

  return !error;
}

export async function validarSessaoAtual() {
  const { data } = await supabase.auth.getSession();
  const sessionId = obterSessionId(data.session);

  if (!data.session || !sessionId) {
    return true;
  }

  const { data: valida, error } = await supabase.rpc("validar_sessao_ativa", {
    p_session_id: sessionId,
  });

  if (error) {
    return true;
  }

  return valida !== false;
}

function obterSessionId(session: Session | null) {
  const token = session?.access_token;

  if (!token) {
    return "";
  }

  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return "";
    }

    const normalizado = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalizado.padEnd(
      normalizado.length + ((4 - (normalizado.length % 4)) % 4),
      "="
    );
    const claims = JSON.parse(window.atob(padded)) as {
      session_id?: string;
      sid?: string;
    };

    return claims.session_id ?? claims.sid ?? "";
  } catch {
    return "";
  }
}
