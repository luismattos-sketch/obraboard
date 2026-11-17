"use client";

import { useState } from "react";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { horaAgoraSaoPaulo } from "@/lib/dominio/entrada";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { CAUSAS, GRUPO_CAUSA, type Causa } from "@/lib/dominio/tipos";

/** Aviso de parada (aberta) ou parada já encerrada ("Já voltaram às"): o mesmo formulário no campo e no turno. */

export type FormParadaDados = {
  quantidade: string;
  funcao: string;
  causa: string;
  /** Equipe aguardada (só com "Aguardando outra equipe"). */
  aguardando: string;
  inicio: string;
  /** Vazio = parada aberta. */
  fim: string;
  observacao: string;
  /** Parada dos recebidos por empréstimo. */
  emprestimoId: string | null;
};

export function montarParada(f: FormParadaDados, id: string): DadosOcorrencia | string {
  const quantidade = Number(f.quantidade);
  if (!f.quantidade || !Number.isInteger(quantidade) || quantidade < 1) return "Informe a quantidade";
  if (!f.funcao) return "Escolha a função";
  if (!f.causa) return "Informe a causa";
  if (!f.inicio) return "Informe desde que horas";
  const aguardando = f.causa === "atividade_predecessora" ? f.aguardando || null : null;
  if (f.causa === "atividade_predecessora" && !aguardando) return "Escolha a equipe que vocês aguardam";
  return {
    id, tipo: "parado", funcao: f.funcao, quantidade, hora_inicio: f.inicio, hora_fim: f.fim || null,
    destino_responsavel_id: null, emprestimo_id: f.emprestimoId, causa: f.causa as Causa,
    observacao: f.observacao.trim() || null, aguardando_responsavel_id: aguardando,
  };
}

const campo =
  "min-h-12 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";
const botao =
  "min-h-12 rounded-botao border border-operacional bg-superficie px-3 font-semibold text-primaria hover:bg-primaria-clara";

export const rotuloCausa = (c: Causa) => `${CAUSAS[c]}${GRUPO_CAUSA[c] === "externa" ? " (externa)" : ""}`;

export function FormParada({
  responsavelId,
  funcoes,
  destinos,
  emprestimoId = null,
  inicial,
  enviar,
  cancelar,
}: {
  responsavelId: string | null;
  funcoes: string[];
  destinos: ResponsavelRef[];
  emprestimoId?: string | null;
  inicial?: Partial<FormParadaDados>;
  enviar: (f: FormParadaDados, foto: File | null) => void;
  cancelar: () => void;
}) {
  const [f, setF] = useState<FormParadaDados>(() => ({
    quantidade: "", funcao: funcoes[0] ?? "", causa: "", aguardando: "", inicio: horaAgoraSaoPaulo(), fim: "", observacao: "",
    emprestimoId, ...inicial,
  }));
  const [foto, setFoto] = useState<File | null>(null);
  const mudar = (p: Partial<FormParadaDados>) => setF((x) => ({ ...x, ...p }));
  const outras = destinos.filter((d) => d.id !== responsavelId && d.ativo);
  return (
    <form
      className="flex flex-col gap-2 rounded-botao border border-alerta p-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(f, foto);
      }}
    >
      <p className="font-semibold text-texto">⚠ Parada</p>
      <div className="flex gap-2">
        <input
          aria-label="Quantos parados"
          inputMode="numeric"
          maxLength={3}
          placeholder="Qtd"
          className={`${campo} w-20 text-center`}
          value={f.quantidade}
          onChange={(e) => mudar({ quantidade: e.target.value.replace(/\D/g, "") })}
        />
        {funcoes.length > 1 ? (
          <select aria-label="Função" className={`${campo} min-w-0 flex-1`} value={f.funcao} onChange={(e) => mudar({ funcao: e.target.value })}>
            {funcoes.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        ) : (
          <span className="flex min-h-12 items-center text-texto">{f.funcao}</span>
        )}
      </div>
      <select aria-label="Por quê?" className={campo} value={f.causa} onChange={(e) => mudar({ causa: e.target.value })}>
        <option value="">Por quê?</option>
        {(Object.keys(CAUSAS) as Causa[]).map((c) => (
          <option key={c} value={c}>{rotuloCausa(c)}</option>
        ))}
      </select>
      {f.causa === "atividade_predecessora" && (
        <select aria-label="Qual equipe vocês aguardam" className={campo} value={f.aguardando} onChange={(e) => mudar({ aguardando: e.target.value })}>
          <option value="">Qual equipe vocês aguardam?</option>
          {outras.map((d) => (
            <option key={d.id} value={d.id}>{d.nome}</option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-sm text-texto-suave">
          Desde
          <input type="time" className={campo} value={f.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        <label className="flex flex-col text-sm text-texto-suave">
          Já voltaram às (opcional)
          <input type="time" className={campo} value={f.fim} onChange={(e) => mudar({ fim: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col text-sm text-texto-suave">
        Observação (opcional)
        <textarea
          maxLength={500}
          rows={2}
          className={`${campo} py-2`}
          value={f.observacao}
          onChange={(e) => mudar({ observacao: e.target.value })}
        />
      </label>
      <label className="flex flex-col text-sm text-texto-suave">
        📷 Foto (opcional)
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="text-base text-texto"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={`${botao} flex-1`}>Registrar parada</button>
        <button type="button" className="min-h-12 rounded-botao px-3 text-texto-suave underline" onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  );
}
