import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { statusAtividade } from "@/lib/dominio/calculos";
import { dataBR, horaCurta, numeroBR, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_ATIVIDADE, ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { ListaAtividades } from "./ListaAtividades";
import { PainelLink } from "./PainelLink";

export default async function TurnoPage({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const turno = await obterTurnoCompleto(await criarClienteServidor(), turnoId);
  if (!turno || turno.obra_id !== obraId) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/obras/${obraId}`} className="text-sm text-primaria underline">← {turno.obra.nome}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-primaria">
          Turno {ROTULO_PERIODO[turno.periodo].toLowerCase()} de {dataBR(turno.data)}
        </h1>
        <Selo tom={TOM_STATUS_TURNO[turno.status]}>{ROTULO_STATUS_TURNO[turno.status]}</Selo>
      </div>
      {turno.hora_inicio_prevista && turno.hora_fim_prevista && (
        <p className="text-sm text-texto-suave">
          Previsto: {horaCurta(turno.hora_inicio_prevista)} às {horaCurta(turno.hora_fim_prevista)}
        </p>
      )}

      <PainelLink
        turnoId={turno.id}
        obraId={obraId}
        obraNome={turno.obra.nome}
        data={turno.data}
        periodo={ROTULO_PERIODO[turno.periodo].toLowerCase()}
        status={turno.status}
      />

      {turno.status === "planejado" ? (
        <ListaAtividades turnoId={turno.id} atividades={turno.atividades} />
      ) : (
        <>
          <Aviso tom="info">Resumo do turno disponível em breve</Aviso>
          <Cartao>
            <ul className="divide-y divide-borda">
              {turno.atividades.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium text-texto">{a.descricao}</p>
                    <p className="text-sm text-texto-suave">
                      {a.local ? `${a.local} · ` : ""}
                      {numeroBR(a.qtd_realizada ?? 0)} / {numeroBR(a.qtd_planejada)} {a.unidade}
                    </p>
                  </div>
                  <Selo tom="neutro">{ROTULO_STATUS_ATIVIDADE[statusAtividade(a.qtd_planejada, a.qtd_realizada)]}</Selo>
                </li>
              ))}
            </ul>
          </Cartao>
        </>
      )}
    </div>
  );
}
