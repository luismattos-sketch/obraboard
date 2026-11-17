import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { horaCurta, type Ocorrencia } from "./efetivoHH";
import { ROTULO_PERIODO } from "./formato";
import { CAUSAS, type Periodo } from "./tipos";

/** Aviso ao planejador pelo WhatsApp: só um link wa.me com a mensagem pronta (o app do aparelho envia). */

/** Número digitado → só dígitos com DDI (10–11 dígitos ganham 55). Vazio = sem número. */
export function normalizarWhatsapp(entrada: string): Resultado<string | null> {
  const d = (entrada ?? "").replace(/\D/g, "");
  if (!d) return ok(null);
  if (d.length === 10 || d.length === 11) return ok(`55${d}`);
  if (d.length >= 12 && d.length <= 15) return ok(d);
  return falha("Número inválido (ex.: (11) 98888-7777)");
}

/** Sem número: o WhatsApp abre para a pessoa escolher o contato. */
export function linkWhatsapp(numero: string | null, texto: string): string {
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(texto)}`;
}

type Contexto = { obra: string; data: string; periodo: Periodo; equipe: string };

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const onde = (c: Contexto) => `${c.obra} · ${ddmm(c.data)} ${ROTULO_PERIODO[c.periodo]}`;

export function mensagemParada(p: Contexto & { o: Ocorrencia; aguardando: string | null }): string {
  const q = p.o.quantidade;
  const motivo = p.o.causa ? `${CAUSAS[p.o.causa]}${p.aguardando ? ` (${p.aguardando})` : ""}` : "—";
  return [
    `⚠ Parada — ${onde(p)}`,
    `${p.equipe}: ${q} ${p.o.funcao} ${q === 1 ? "parado" : "parados"} desde ${horaCurta(p.o.hora_inicio)}`,
    `Motivo: ${motivo}`,
    ...(p.o.observacao ? [p.o.observacao] : []),
  ].join("\n");
}

export function mensagemRetomada(p: Contexto & { o: Ocorrencia }): string {
  const q = p.o.quantidade;
  return `✅ ${p.equipe}: ${q} ${p.o.funcao} ${q === 1 ? "voltou" : "voltaram"} às ${horaCurta(p.o.hora_fim ?? "")} (${
    q === 1 ? "parado" : "parados"
  } desde ${horaCurta(p.o.hora_inicio)}) — ${onde(p)}`;
}

export function mensagemTerminou(p: Contexto & { hora: string }): string {
  return `✓ ${p.equipe} terminou a parte da equipe às ${horaCurta(p.hora)} — ${onde(p)}`;
}
