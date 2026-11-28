"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import type { SemanaCiencia } from "@/lib/dominio/ciencia";
import { formatarData } from "@/lib/dominio/formato";
import { urlCiencia } from "@/lib/dominio/link";
import { somarDias } from "@/lib/dominio/programacao";
import { gerarLinkCienciaAcao } from "./acoesCiencia";

export const CONFIRMAR_NOVO_LINK_CIENCIA = "O link desta semana que já foi enviado ao cliente vai parar de funcionar";

/** Item 4.3: um link por semana para o fiscal do cliente dar ciência nos serviços extras. */
export function CienciaExtras({ obraId, obraNome, semanas }: { obraId: string; obraNome: string; semanas: SemanaCiencia[] }) {
  return (
    <Cartao id="ciencia-extras" className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="text-lg font-semibold text-primaria">Ciência do cliente nos serviços extras</h2>
      <p className="text-sm text-texto-suave">
        Um link por semana, sem login: o fiscal vê os extras com foto, HH e material e registra &quot;Ciente&quot; com o nome dele.
      </p>
      {semanas.length === 0 ? (
        <p className="text-sm text-texto-suave">Nenhum serviço extra nas últimas 12 semanas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda">
          {semanas.map((s) => (
            <LinhaSemana key={s.semana} obraId={obraId} obraNome={obraNome} s={s} />
          ))}
        </ul>
      )}
    </Cartao>
  );
}

function LinhaSemana({ obraId, obraNome, s }: { obraId: string; obraNome: string; s: SemanaCiencia }) {
  const [codigo, setCodigo] = useState<string | null>(s.codigo);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copia, setCopia] = useState<string | null>(null);
  const url = codigo ? urlCiencia(codigo) : null;
  const periodo = `${formatarData(s.semana).slice(0, 5)} a ${formatarData(somarDias(s.semana, 6)).slice(0, 5)}`;
  const mensagem = url ? `Serviços extras da obra ${obraNome} (semana de ${periodo}). Confira e registre a ciência: ${url}` : "";

  async function gerar() {
    if (codigo && !window.confirm(`${CONFIRMAR_NOVO_LINK_CIENCIA}. Continuar?`)) return;
    setGerando(true);
    setErro(null);
    setCopia(null);
    try {
      const r = await gerarLinkCienciaAcao(obraId, s.semana);
      if (r.ok) setCodigo(r.dados.codigo);
      else setErro(r.erro);
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar(u: string) {
    try {
      await navigator.clipboard.writeText(u);
      setCopia("Copiado!");
    } catch {
      setCopia("Não foi possível copiar");
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-texto">Semana de {periodo}</p>
        <p className="text-sm text-texto-suave">
          {s.extras} {s.extras === 1 ? "extra" : "extras"} · {s.cientes === s.extras ? "✓ todos com ciência" : `${s.cientes} com ciência`}
        </p>
      </div>
      {url && <p className="break-all rounded-botao bg-primaria-clara px-3 py-2 text-sm text-texto">{url}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {url && (
          <>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-12 items-center justify-center rounded-botao bg-operacional px-4 font-semibold text-white"
            >
              Enviar no WhatsApp
            </a>
            <Botao type="button" variante="secundario" onClick={() => void copiar(url)}>
              Copiar
            </Botao>
          </>
        )}
        <Botao type="button" variante={url ? "secundario" : "primario"} carregando={gerando} onClick={() => void gerar()}>
          {url ? "Gerar novo link" : "Gerar link"}
        </Botao>
      </div>
      {copia && <p role="status" className="text-sm text-texto-suave">{copia}</p>}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </li>
  );
}
