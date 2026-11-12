"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { Atividade } from "@/lib/db/atividades";
import type { Clima, Efetivo } from "@/lib/db/turnos";
import { errosDeCausa } from "@/lib/dominio/regras";
import { horaCurta } from "@/lib/dominio/formato";
import type { StatusTurno } from "@/lib/dominio/tipos";
import { enviarTurno, limparClima, salvarClima, salvarEfetivo, salvarExecucao, salvarHorarioReal } from "./acoes";
import { ProvedorSalvamento, useRastreioSalvamento } from "@/components/execucao/rastreioSalvamento";
import { BlocoAtividades, useExecucaoLocal } from "@/components/execucao/BlocoAtividades";
import { BlocoClima } from "@/components/execucao/BlocoClima";
import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import { ordenarPorResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
import { BlocoHorario } from "@/components/execucao/BlocoHorario";

export type DadosTurnoCampo = {
  status: StatusTurno;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  atividades: Atividade[];
  efetivo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id">[];
  clima: Clima[];
};

export function FormularioCampo({
  token,
  turno,
  opcoesFuncao,
  responsaveis = [],
  responsavelId = null,
}: {
  token: string;
  turno: DadosTurnoCampo;
  opcoesFuncao: string[];
  responsaveis?: ResponsavelRef[];
  /** Responsável escolhido no link (null = "Ver tudo"): sem botão Enviar. */
  responsavelId?: string | null;
}) {
  const agrupar = responsavelId === null && turno.atividades.some((a) => a.responsavel_id !== null);
  const ordenadas = agrupar ? ordenarPorResponsavel(turno.atividades, responsaveis) : turno.atividades;
  const nomeDe = (id: string | null) => (id === null ? null : (responsaveis.find((r) => r.id === id)?.nome ?? "—"));
  const somenteLeitura = turno.status !== "em_campo" && turno.status !== "enviado";
  const { lista: atividades, mudar } = useExecucaoLocal(turno.atividades);
  const [status, setStatus] = useState<StatusTurno>(turno.status);
  const { ocupado: salvando, registrar } = useRastreioSalvamento();
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const erros = errosDeCausa(atividades);
  const pendentes = atividades.filter((a) => erros[a.id]);

  async function enviar() {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarTurno(token);
      if (r.ok) setStatus(r.dados.status);
      else setErroEnvio(r.erro);
    } catch {
      setErroEnvio("Sem conexão — tente enviar de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ProvedorSalvamento registrar={registrar}>
    <div className="flex flex-col gap-8">
      <BlocoHorario
        inicio={horaCurta(turno.hora_inicio_real)}
        fim={horaCurta(turno.hora_fim_real)}
        somenteLeitura={somenteLeitura}
        salvar={(d) => salvarHorarioReal(token, d)}
      />
      <BlocoAtividades
        atividades={ordenadas}
        grupoDe={agrupar ? (a) => nomeDe(a.responsavel_id) : undefined}
        somenteLeitura={somenteLeitura}
        salvar={(id, d) => salvarExecucao(token, id, d, responsavelId)}
        onMudar={mudar}
        erros={erros}
      />
      <EfetivoPorEquipe
        obraId=""
        responsaveis={responsaveis}
        efetivo={turno.efetivo}
        opcoesFuncao={opcoesFuncao}
        somenteLeitura={somenteLeitura}
        adicionarEquipe={false}
        equipesIniciais={responsavelId !== null ? [responsavelId] : [...new Set(turno.atividades.map((a) => a.responsavel_id))]}
        salvar={(id, l, esperado) => salvarEfetivo(token, l, esperado, id)}
      />
      <BlocoClima inicial={turno.clima} somenteLeitura={somenteLeitura} salvar={(d) => salvarClima(token, d)}
        limpar={(p) => limparClima(token, p)}
      />

      {!somenteLeitura && responsavelId !== null && (
        <section className="pb-8">
          <Aviso tom="info">Terminou? Avise o planejador.</Aviso>
        </section>
      )}
      {!somenteLeitura && responsavelId === null && (
        <section className="flex flex-col gap-3 pb-8">
          {pendentes.length > 0 && (
            <Aviso tom="alerta">
              <p className="font-medium">Falta informar a causa em:</p>
              <ul className="list-disc pl-5">
                {pendentes.map((a) => (
                  <li key={a.id}>{a.descricao}</li>
                ))}
              </ul>
            </Aviso>
          )}
          {erroEnvio && <Aviso tom="perigo">{erroEnvio}</Aviso>}
          {status === "enviado" && (
            <Aviso tom="sucesso">Turno enviado ✓ — você ainda pode corrigir até o planejador fechar</Aviso>
          )}
          <Botao type="button" onClick={enviar} disabled={pendentes.length > 0 || salvando} carregando={enviando}>
            {salvando ? "Salvando…" : status === "enviado" ? "Reenviar turno" : "Enviar turno"}
          </Botao>
        </section>
      )}
    </div>
    </ProvedorSalvamento>
  );
}
