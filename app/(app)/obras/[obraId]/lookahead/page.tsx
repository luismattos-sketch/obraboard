import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { levadasPorItem, listarItensCronograma, ultimaImportacao } from "@/lib/db/cronograma";
import { obterObra } from "@/lib/db/obras";
import { obterSemana } from "@/lib/db/programacao";
import { itensDaSemana, mudouDesdeLevado, semanasDoLookahead } from "@/lib/dominio/cronograma";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData } from "@/lib/dominio/formato";
import { ROTULO_STATUS_SEMANA, statusExibido, TOM_STATUS_SEMANA } from "@/lib/dominio/programacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { FormItemManual } from "./FormItemManual";
import { ItemLookahead } from "./ItemLookahead";
import { SubirCronograma } from "./SubirCronograma";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);
const OPCOES = [3, 4, 5, 6] as const;

export default async function LookaheadPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ semanas?: string; removidos?: string }>;
}) {
  const { obraId } = await params;
  const sp = await searchParams;
  const n = (OPCOES as readonly number[]).includes(Number(sp.semanas)) ? (Number(sp.semanas) as 3 | 4 | 5 | 6) : 4;
  const comRemovidos = sp.removidos === "1";
  const c = await criarClienteServidor();
  const obra = await obterObra(c, obraId);
  if (!obra) notFound();

  const hoje = hojeSaoPaulo();
  const segundas = semanasDoLookahead(hoje, n);
  const [todos, levadas, ultima, semanas] = await Promise.all([
    listarItensCronograma(c, obraId, { incluirRemovidos: true }),
    levadasPorItem(c, obraId),
    ultimaImportacao(c, obraId),
    Promise.all(segundas.map((s) => obterSemana(c, obraId, s))),
  ]);
  const ocultos = todos.filter((i) => i.removido_em && !levadas.has(i.id));
  const itens = comRemovidos ? todos : todos.filter((i) => !ocultos.includes(i));
  const existentes = todos.filter((i) => i.origem === "importado");
  const link = (q: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const v = { semanas: n, removidos: comRemovidos ? "1" : undefined, ...q };
    for (const [k, x] of Object.entries(v)) if (x !== undefined) p.set(k, String(x));
    return `/obras/${obraId}/lookahead?${p}`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline">
          ← {obra.nome}
        </Link>
        <h1 className="text-titulo font-semibold text-primaria">Lookahead</h1>
        <p className="text-sm text-texto-suave">
          O que vem nas próximas semanas, para destravar antes de programar.
        </p>
      </div>

      <Cartao>
        <div className="flex flex-col gap-3">
          <nav aria-label="Quantas semanas" className="flex flex-wrap items-center gap-2 text-sm">
            {OPCOES.map((o) => (
              <Link key={o} href={link({ semanas: o })} aria-current={o === n ? "page" : undefined}
                className={`rounded-full px-3 py-1 font-semibold ${o === n ? "bg-primaria text-white" : "bg-fundo text-texto hover:bg-primaria-clara"}`}>
                {o}
              </Link>
            ))}
            <span className="text-texto-suave">semanas</span>
          </nav>
          <p className="text-sm text-texto-suave">
            {ultima
              ? `Última importação: ${ultima.arquivo_nome} em ${formatarData(ultima.created_at.slice(0, 10))} às ${new Date(ultima.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
              : "Nenhum cronograma importado — adicione itens à mão ou suba o arquivo do Project/Primavera em Excel ou CSV."}
          </p>
          <div className="flex flex-wrap gap-2">
            <SubirCronograma obraId={obraId} existentes={existentes} mapeamentoAnterior={ultima?.mapeamento ?? null} />
            <FormItemManual obraId={obraId} />
          </div>
        </div>
      </Cartao>

      {segundas.map((segunda, k) => {
        const s = semanas[k];
        const status = s ? statusExibido(s.status, s.inicio, hoje) : null;
        const daSemana = itensDaSemana(itens, segunda);
        const podeLevar = !s || s.status === "rascunho";
        return (
          <section key={segunda} aria-labelledby={`sem-${segunda}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`sem-${segunda}`} className="text-lg font-semibold">Semana de {diaMes(segunda)}</h2>
              {status ? <Selo tom={TOM_STATUS_SEMANA[status]}>{ROTULO_STATUS_SEMANA[status]}</Selo> : <Selo tom="neutro">Sem programação</Selo>}
            </div>
            {daSemana.length === 0 ? (
              <p className="text-sm text-texto-suave">Nada do cronograma nesta semana.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {daSemana.map((i) => {
                  const lev = levadas.get(i.id) ?? [];
                  return (
                    <li key={i.id}>
                      <ItemLookahead
                        obraId={obraId}
                        item={i}
                        segunda={segunda}
                        semanasLevadas={[...new Set(lev.map((l) => l.inicio))]}
                        mudou={mudouDesdeLevado(i, lev.at(-1)?.created_at ?? null)}
                        podeLevar={podeLevar}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {(ocultos.length > 0 || comRemovidos) && (
        <Link href={link({ removidos: comRemovidos ? undefined : "1" })} className="text-sm text-primaria hover:underline">
          {comRemovidos ? "Esconder removidos" : `Mostrar removidos (${ocultos.length})`}
        </Link>
      )}
    </div>
  );
}
