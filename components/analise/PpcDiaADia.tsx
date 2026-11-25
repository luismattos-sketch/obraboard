import { formatarPercentual } from "@/lib/dominio/formato";
import { farol, type DiaPpc, type Farol } from "@/lib/dominio/ppcMes";

const COR_FAROL: Record<Farol, string> = { verde: "bg-sucesso", amarelo: "bg-alerta", vermelho: "bg-perigo" };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Barra por dia do período com farol; rótulo dd/mm a cada segunda-feira (o período começa numa segunda). */
export function PpcDiaADia({ dias }: { dias: DiaPpc[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="ppc-dia-a-dia">
      <ol className="flex h-28 items-end gap-px" aria-label="PPC de cada dia do período">
        {dias.map((d, i) => {
          const f = farol(d.ppc);
          const rotulo = d.ppc === null ? `${ddmm(d.data)}: sem turno fechado` : `${ddmm(d.data)}: ${formatarPercentual(d.ppc)} (${d.concluidas} de ${d.total})`;
          return (
            <li key={d.data} title={rotulo} aria-label={rotulo} className="relative flex h-full min-w-0 flex-1 flex-col justify-end pb-4">
              <div className={`w-full rounded-t-sm ${f ? COR_FAROL[f] : "bg-borda"}`} style={{ height: d.ppc === null ? "2px" : `${Math.max(d.ppc * 100, 4)}%` }} />
              {i % 7 === 0 && <span className="absolute bottom-0 left-0 whitespace-nowrap text-[10px] leading-none text-texto-suave">{ddmm(d.data)}</span>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-texto-suave">Só turnos fechados · verde ≥ 80% · amarelo 60–79% · vermelho &lt; 60% · serviço extra não entra</p>
    </div>
  );
}
