import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";

export type UsuarioE2E = Pick<UsuarioTeste, "userId" | "email" | "senha">;

/** Usuário já confirmado, com empresa e vínculo de dono (via admin). */
export async function prepararUsuario(): Promise<UsuarioE2E> {
  const { userId, email, senha } = await criarUsuarioTeste();
  return { userId, email, senha };
}

export async function limparUsuario(userId: string): Promise<void> {
  await removerUsuarioTeste(userId);
}
