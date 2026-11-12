"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { urlQuadro } from "@/lib/dominio/link";
import { gerarLinkQuadroAcao } from "./acoesQuadro";

export const CONFIRMAR_NOVO_LINK = "O link atual vai parar de funcionar";

/** "Link do quadro (TV / gestor)": o código só aparece logo após gerar (o banco guarda só o hash). */
export function LinkQuadro({ obraId, existe }: { obraId: string; existe: boolean }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copia, setCopia] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const temLink = existe || codigo !== null;
  const url = codigo ? urlQuadro(codigo) : null;

  async function gerar() {
    if (temLink && !window.confirm(`${CONFIRMAR_NOVO_LINK}. Continuar?`)) return;
    setGerando(true);
    setErro(null);
    setCopia(null);
    try {
      const r = await gerarLinkQuadroAcao(obraId);
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
    <Cartao className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-primaria">Link do quadro (TV / gestor)</h2>
      <p className="text-sm text-texto-suave">Só leitura, sem login. Mostra sempre o turno de agora e se atualiza sozinho.</p>
      {url ? (
        <>
          <p className="break-all rounded-botao bg-primaria-clara px-3 py-2 text-sm text-texto">{url}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="button" variante="secundario" onClick={() => copiar(url)}>Copiar</Botao>
            <a href={url} target="_blank" rel="noopener" className={classesBotao("primario")}>Abrir</a>
          </div>
          {copia && <p role="status" className="text-sm text-texto-suave">{copia}</p>}
          <p className="text-sm text-texto-suave">Guarde este link: ele não será exibido de novo.</p>
        </>
      ) : (
        temLink && <p className="text-texto-suave">Link já gerado. Perdeu o link? Gere um novo (o anterior deixa de funcionar).</p>
      )}
      <Botao type="button" variante={temLink ? "secundario" : "primario"} carregando={gerando} onClick={() => void gerar()}>
        {temLink ? "Gerar novo link" : "Gerar link"}
      </Botao>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </Cartao>
  );
}
