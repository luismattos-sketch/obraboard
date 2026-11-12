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

/** Etapas da obra no menu lateral, na ordem do ciclo: programar → executar → registrar → medir. */
export type Etapa = "programacao" | "turnos" | "rdos" | "analise";

export const ETAPAS: { id: Etapa; rotulo: string; sufixo: string }[] = [
  { id: "programacao", rotulo: "Programação", sufixo: "/programacao" },
  { id: "turnos", rotulo: "Turnos", sufixo: "" },
  { id: "rdos", rotulo: "RDOs", sufixo: "/rdos" },
  { id: "analise", rotulo: "Análise (PPC)", sufixo: "/analise" },
];

export const caminhoEtapa = (obraId: string, etapa: Etapa) =>
  `/obras/${obraId}${ETAPAS.find((e) => e.id === etapa)!.sufixo}`;

/** Etapa em que o endereço está (/obras/{id} e /obras/{id}/turnos/... contam como Turnos), ou null. */
export function etapaDoCaminho(caminho: string): Etapa | null {
  const [, raiz, id, secao] = caminho.split("/");
  if (raiz !== "obras" || !id || id === "nova") return null;
  if (!secao || secao === "turnos") return "turnos";
  return ETAPAS.find((e) => e.sufixo === `/${secao}`)?.id ?? null;
}

/** Ao trocar de obra no menu suspenso, continua na mesma etapa (ou na lista de turnos). */
export const caminhoAoTrocarObra = (caminho: string, novaObraId: string) =>
  caminhoEtapa(novaObraId, etapaDoCaminho(caminho) ?? "turnos");
