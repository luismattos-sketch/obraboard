import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarPercentual, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { rotuloMes } from "@/lib/dominio/historico-rdo";
import type { ItemLote } from "@/lib/dominio/lote-rdo";
import { logoFrentia } from "./documento";
import { estilos as s } from "./estilos";
import { dataHoraBrasilia } from "./formatar";
import { sanitizarProfundo } from "./texto";

export type CabecalhoLote = { mes: string; obraNome: string | null; geradoEm: Date };

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Capa do PDF único: cabeçalho do lote e índice com a página onde cada RDO começa. */
export function CapaLote(props: { cabecalho: CabecalhoLote; lote: ItemLote[]; paginas: number[] }) {
  const cab = sanitizarProfundo(props.cabecalho);
  const lote = sanitizarProfundo(props.lote);
  const comObra = cab.obraNome === null;
  const reabertos = lote.filter((l) => l.reaberto).length;
  const img = logoFrentia();
  const col = comObra
    ? { obra: "30%", data: "16%", periodo: "14%", versao: "12%", pct: "16%", pag: "12%" }
    : { obra: "0%", data: "24%", periodo: "20%", versao: "16%", pct: "24%", pag: "16%" };
  return (
    <Document title="Capa" author="Frentia" creator="Frentia">
      <Page size="A4" style={s.pagina}>
        <View style={s.cabecalhoFixo} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {img ? <Image src={{ data: img, format: "png" }} style={s.logo} /> : <Text style={s.tituloFixo}>Frentia</Text>}
          <Text style={s.tituloFixo}>{`RDOs · ${rotuloMes(cab.mes)}`}</Text>
        </View>

        <Text style={s.titulo}>{`RDOs de ${rotuloMes(cab.mes)}`}</Text>
        <Text style={[s.valor, s.negrito, s.item]}>{cab.obraNome ?? "Todas as obras"}</Text>
        <Text style={s.item}>{plural(lote.length, "RDO", "RDOs")}</Text>
        <Text style={[s.item, s.suave]}>{`Gerado em ${dataHoraBrasilia(cab.geradoEm)} (horário de Brasília)`}</Text>
        {reabertos > 0 && (
          <Text style={s.item}>
            {`${plural(reabertos, "turno reaberto", "turnos reabertos")}: incluída a última versão oficial.`}
          </Text>
        )}

        <Text style={s.secao}>Índice</Text>
        <View style={s.linhaCab} fixed>
          {comObra && <Text style={[s.celula, { width: col.obra }]}>Obra</Text>}
          <Text style={[s.celula, { width: col.data }]}>Data</Text>
          <Text style={[s.celula, { width: col.periodo }]}>Período</Text>
          <Text style={[s.celula, { width: col.versao }]}>Versão</Text>
          <Text style={[s.celula, s.direita, { width: col.pct }]}>% cumprido</Text>
          <Text style={[s.celula, s.direita, { width: col.pag }]}>Página</Text>
        </View>
        {lote.map(({ atual }, i) => (
          <View key={atual.id} style={[s.linha, i % 2 ? s.linhaZebra : {}]} wrap={false}>
            {comObra && <Text style={[s.celula, { width: col.obra }]}>{atual.obraNome}</Text>}
            <Text style={[s.celula, { width: col.data }]}>{formatarData(atual.data)}</Text>
            <Text style={[s.celula, { width: col.periodo }]}>{ROTULO_PERIODO[atual.periodo]}</Text>
            <Text style={[s.celula, { width: col.versao }]}>{`v${atual.numero}`}</Text>
            <Text style={[s.celula, s.direita, { width: col.pct }]}>{formatarPercentual(atual.percentual)}</Text>
            <Text style={[s.celula, s.direita, { width: col.pag }]}>{String(props.paginas[i] ?? "")}</Text>
          </View>
        ))}

        <View style={s.rodape} fixed>
          <Text>Frentia · RDOs do mês</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
