// "Lançar" do Conte como foi o dia: grava cada atividade pelo mesmo salvarExecucao dos cards.
// `esperado` = valores vistos no Organizar: se a atividade mudou depois, o servidor recusa (conflito → "mudou").
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import type { DadosExecucao } from "@/lib/dominio/tipos";
import type { Resultado } from "@/lib/db/resultado";
import { decidirRepeticao } from "./repeticao";
import type { Registrar } from "./rastreioSalvamento";

export type Gravacao = { atividadeId: string; dados: DadosExecucao; esperado: DadosExecucao };
/** "ok", "mudou" (mudou desde a prévia) ou a mensagem de erro do servidor. */
export type ResultadoItem = "ok" | "mudou" | string;

export async function executarLancamento(
  gravar: Gravacao[],
  salvar: (atividadeId: string, dados: DadosExecucao, esperado: DadosExecucao) => Promise<Resultado<ValoresExecucao>>,
  ambiente: { registrar: Registrar; esperar: (ms: number) => Promise<void>; online: () => boolean },
): Promise<Record<string, ResultadoItem>> {
  const resultados: Record<string, ResultadoItem> = {};
  for (const g of gravar) {
    const chave = `relato:${g.atividadeId}`;
    ambiente.registrar(chave, "salvando");
    let falhas = 0;
    for (;;) {
      try {
        const r = await salvar(g.atividadeId, g.dados, g.esperado);
        resultados[g.atividadeId] = r.ok ? "ok" : r.conflito ? "mudou" : r.erro;
        break;
      } catch {
        // Rede caiu: nunca desiste (mesma política dos cards).
        ambiente.registrar(chave, "falhou");
        const d = decidirRepeticao(falhas, ambiente.online());
        falhas = d.falhas;
        await ambiente.esperar(d.emMs);
      }
    }
    ambiente.registrar(chave, null);
  }
  return resultados;
}
