import Link from "next/link";
import { rotuloTempo } from "@/lib/clima/montar";
import type { ClimaTurno as Clima } from "@/lib/clima/tipos";
import { numeroBR } from "@/lib/dominio/formato";

export type AvisoClima = "sem_cidade" | "indisponivel" | null;

const graus = (n: number) => `${Math.round(n)}°`;
export const textoChuva = (c: Clima) => (c.choveu ? `Choveu · ${numeroBR(c.chuva_mm)} mm` : "Não choveu");

/** Clima automático do turno (Open-Meteo): média, chuva, máx/mín e leituras de 2 em 2h. */
export function ClimaTurno({
  clima, paradasClima, aviso = null, linkObra, parcial = false,
}: { clima: Clima | null; paradasClima: number; aviso?: AvisoClima; linkObra?: string; parcial?: boolean }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Clima">
      <h3 className="font-semibold text-texto">{parcial ? "Clima até agora" : "Clima"}</h3>
      {clima ? (
        <>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-4xl font-semibold text-primaria">{graus(clima.temp_media)}</p>
            <div className="text-sm">
              <p className="text-texto-suave">média do turno</p>
              <p className="font-medium text-texto">{textoChuva(clima)}</p>
              <p className="text-texto-suave">{`máx ${graus(clima.temp_max)} · mín ${graus(clima.temp_min)}`}</p>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
            {clima.leituras.map((l) => (
              <li key={l.hora} className="flex flex-col rounded-botao border border-borda px-2 py-1">
                <span className="font-medium text-texto">{`${l.hora.slice(11, 13)}h`}</span>
                <span className="text-texto-suave">{rotuloTempo(l.codigo)}</span>
                <span className="text-texto">{graus(l.temperatura)}</span>
                <span className="text-texto-suave">{`${numeroBR(l.chuva_mm)} mm`}</span>
              </li>
            ))}
          </ul>
        </>
      ) : aviso === "sem_cidade" ? (
        <p className="text-sm text-texto-suave">
          Clima automático indisponível — informe a cidade da obra.{" "}
          {linkObra && <Link href={linkObra} className="font-medium text-operacional underline">Informar cidade</Link>}
        </p>
      ) : (
        <p className="text-sm text-texto-suave">Clima indisponível agora.</p>
      )}
      {paradasClima > 0 && <p className="text-sm font-medium text-alerta-escura">{`Atividades paradas por clima: ${paradasClima}`}</p>}
      {clima && <p className="text-xs text-texto-suave">Dados: Open-Meteo</p>}
    </section>
  );
}
