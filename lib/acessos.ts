import { supabase } from "./supabase";
import type { UsuarioCadastrado } from "./cadastro-base";

export type PapelAcesso = "owner" | "planejador" | "usuario" | "visitante" | "none";
export type StatusConviteAcesso = {
  email: string;
  nome: string;
  funcao: string;
  nivelAcesso: string;
  ativo: boolean;
};

export async function obterPapelAcessoAtual(): Promise<PapelAcesso> {
  const { data, error } = await supabase.rpc("obter_papel_acesso_atual");

  if (error) {
    console.warn("Nao foi possivel obter o papel de acesso.", error);
    return "none";
  }

  return normalizarPapel(String(data ?? "none"));
}

export async function sincronizarConvitesUsuarios(
  usuarios: UsuarioCadastrado[]
) {
  const payload = usuarios
    .filter(
      (usuario) =>
        usuario.nivelAcesso === "Planejador" ||
        usuario.nivelAcesso === "Visitante"
    )
    .map((usuario) => ({
      nome: usuario.nome,
      funcao: usuario.funcao,
      email: usuario.email,
      nivelAcesso: usuario.nivelAcesso,
    }));
  const { error } = await supabase.rpc("sincronizar_convites_usuarios", {
    p_usuarios: payload,
  });

  if (error) {
    throw error;
  }
}

export async function obterAdministradorContaAtual() {
  const { data, error } = await supabase.rpc("obter_administrador_conta_atual");

  if (error) {
    throw error;
  }

  const valor = data as
    | {
        email?: string;
        nome?: string;
        funcao?: string;
      }
    | null;

  if (!valor?.email) {
    return null;
  }

  return {
    email: String(valor.email),
    nome: String(valor.nome || valor.email.split("@")[0] || "Administrador"),
    funcao: String(valor.funcao || "Administrador"),
  };
}

export async function listarStatusConvitesAcesso(): Promise<StatusConviteAcesso[]> {
  const { data, error } = await supabase.rpc("listar_status_convites_acesso");

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data.map((item) => {
        const valor = item as {
          email?: unknown;
          nome?: unknown;
          funcao?: unknown;
          nivelAcesso?: unknown;
          ativo?: unknown;
        };
        return {
          email: String(valor.email ?? "").trim().toLowerCase(),
          nome: String(valor.nome ?? ""),
          funcao: String(valor.funcao ?? ""),
          nivelAcesso: String(valor.nivelAcesso ?? ""),
          ativo: Boolean(valor.ativo),
        };
      })
    : [];
}

export function usuarioTemLogin(nivelAcesso: string) {
  return nivelAcesso === "Planejador" || nivelAcesso === "Visitante";
}

export async function obterConviteAcessoEmail(email: string) {
  const { data, error } = await supabase.rpc("obter_convite_acesso_email", {
    p_email: email,
  });

  if (error) {
    throw error;
  }

  const valor = data as
    | {
        email?: string;
        nome?: string;
        funcao?: string;
        nivelAcesso?: string;
      }
    | null;

  if (!valor?.email) {
    return null;
  }

  return {
    email: String(valor.email),
    nome: String(valor.nome || ""),
    funcao: String(valor.funcao || ""),
    nivelAcesso: String(valor.nivelAcesso || "Usuario"),
  };
}

function normalizarPapel(papel: string): PapelAcesso {
  if (papel === "owner" || papel === "planejador" || papel === "usuario" || papel === "visitante") {
    return papel;
  }

  return "none";
}
