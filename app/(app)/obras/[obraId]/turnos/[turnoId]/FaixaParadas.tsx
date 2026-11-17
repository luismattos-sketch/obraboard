"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { horaCurta, linhaOcorrencia, type Ocorrencia, type Terminado } from "@/lib/dominio/efetivoHH";
import { paradasDoTurnoAcao } from "./acoesExecucao";

const INTERVALO_MS = 30_000;

/** Só a apresentação (testável sem servidor). */
export function FaixaParadasVisao({
  abertas,
  terminados,
  nome,
  mudou,
  atualizar,
}: {
  abertas: Ocorrencia[];
  terminados: Terminado[];
  nome: (id: string | null) => string;
  /** Algo mudou desde que a página abriu: os números abaixo podem estar velhos. */
  mudou: boolean;
  atualizar?: () => void;
}) {
  if (abertas.length === 0 && terminados.length === 0 && !mudou) return null;
  return (
    <section aria-label="Paradas do turno" className="flex flex-col gap-2">
      {abertas.map((o) => (
        <p key={o.id} role="alert" className="rounded-cartao border-2 border-perigo bg-perigo/5 p-3 font-semibold text-texto">
          ⚠ {linhaOcorrencia(o, nome)}
        </p>
      ))}
      {terminados.length > 0 && (
        <p className="text-sm text-texto">
          {terminados.map((t) => `✓ ${nome(t.responsavel_id)} terminou às ${horaCurta(t.terminou_em)}`).join(" · ")}
        </p>
      )}
      {mudou && (
        <button type="button" className="self-start text-sm text-operacional underline" onClick={atualizar}>
          Houve mudança no campo · Atualizar números
        </button>
      )}
    </section>
  );
}

const assinatura = (a: Ocorrencia[], t: Terminado[]) =>
  JSON.stringify([a.map((o) => o.id).sort(), t.map((x) => `${x.responsavel_id}@${x.terminou_em}`).sort()]);

/**
 * Faixa do turno do planejador: consulta só as paradas abertas e os "terminei" a cada 30 s (aba visível),
 * sem recarregar a página — nada do que o planejador está digitando se perde.
 */
export function FaixaParadas({
  turnoId,
  abertas: abertasIniciais,
  terminados: terminadosIniciais,
  responsaveis,
}: {
  turnoId: string;
  abertas: Ocorrencia[];
  terminados: Terminado[];
  responsaveis: { id: string; nome: string }[];
}) {
  const router = useRouter();
  // A página recarregada (router.refresh) traz dados novos: viram a nova base de comparação.
  const base = assinatura(abertasIniciais, terminadosIniciais);
  const [estado, setEstado] = useState({ base, dados: { abertas: abertasIniciais, terminados: terminadosIniciais } });
  if (estado.base !== base) setEstado({ base, dados: { abertas: abertasIniciais, terminados: terminadosIniciais } });
  const dados = estado.dados;
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await paradasDoTurnoAcao(turnoId);
        if (r.ok) setEstado((e) => ({ ...e, dados: r.dados }));
      } catch {
        // sem rede: tenta no próximo ciclo
      }
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [turnoId]);
  const nome = (id: string | null) => (id === null ? "Sem responsável" : (responsaveis.find((r) => r.id === id)?.nome ?? "Responsável removido"));
  return (
    <FaixaParadasVisao
      abertas={dados.abertas}
      terminados={dados.terminados}
      nome={nome}
      mudou={assinatura(dados.abertas, dados.terminados) !== estado.base}
      atualizar={() => router.refresh()}
    />
  );
}
