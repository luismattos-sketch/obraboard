import { supabase } from "./supabase";

let empresaAtualId: string | null = null;

export async function garantirContaAtual() {
  const { data, error } = await supabase.rpc("garantir_conta_usuario");

  if (error) {
    throw error;
  }

  empresaAtualId = typeof data === "string" ? data : null;
  return empresaAtualId;
}

export async function obterEmpresaAtualId() {
  if (empresaAtualId) {
    return empresaAtualId;
  }

  return garantirContaAtual();
}

export function limparContaAtual() {
  empresaAtualId = null;
}
