export const EMAIL_MEDICAO_AUTORIZADO = "luismattos@gmail.com";

export function podeAcessarMedicao(email?: string | null) {
  return email?.trim().toLowerCase() === EMAIL_MEDICAO_AUTORIZADO;
}

export function rotaMedicao(pathname: string) {
  return pathname === "/medicao" || pathname.startsWith("/medicao/");
}
