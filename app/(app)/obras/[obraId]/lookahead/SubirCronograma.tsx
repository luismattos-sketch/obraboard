"use client";

import { useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { decodificarTexto, lerCsv, lerXlsx } from "@/lib/dominio/arquivoCronograma";
import {
  adivinharMapeamento,
  CAMPOS_OBRIGATORIOS,
  lerLinhas,
  MAX_BYTES,
  MAX_LINHAS,
  planoReimportacao,
  ROTULO_CAMPO,
  type Campo,
  type ItemCronograma,
  type Mapeamento,
} from "@/lib/dominio/cronograma";
import { importarCronogramaAcao } from "./acoes";

const CAMPOS: Campo[] = ["codigo", "descricao", "inicio", "fim", "local", "quantidade", "unidade"];
const GRANDE = "Arquivo grande demais (máx. 5 MB / 5.000 linhas).";

/** Mesmo cabeçalho da última importação: reaproveita a escolha de colunas. */
const mapeamentoInicial = (cab: string[], anterior: Mapeamento | null): Mapeamento => {
  const adivinhado = adivinharMapeamento(cab);
  if (!anterior) return adivinhado;
  const cabe = Object.values(anterior).every((i) => i === undefined || i < cab.length);
  return cabe ? anterior : adivinhado;
};

export function SubirCronograma({
  obraId,
  existentes,
  mapeamentoAnterior,
}: {
  obraId: string;
  existentes: ItemCronograma[];
  mapeamentoAnterior: Mapeamento | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<{ nome: string; linhas: unknown[][] } | null>(null);
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const cabecalho = useMemo(() => (arquivo?.linhas[0] ?? []).map((c) => String(c ?? "").trim()), [arquivo]);
  const leitura = useMemo(() => (arquivo ? lerLinhas(arquivo.linhas.slice(1), mapa) : null), [arquivo, mapa]);
  const faltaCampo = CAMPOS_OBRIGATORIOS.some((c) => mapa[c] === undefined);
  const plano = leitura && !faltaCampo ? planoReimportacao(existentes, leitura.itens) : null;

  async function escolher(f: File | undefined) {
    setErro(null);
    setSucesso(null);
    setArquivo(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setErro(GRANDE);
    try {
      const linhas = /\.xlsx$/i.test(f.name)
        ? await lerXlsx(f)
        : lerCsv(decodificarTexto(new Uint8Array(await f.arrayBuffer())));
      if (linhas.length < 2) return setErro("O arquivo não tem linhas além do cabeçalho.");
      if (linhas.length - 1 > MAX_LINHAS) return setErro(GRANDE);
      setArquivo({ nome: f.name, linhas });
      setMapa(mapeamentoInicial(linhas[0].map((c) => String(c ?? "").trim()), mapeamentoAnterior));
    } catch {
      setErro("Não foi possível ler o arquivo. Exporte do Project/Primavera em Excel (.xlsx) ou CSV.");
    }
  }

  function confirmar() {
    if (!arquivo || !leitura) return;
    iniciar(async () => {
      const r = await importarCronogramaAcao(obraId, arquivo.nome, mapa, leitura.itens);
      if (!r.ok) return setErro(r.erro);
      setSucesso(r.dados);
      setArquivo(null);
      setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <div className="flex flex-col gap-2">
        <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>Subir cronograma</Botao>
        {sucesso && <Aviso tom="sucesso">{sucesso}</Aviso>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-botao border border-borda p-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Arquivo do cronograma (.xlsx ou .csv)
        <input type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => escolher(e.target.files?.[0])}
          className="text-sm font-normal" />
      </label>
      <p className="text-sm text-texto-suave">
        No Project ou Primavera, exporte para Excel com código (EDT/Id), nome, início e término. Local, quantidade e unidade são opcionais.
      </p>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}

      {arquivo && leitura && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CAMPOS.map((campo) => (
              <label key={campo} className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">
                  {ROTULO_CAMPO[campo]}{CAMPOS_OBRIGATORIOS.includes(campo) ? "" : " (opcional)"}
                </span>
                <select
                  value={mapa[campo] ?? ""}
                  onChange={(e) => setMapa({ ...mapa, [campo]: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="min-h-12 rounded-botao border border-borda bg-white px-3">
                  <option value="">— nenhuma —</option>
                  {cabecalho.map((c, i) => (
                    <option key={i} value={i}>{c || `Coluna ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {leitura.itens.length > 0 && !faltaCampo && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-texto-suave">
                    <th className="pr-2">Código</th><th className="pr-2">Descrição</th><th className="pr-2">Início</th><th>Término</th>
                  </tr>
                </thead>
                <tbody>
                  {leitura.itens.slice(0, 5).map((i) => (
                    <tr key={i.codigo}>
                      <td className="pr-2">{i.codigo}</td><td className="pr-2">{i.descricao}</td>
                      <td className="pr-2">{i.inicio.split("-").reverse().join("/")}</td><td>{i.fim.split("-").reverse().join("/")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {plano && (
            <p className="text-sm font-semibold">
              {plano.novos} novos · {plano.atualizados} atualizados · {plano.removidos} saem do cronograma
            </p>
          )}
          {leitura.ignoradas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">{leitura.ignoradas.length} linhas ignoradas</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-texto-suave">
                {leitura.ignoradas.map((g) => (
                  <li key={g.linha}>linha {g.linha}: {g.motivo}</li>
                ))}
              </ul>
            </details>
          )}
          {faltaCampo && <Aviso tom="alerta">Escolha as colunas de código, descrição, início e término.</Aviso>}
        </>
      )}

      <div className="flex gap-2">
        <Botao type="button" onClick={confirmar} carregando={pendente}
          disabled={!arquivo || faltaCampo || !leitura || leitura.itens.length === 0}>
          Confirmar importação
        </Botao>
        <Botao type="button" variante="discreto" onClick={() => { setAberto(false); setArquivo(null); setErro(null); }}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
