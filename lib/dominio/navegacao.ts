// Regras puras do menu lateral do app (sem React, testáveis).

/** Cookie que lembra se o menu lateral está recolhido no computador (sem localStorage). */
export const COOKIE_MENU = "frentia_menu";

export const menuRecolhido = (valor: string | undefined) => valor === "recolhido";

/** Iniciais para o avatar: primeira letra do primeiro e do último nome (ou as duas primeiras letras). */
export function iniciais(nome: string): string {
  const base = nome.includes("@") ? nome.split("@")[0].replace(/[._-]+/g, " ") : nome;
  const partes = base.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Id da obra aberta a partir do endereço (/obras/{id}/...), ou null fora de uma obra. */
export function obraIdDoCaminho(caminho: string): string | null {
  const [, raiz, id] = caminho.split("/");
  if (raiz !== "obras" || !id || id === "nova") return null;
  return id;
}
