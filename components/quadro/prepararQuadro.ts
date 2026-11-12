import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entradaDoTurno, fotoCheckin, turnosDaObra } from "@/lib/db/quadro";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { escolherTurno, montarQuadro, visaoValida, vizinhos } from "@/lib/dominio/quadro";
import { ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { PropsQuadro } from "./Quadro";

export const AVISO_SEM_REGISTRO = "Check-in sem registro oficial";

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const umValor = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Monta as props do quadro de uma obra: turno pedido (?turno=, só se for da obra) ou o "turno de agora",
 * visão (?visao=), navegação e avisos. `null` = obra sem turnos.
 */
export async function prepararQuadro(
  c: SupabaseClient,
  obraId: string,
  busca: { turno?: string | string[]; visao?: string | string[] },
  base: string,
): Promise<{ props: Omit<PropsQuadro, "publico" | "editarHref">; turnoId: string } | null> {
  const turnos = await turnosDaObra(c, obraId);
  const pedido = turnos.find((t) => t.id === umValor(busca.turno));
  const escolha = pedido ? { turno: pedido, foraDeHoje: false } : escolherTurno(turnos, hojeSaoPaulo());
  const turno = escolha.turno;
  if (!turno) return null;

  const visao = visaoValida(umValor(busca.visao), turno.status);
  const entrada = await entradaDoTurno(c, turno.id);
  if (!entrada) return null;

  let aviso: string | null = escolha.foraDeHoje
    ? `Sem turno hoje — mostrando ${ddmm(turno.data)} ${ROTULO_PERIODO[turno.periodo].toLowerCase()}`
    : null;
  let modelo = montarQuadro(entrada);
  if (visao === "checkin" && turno.status !== "planejado") {
    const foto = await fotoCheckin(c, turno.id);
    if (foto) modelo = montarQuadro({ ...foto.dados, turno: { ...foto.dados.turno, status: entrada.turno.status } });
    else aviso = aviso ? `${aviso} · ${AVISO_SEM_REGISTRO}` : AVISO_SEM_REGISTRO;
  }

  const href = (turnoId: string | null, v: string | null) => {
    const q = new URLSearchParams();
    if (turnoId) q.set("turno", turnoId);
    if (v) q.set("visao", v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const viz = vizinhos(turnos, turno.id);
  const fixo = pedido ? turno.id : null;

  return {
    turnoId: turno.id,
    props: {
      modelo,
      visao,
      aviso,
      navegacao: {
        anterior: viz.anterior ? href(viz.anterior, null) : null,
        seguinte: viz.seguinte ? href(viz.seguinte, null) : null,
        agora: pedido ? base : null,
      },
      seletor: {
        checkin: href(fixo, "checkin"),
        checkout: turno.status === "planejado" ? null : href(fixo, "checkout"),
      },
    },
  };
}
