"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { dataHoraCiencia, NOME_CIENCIA_MAX, type ExtraCiencia } from "@/lib/dominio/ciencia";
import { textoHHExtra, textoMateriais } from "@/lib/dominio/extraApontamento";
import { formatarData, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { registrarCienciaAcao } from "./acoes";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

export function ListaCiencia({ codigo, extras, fotos }: { codigo: string; extras: ExtraCiencia[]; fotos: Record<string, string> }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = extras.filter((e) => !e.ciencia);

  async function registrar(ids: string[], chave: string) {
    if (!nome.trim()) {
      setErro("Escreva seu nome e função antes de registrar.");
      return;
    }
    setEnviando(chave);
    setErro(null);
    try {
      const r = await registrarCienciaAcao(codigo, ids, nome);
      if (r.ok) router.refresh();
      else setErro(r.erro);
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  if (extras.length === 0) {
    return (
      <Cartao>
        <p className="text-texto-suave">Nenhum serviço extra lançado nesta semana.</p>
      </Cartao>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pendentes.length > 0 && (
        <Cartao className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Seu nome e função
            <input
              className={campo}
              maxLength={NOME_CIENCIA_MAX}
              placeholder="ex.: Marcos Lima, fiscal"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          {pendentes.length > 1 && (
            <Botao type="button" carregando={enviando === "todos"} onClick={() => void registrar(pendentes.map((e) => e.id), "todos")}>
              Ciente de todos ({pendentes.length})
            </Botao>
          )}
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
        </Cartao>
      )}
      <ul className="flex flex-col gap-3">
        {extras.map((e) => {
          const foto = e.foto_path ? fotos[e.foto_path] : undefined;
          return (
            <li key={e.id}>
              <Cartao className="flex flex-col gap-1">
                <p className="text-sm text-texto-suave">
                  {formatarData(e.data)} · {ROTULO_PERIODO[e.periodo]}
                  {e.responsavel ? ` · ${e.responsavel}` : ""}
                </p>
                <p className="font-medium text-texto">{e.descricao}</p>
                <p className="text-sm text-texto">
                  Feito: {numeroBR(e.qtd)} {e.unidade}
                  {e.local ? ` · ${e.local}` : ""}
                </p>
                {e.solicitado_por && <p className="text-sm text-texto">Pedido por: {e.solicitado_por}</p>}
                {textoHHExtra(e) && <p className="text-sm text-texto">{textoHHExtra(e)}</p>}
                {textoMateriais(e.materiais) && <p className="text-sm text-texto">Material: {textoMateriais(e.materiais)}</p>}
                {e.observacao && <p className="text-sm text-texto-suave">{e.observacao}</p>}
                {foto && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
                  <img src={foto} alt={`Foto: ${e.descricao}`} className="mt-1 max-h-72 w-full rounded-botao object-contain" />
                )}
                {e.ciencia ? (
                  <p className="mt-1 rounded-botao bg-sucesso-clara px-3 py-2 text-sm text-sucesso">
                    ✓ Ciente — {e.ciencia.nome}, {dataHoraCiencia(e.ciencia.ciente_em)}
                  </p>
                ) : (
                  <Botao
                    type="button"
                    variante="secundario"
                    carregando={enviando === e.id}
                    onClick={() => void registrar([e.id], e.id)}
                  >
                    Ciente
                  </Botao>
                )}
              </Cartao>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
