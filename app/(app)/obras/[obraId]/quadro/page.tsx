import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtualizarPeriodicamente } from "@/components/quadro/AtualizarPeriodicamente";
import { prepararQuadro } from "@/components/quadro/prepararQuadro";
import { Quadro } from "@/components/quadro/Quadro";
import { Cartao } from "@/components/ui/Cartao";
import { obterObra } from "@/lib/db/obras";
import { listarProblemas } from "@/lib/db/problemas";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { GerenciarProblemas } from "./GerenciarProblemas";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function QuadroPlanejador({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const [{ obraId }, busca] = await Promise.all([params, searchParams]);
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const [q, problemas, responsaveis] = await Promise.all([
    prepararQuadro(supabase, obra.id, busca, `/obras/${obra.id}/quadro`),
    listarProblemas(supabase, obra.id),
    listarResponsaveis(supabase, obra.id),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/obras/${obra.id}`} className="text-sm text-operacional underline">← {obra.nome}</Link>
        <BotaoAjuda tela="quadro" />
      </div>
      {q ? (
        <>
          <Quadro {...q.props} publico={false} editarHref={`/obras/${obra.id}/turnos/${q.turnoId}`} />
          <AtualizarPeriodicamente />
        </>
      ) : (
        <Cartao><p className="text-texto-suave">Nenhum turno ainda</p></Cartao>
      )}
      <GerenciarProblemas
        obraId={obra.id}
        problemas={problemas}
        sugestoes={responsaveis.filter((r) => r.ativo).map((r) => r.nome)}
        hoje={hojeSaoPaulo()}
      />
    </div>
  );
}
