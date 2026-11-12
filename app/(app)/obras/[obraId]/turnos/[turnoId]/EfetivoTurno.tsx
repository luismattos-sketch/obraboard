"use client";

import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import type { Efetivo } from "@/lib/db/turnos";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { corrigirEfetivo } from "./acoesExecucao";

/** Efetivo do planejador por equipe (check-in e correção). */
export function EfetivoTurno({
  turnoId,
  obraId,
  responsaveis,
  efetivo,
  opcoesFuncao,
  equipesIniciais,
}: {
  turnoId: string;
  obraId: string;
  responsaveis: ResponsavelRef[];
  efetivo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id">[];
  opcoesFuncao: string[];
  equipesIniciais: (string | null)[];
}) {
  return (
    <EfetivoPorEquipe
      obraId={obraId}
      responsaveis={responsaveis}
      efetivo={efetivo}
      opcoesFuncao={opcoesFuncao}
      equipesIniciais={equipesIniciais}
      salvar={(id, linhas, esperado) => corrigirEfetivo(turnoId, id, linhas, esperado)}
    />
  );
}
