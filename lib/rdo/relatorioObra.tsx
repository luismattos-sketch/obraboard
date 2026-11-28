import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { dataHoraCiencia } from "@/lib/dominio/ciencia";
import { textoHHExtra, textoMateriais } from "@/lib/dominio/extraApontamento";
import { formatarData, formatarPercentual, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { GrupoHH } from "@/lib/dominio/hhPerdido";
import type { RelatorioObra } from "@/lib/dominio/relatorioObra";
import { logoFrentia } from "./documento";
import { estilos as s } from "./estilos";
import { dataHoraBrasilia, nomeCabecalho } from "./formatar";
import { sanitizarProfundo } from "./texto";

/** Item 4.4: Relatório da Obra em PDF. Só turnos fechados; texto neutro, cada número com a sua origem. */

export const MAX_FOTOS_RELATORIO = 24;

export type CabecalhoRelatorio = {
  obraNome: string;
  cliente: string | null;
  empresaNome: string | null;
  periodo: string;
  geradoEm: Date;
};

export type FotoRelatorio = { caminho: string; legenda: string };

const GRUPO: Record<GrupoHH, string> = { externa: "Externa", interna: "Interna", outra: "Outra" };
const hh = (n: number | null) => (n === null ? "—" : numeroBR(Math.round(n * 10) / 10));
const quando = (data: string, periodo: keyof typeof ROTULO_PERIODO) => `${formatarData(data)} · ${ROTULO_PERIODO[periodo]}`;

/** Fotos do relatório: extras primeiro, depois paradas, no limite de MAX_FOTOS_RELATORIO. */
export function fotosDoRelatorio(r: RelatorioObra): { fotos: FotoRelatorio[]; fora: number } {
  const todas: FotoRelatorio[] = [
    ...r.extras.filter((e) => e.foto_path).map((e) => ({ caminho: e.foto_path!, legenda: `Extra · ${quando(e.data, e.periodo)} · ${e.descricao}` })),
    ...r.paradas.filter((p) => p.foto_path).map((p) => ({ caminho: p.foto_path!, legenda: `Parada · ${quando(p.data, p.periodo)} · ${p.equipe} · ${p.causa}` })),
  ];
  return { fotos: todas.slice(0, MAX_FOTOS_RELATORIO), fora: Math.max(0, todas.length - MAX_FOTOS_RELATORIO) };
}

function Metrica({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <View style={s.metrica}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.metricaValor}>{valor}</Text>
      {detalhe && <Text style={s.suave}>{detalhe}</Text>}
    </View>
  );
}

function Cab({ colunas }: { colunas: [string, string, boolean?][] }) {
  return (
    <View style={s.linhaCab} fixed>
      {colunas.map(([t, w, dir]) => (
        <Text key={t} style={[s.celula, dir ? s.direita : {}, { width: w }]}>{t}</Text>
      ))}
    </View>
  );
}

export function DocumentoRelatorioObra(props: {
  cabecalho: CabecalhoRelatorio;
  relatorio: RelatorioObra;
  fotos: FotoRelatorio[];
  fotosFora: number;
  bytes: Record<string, Uint8Array>;
}) {
  const cab = sanitizarProfundo(props.cabecalho);
  const r = sanitizarProfundo(props.relatorio);
  const fotos = sanitizarProfundo(props.fotos).filter((f) => props.bytes[f.caminho]);
  const img = logoFrentia();
  const empresa = nomeCabecalho(cab.empresaNome);
  const externo = r.grupos.find((g) => g.grupo === "externa")?.hh ?? 0;
  const interno = r.grupos.find((g) => g.grupo === "interna")?.hh ?? 0;

  return (
    <Document title={`Relatório da Obra — ${cab.obraNome} — ${cab.periodo}`} author="Frentia" creator="Frentia">
      <Page size="A4" style={s.pagina}>
        <View style={s.cabecalhoFixo} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {img ? <Image src={{ data: img, format: "png" }} style={s.logo} /> : <Text style={s.tituloFixo}>Frentia</Text>}
          {empresa && <Text style={s.empresaFixo}>{empresa}</Text>}
          <Text style={s.tituloFixo}>{`Relatório da Obra · ${cab.obraNome}`}</Text>
        </View>

        <Text style={s.titulo}>Relatório da Obra</Text>
        <Text style={[s.valor, s.negrito, s.item]}>{cab.obraNome}{cab.cliente ? ` · Cliente: ${cab.cliente}` : ""}</Text>
        <Text style={s.item}>{cab.periodo}</Text>
        <Text style={[s.item, s.suave]}>
          {`Gerado em ${dataHoraBrasilia(cab.geradoEm)} (horário de Brasília). Considera só turnos fechados; HH = pessoas × horas, sem o intervalo de refeição.`}
        </Text>

        {r.turnos === 0 ? (
          <Text style={[s.item, { marginTop: 12 }]}>Nenhum turno fechado no período.</Text>
        ) : (
          <>
            <Text style={s.secao}>Resumo do período</Text>
            <View style={s.metricas}>
              <Metrica rotulo="Turnos fechados" valor={String(r.turnos)} />
              <Metrica rotulo="Cumprimento" valor={formatarPercentual(r.cumprimento)} detalhe={`${r.concluidas} de ${r.total} atividades programadas`} />
              <Metrica rotulo="HH total" valor={hh(r.hh)} />
            </View>
            <View style={[s.metricas, { marginTop: 8 }]}>
              <Metrica rotulo="HH parado" valor={hh(r.hhParado)} detalhe={`externas ${hh(externo)} · internas ${hh(interno)}`} />
              <Metrica rotulo="Serviços extras" valor={String(r.extras.length)} detalhe={`${hh(r.hhExtra)} HH apontados · ${r.extrasComCiencia} com ciência do cliente`} />
            </View>

            <Text style={s.secao}>Linha do tempo</Text>
            <Cab colunas={[["Turno", "28%"], ["Cumprimento", "18%", true], ["HH", "12%", true], ["HH parado", "14%", true], ["Paradas", "14%", true], ["Extras", "14%", true]]} />
            {r.linhaDoTempo.map((l, i) => (
              <View key={`${l.data}-${l.periodo}`} style={[s.linha, i % 2 ? s.linhaZebra : {}]} wrap={false}>
                <Text style={[s.celula, { width: "28%" }]}>{quando(l.data, l.periodo)}</Text>
                <Text style={[s.celula, s.direita, { width: "18%" }]}>{`${formatarPercentual(l.cumprimento)} (${l.concluidas}/${l.total})`}</Text>
                <Text style={[s.celula, s.direita, { width: "12%" }]}>{hh(l.hh)}</Text>
                <Text style={[s.celula, s.direita, { width: "14%" }]}>{l.hhParado ? hh(l.hhParado) : "—"}</Text>
                <Text style={[s.celula, s.direita, { width: "14%" }]}>{l.paradas || "—"}</Text>
                <Text style={[s.celula, s.direita, { width: "14%" }]}>{l.extras || "—"}</Text>
              </View>
            ))}

            <Text style={s.secao}>Paradas e HH perdido</Text>
            {r.paradas.length === 0 ? (
              <Text style={s.suave}>Nenhuma parada registrada no período.</Text>
            ) : (
              <>
                {r.hhPorCausa.map((c) => (
                  <Text key={c.causa} style={s.item}>
                    {`${c.rotulo} (${GRUPO[c.grupo].toLowerCase()}): ${hh(c.hh)} HH · ${formatarPercentual(c.fracao)}`}
                  </Text>
                ))}
                <Cab colunas={[["Turno", "20%"], ["Horário", "12%"], ["Equipe", "18%"], ["Pessoas", "16%"], ["Causa", "18%"], ["Grupo", "16%"]]} />
                {r.paradas.map((p, i) => (
                  <View key={`${p.data}-${p.inicio}-${i}`} style={[s.linha, i % 2 ? s.linhaZebra : {}]} wrap={false}>
                    <Text style={[s.celula, { width: "20%" }]}>{quando(p.data, p.periodo)}</Text>
                    <Text style={[s.celula, { width: "12%" }]}>{`${p.inicio}–${p.fim ?? "fim"}`}</Text>
                    <Text style={[s.celula, { width: "18%" }]}>{p.equipe}</Text>
                    <Text style={[s.celula, { width: "16%" }]}>{`${p.pessoas} ${p.funcao}`}</Text>
                    <Text style={[s.celula, { width: "18%" }]}>{p.observacao ? `${p.causa} — ${p.observacao}` : p.causa}</Text>
                    <Text style={[s.celula, { width: "16%" }]}>{GRUPO[p.grupo]}</Text>
                  </View>
                ))}
                <Text style={[s.suave, { marginTop: 4 }]}>Externa = fora do controle da equipe (material, projeto, clima, liberação de área, outra equipe, segurança).</Text>
              </>
            )}

            <Text style={s.secao}>Serviços extras (para medição)</Text>
            {r.extras.length === 0 ? (
              <Text style={s.suave}>Nenhum serviço extra no período.</Text>
            ) : (
              <>
                <Cab colunas={[["Turno", "16%"], ["Serviço", "26%"], ["Feito", "10%", true], ["HH e material", "26%"], ["Pedido / ciência", "22%"]]} />
                {r.extras.map((e, i) => (
                  <View key={`${e.data}-${i}`} style={[s.linha, i % 2 ? s.linhaZebra : {}]} wrap={false}>
                    <Text style={[s.celula, { width: "16%" }]}>{quando(e.data, e.periodo)}</Text>
                    <Text style={[s.celula, { width: "26%" }]}>{[e.descricao, e.local, e.equipe].filter(Boolean).join(" · ")}</Text>
                    <Text style={[s.celula, s.direita, { width: "10%" }]}>{`${numeroBR(e.qtd)} ${e.unidade}`}</Text>
                    <Text style={[s.celula, { width: "26%" }]}>
                      {[textoHHExtra(e), textoMateriais(e.materiais) ? `Material: ${textoMateriais(e.materiais)}` : null].filter(Boolean).join(" · ") || "—"}
                    </Text>
                    <Text style={[s.celula, { width: "22%" }]}>
                      {[
                        e.solicitado_por ? `Pedido por: ${e.solicitado_por}` : null,
                        e.ciencia ? `Ciente: ${e.ciencia.nome}, ${dataHoraCiencia(e.ciencia.ciente_em)}` : "Ciência pendente",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                ))}
                <Text style={[s.negrito, { marginTop: 4 }]}>{`Total apontado em serviços extras: ${hh(r.hhExtra)} HH`}</Text>
              </>
            )}

            {fotos.length > 0 && (
              <View break>
                <Text style={s.secao}>Fotos</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {fotos.map((f) => (
                    <View key={f.caminho} style={{ width: 255 }} wrap={false}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
                      <Image src={{ data: Buffer.from(props.bytes[f.caminho]), format: "jpg" }} style={{ width: 255, height: 190, objectFit: "contain" }} />
                      <Text style={[s.suave, { marginBottom: 6 }]}>{f.legenda}</Text>
                    </View>
                  ))}
                </View>
                {props.fotosFora > 0 && <Text style={s.suave}>{`Mais ${props.fotosFora} foto(s) disponíveis no app.`}</Text>}
              </View>
            )}
          </>
        )}

        <View style={s.rodape} fixed>
          <Text>{`Frentia · Relatório da Obra · ${cab.periodo}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
