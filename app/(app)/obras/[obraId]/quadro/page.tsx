import { redirect } from "next/navigation";
import { linkQuadro } from "@/lib/db/quadro";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** O quadro é só o link público (/q/<código>): esta rota antiga leva até ele (mantendo ?turno=), ou ao cartão que gera o link. */
export default async function QuadroAntigo({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ turno?: string | string[] }>;
}) {
  const [{ obraId }, { turno }] = await Promise.all([params, searchParams]);
  const { codigo } = await linkQuadro(await criarClienteServidor(), obraId);
  if (!codigo) redirect(`/obras/${obraId}#link-quadro`);
  redirect(typeof turno === "string" ? `/q/${codigo}?turno=${encodeURIComponent(turno)}` : `/q/${codigo}`);
}
