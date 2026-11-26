import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { climaParaTela } from "@/lib/clima/tela";
import { listarProblemas } from "@/lib/db/problemas";
import { entradaDoTurno, turnoParaClima, turnosDaObra } from "@/lib/db/quadro";
import { aderenciaDaObra } from "@/lib/db/turnos";
import { hojeSaoPaulo, horaAgoraSaoPaulo } from "@/lib/dominio/entrada";
import { agoraDoTurno } from "@/lib/dominio/efetivoHH";
import { escolherTurno, faseDoQuadro, montarQuadro, vizinhos } from "@/lib/dominio/quadro";
import { ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { PropsQuadro } from "./Quadro";

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const umValor = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Monta as props do quadro de uma obra: turno pedido (?turno=, só se for da obra) ou o "turno de agora",
 * fase automática (faseDoQuadro), navegação, clima e avisos. `null` = obra sem turnos.
 */
export async function prepararQuadro(
  c: SupabaseClient,
  obraId: string,
  busca: { turno?: string | string[] },
  base: string,
): Promise<{ props: PropsQuadro; turnoId: string } | null> {
  const turnos = await turnosDaObra(c, obraId);
  const pedido = turnos.find((t) => t.id === umValor(busca.turno));
  const escolha = pedido ? { turno: pedido, foraDeHoje: false } : escolherTurno(turnos, hojeSaoPaulo());
  const turno = escolha.turno;
  if (!turno) return null;

  const [entrada, aderenciaObra, problemas, paraClima] = await Promise.all([
    entradaDoTurno(c, turno.id),
    aderenciaDaObra(c, obraId),
    listarProblemas(c, obraId, true),
    turnoParaClima(c, turno.id),
  ]);
  if (!entrada) return null;
  // Clima nunca derruba o quadro: falhou ⇒ sem cartão.
  const clima = paraClima ? await climaParaTela(paraClima, { previsao: true }).catch(() => null) : null;

  const aviso = escolha.foraDeHoje
    ? `Sem turno hoje — mostrando ${ddmm(turno.data)} ${ROTULO_PERIODO[turno.periodo].toLowerCase()}`
    : null;
  const agora = agoraDoTurno(entrada.turno, hojeSaoPaulo(), horaAgoraSaoPaulo());
  const modelo = montarQuadro(entrada, agora);

  const href = (turnoId: string | null) => (turnoId ? `${base}?turno=${encodeURIComponent(turnoId)}` : base);
  const viz = vizinhos(turnos, turno.id);

  return {
    turnoId: turno.id,
    props: {
      modelo,
      visao: faseDoQuadro(modelo),
      aderenciaObra,
      agora,
      problemas,
      hoje: hojeSaoPaulo(),
      aviso,
      clima,
      navegacao: {
        anterior: viz.anterior ? href(viz.anterior) : null,
        seguinte: viz.seguinte ? href(viz.seguinte) : null,
        agora: pedido ? base : null,
      },
    },
  };
}
