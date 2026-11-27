import { LIMITES, mensagemMaximo } from "@/lib/db/validacao";

/** Mesmas regras do cadastro: obrigatório (só espaços = vazio) e até LIMITES.empresa caracteres. */
export function validarNomeEmpresa(bruto: string): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = bruto.trim();
  if (!nome) return { ok: false, erro: "Informe o nome da empresa." };
  if (nome.length > LIMITES.empresa) return { ok: false, erro: mensagemMaximo(LIMITES.empresa) };
  return { ok: true, nome };
}
