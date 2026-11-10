"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { formatarData } from "@/lib/dominio/formato";
import { urlCampo } from "@/lib/dominio/link";
import { gerarNovoLinkAcao, liberarTurnoAcao, type EstadoLink } from "./acoes";

type Props = {
  turnoId: string;
  obraNome: string;
  data: string;
  periodo: string;
  status: "planejado" | "em_campo" | "enviado" | "fechado";
};

/**
 * Fica sempre na mesma posição da página para manter o estado (e o token em claro)
 * quando o turno passa de planejado para em campo após a revalidação.
 */
export function PainelLink({ turnoId, obraNome, data, periodo, status }: Props) {
  const [estado, action, pendente] = useActionState<EstadoLink, FormData>(gerarNovoLinkAcao, null);
  const [estadoLiberar, liberar, liberando] = useActionState<EstadoLink, FormData>(liberarTurnoAcao, null);
  const [copia, setCopia] = useState<string | null>(null);
  // Último token válido, guardado à parte do último erro: uma falha ao gerar novo link não esconde o link ainda válido.
  const [token, setToken] = useState<string | undefined>(undefined);
  const [vistoGerar, setVistoGerar] = useState<EstadoLink>(null);
  const [vistoLiberar, setVistoLiberar] = useState<EstadoLink>(null);
  if (estado !== vistoGerar) {
    setVistoGerar(estado);
    if (estado?.ok && estado.dados.token) {
      setToken(estado.dados.token);
      setCopia(null);
    }
  }
  if (estadoLiberar !== vistoLiberar) {
    setVistoLiberar(estadoLiberar);
    if (estadoLiberar?.ok && estadoLiberar.dados.token) {
      setToken(estadoLiberar.dados.token);
      setCopia(null);
    }
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopia("Copiado!");
    } catch {
      setCopia("Não foi possível copiar");
    }
  }

  const url = token ? urlCampo(token) : null;
  const texto = url ? `Turno ${formatarData(data)} ${periodo} — ${obraNome}: ${url}` : "";

  if (status === "planejado") {
    return (
      <form action={liberar} className="flex flex-col gap-2">
        <input type="hidden" name="turno_id" value={turnoId} />
        <Botao type="submit" carregando={liberando}>
          Liberar para campo
        </Botao>
        {estadoLiberar && !estadoLiberar.ok && <Aviso tom="alerta">{estadoLiberar.erro}</Aviso>}
      </form>
    );
  }
  if (status === "fechado") return null;

  return (
    <Cartao className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-primaria">Link do encarregado</h2>
      {url ? (
        <>
          <p className="break-all rounded-botao bg-primaria-clara px-3 py-2 text-sm text-texto">{url}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="button" variante="secundario" onClick={() => copiar(url)}>
              Copiar link
            </Botao>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noopener"
              className={classesBotao("primario")}
            >
              Enviar pelo WhatsApp
            </a>
          </div>
          {copia && <p role="status" className="text-sm text-texto-suave">{copia}</p>}
          <p className="text-sm text-texto-suave">Guarde este link: ele não será exibido de novo.</p>
        </>
      ) : (
        <p className="text-texto-suave">Link enviado. Perdeu o link? Gere um novo (o anterior deixa de funcionar).</p>
      )}
      <form action={action}>
        <input type="hidden" name="turno_id" value={turnoId} />
        <Botao type="submit" variante="secundario" carregando={pendente}>
          Gerar novo link
        </Botao>
      </form>
      {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
    </Cartao>
  );
}
