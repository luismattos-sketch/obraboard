import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, Text, View } from "@react-pdf/renderer";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { formatarData, ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { ResumoTurno } from "@/lib/dominio/resumo";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { estilos as s } from "./estilos";
import { sanitizarProfundo } from "./texto";
import { linhasEmissao, type Emissao } from "./versao";
import { Atividades, EfetivoEClima, Identificacao, Restricoes, ResumoBloco } from "./secoes";

// Sem hifenização: as regras padrão do react-pdf são do inglês e quebram palavras em português.
Font.registerHyphenationCallback((palavra) => [palavra]);

let logo: Buffer | null = null;
export function logoFrentia(): Buffer | null {
  if (logo) return logo;
  try {
    logo = readFileSync(path.join(process.cwd(), "public", "frentia-logo.png"));
  } catch (e) {
    console.warn("RDO: logo não encontrado, seguindo sem ele:", e instanceof Error ? e.message : e);
    return null; // sem logo o RDO continua válido
  }
  return logo;
}

/** Marca-d'água: só a prévia leva "RASCUNHO"; a versão oficial sai limpa. */
export function marcaDagua(emissao: Emissao): string | null {
  return emissao.tipo === "rascunho" ? "RASCUNHO" : null;
}

export function DocumentoRdo(props: { turno: TurnoCompleto; resumo: ResumoTurno; emissao: Emissao }) {
  // Todo texto vindo do usuário passa pelo filtro WinAnsi (Helvetica não tem emoji etc.).
  const turno = sanitizarProfundo(props.turno);
  const resumo = sanitizarProfundo(props.resumo);
  const marca = marcaDagua(props.emissao);
  const { destaque, rodape } = linhasEmissao(props.emissao);
  const img = logoFrentia();
  const titulo = `RDO — ${turno.obra.nome} — ${formatarData(turno.data)} (${ROTULO_PERIODO[turno.periodo]})`;
  return (
    <Document title={titulo} author="Frentia" creator="Frentia">
      <Page size="A4" style={s.pagina}>
        {marca && (
          <Text style={s.marcaDagua} fixed>{marca}</Text>
        )}

        <View style={s.cabecalhoFixo} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          {img ? <Image src={{ data: img, format: "png" }} style={s.logo} /> : <Text style={s.tituloFixo}>Frentia</Text>}
          <Text style={s.tituloFixo}>{`RDO · ${turno.obra.nome} · ${formatarData(turno.data)}`}</Text>
        </View>

        <Text style={s.emissao}>{destaque}</Text>
        <Identificacao turno={turno} />
        <Atividades resumo={resumo} />
        <ResumoBloco resumo={resumo} turno={turno} />
        <Restricoes resumo={resumo} />
        <EfetivoEClima turno={turno} resumo={resumo} />

        <View style={s.rodape} fixed>
          <Text>{`${rodape} · Status: ${ROTULO_STATUS_TURNO[turno.status]}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
