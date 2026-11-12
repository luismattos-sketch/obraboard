import { Expansivel } from "@/components/ui/Expansivel";
import { formatarData, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { ROTULO_DIAS, diaDaSemana, type BlocoPrevistoReal } from "@/lib/dominio/programacao";

const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));
const hh = (n: number | null) => (n === null ? "—" : `${numeroBR(Math.round(n * 10) / 10)} HH`);

export function PrevistoReal({ inicio, blocos }: { inicio: string; blocos: BlocoPrevistoReal[] }) {
  if (blocos.length === 0) return <p className="text-texto-suave">Sem equipe prevista nem turnos nesta semana.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {blocos.map((b) => {
        const dia = diaDaSemana(inicio, b.data);
        const totalPrev = b.funcoes.reduce((s, f) => s + f.previsto, 0);
        const totalReal = b.semTurno ? null : b.funcoes.reduce((s, f) => s + (f.real ?? 0), 0);
        return (
          <li key={`${b.data}-${b.periodo}`} className="rounded-botao border border-borda px-3 py-2">
            <Expansivel
              resumo={
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-texto">
                    {dia !== null ? ROTULO_DIAS[dia] : ""} {formatarData(b.data).slice(0, 5)} · {ROTULO_PERIODO[b.periodo]}
                  </span>
                  <span className="text-sm text-texto-suave">
                    {b.semTurno ? `previsto ${totalPrev} · sem turno` : `previsto ${totalPrev} · real ${totalReal}`}
                  </span>
                </span>
              }
            >
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-texto-suave">
                      <th className="py-1 pr-2 font-medium">Função</th>
                      <th className="py-1 pr-2 text-right font-medium">Previsto</th>
                      <th className="py-1 pr-2 text-right font-medium">Real</th>
                      <th className="py-1 text-right font-medium">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.funcoes.map((f) => (
                      <tr key={f.funcao} className="border-t border-borda">
                        <td className="py-1 pr-2">{f.funcao}</td>
                        <td className="py-1 pr-2 text-right">{f.previsto}</td>
                        <td className="py-1 pr-2 text-right">{f.real === null ? "sem turno" : f.real}</td>
                        <td className={`py-1 text-right ${f.diferenca !== null && f.diferenca < 0 ? "font-semibold text-alerta-escura" : ""}`}>
                          {f.diferenca === null ? "—" : sinal(f.diferenca)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-borda text-texto-suave">
                      <td className="py-1 pr-2">HH</td>
                      <td className="py-1 pr-2 text-right">{hh(b.hhPrevisto)}</td>
                      <td className="py-1 pr-2 text-right">{hh(b.hhReal)}</td>
                      <td className="py-1 text-right">
                        {b.hhPrevisto !== null && b.hhReal !== null ? sinal(Math.round((b.hhReal - b.hhPrevisto) * 10) / 10) : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Expansivel>
          </li>
        );
      })}
    </ul>
  );
}
