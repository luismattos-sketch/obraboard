import { Image, Text, View } from "@react-pdf/renderer";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { somarEfetivoPorFuncao } from "@/lib/dominio/calculos";
import { formatarData, formatarPercentual, horaCurta, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { linhaOcorrencia, nomeDaEquipe } from "@/lib/dominio/efetivoHH";
import { textoForaDoDia, type ResumoTurno } from "@/lib/dominio/resumo";
import { CAUSAS, ROTULO_STATUS_ATIVIDADE, ROTULO_TIPO } from "@/lib/dominio/tipos";
import { rotuloTempo } from "@/lib/clima/montar";
import { estilos as s } from "./estilos";
import { porResponsavel, qtdRealizada } from "./formatar";

const faixa = (a: string | null, b: string | null) => (a && b ? `${horaCurta(a)} às ${horaCurta(b)}` : "—");

function Campo({ rotulo, valor, largura }: { rotulo: string; valor: string; largura?: string }) {
  return (
    <View style={[s.campo, largura ? { width: largura } : {}]}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

export function Identificacao({ turno }: { turno: TurnoCompleto }) {
  return (
    <View>
      <Text style={s.titulo}>Relatório Diário de Obra (RDO)</Text>
      <View style={s.grade}>
        <Campo rotulo="Obra" valor={turno.obra.nome} />
        <Campo rotulo="Cliente" valor={turno.obra.cliente || "—"} />
        <Campo rotulo="Endereço" valor={turno.obra.endereco || "—"} />
        <Campo rotulo="Data" valor={formatarData(turno.data)} />
        <Campo rotulo="Período" valor={ROTULO_PERIODO[turno.periodo]} />
        <Campo rotulo="Horário previsto" valor={faixa(turno.hora_inicio_prevista, turno.hora_fim_prevista)} />
        <Campo rotulo="Horário real" valor={faixa(turno.hora_inicio_real, turno.hora_fim_real)} largura="100%" />
      </View>
    </View>
  );
}

const COL = { desc: "29%", local: "13%", plan: "10%", real: "10%", status: "11%", obs: "27%" };

/** Item 17: atividades separadas por responsável; extra/adiantada com a marca em negrito. */
export function Atividades({ resumo, turno }: { resumo: ResumoTurno; turno: TurnoCompleto }) {
  const nome = nomeDaEquipe(turno.responsaveis);
  const grupos = porResponsavel(resumo.atividades, []);
  return (
    <View>
      <Text style={s.secao}>Atividades</Text>
      <View style={s.linhaCab} wrap={false}>
        <Text style={[s.celula, { width: COL.desc }]}>Descrição</Text>
        <Text style={[s.celula, { width: COL.local }]}>Local</Text>
        <Text style={[s.celula, s.direita, { width: COL.plan }]}>Planejado</Text>
        <Text style={[s.celula, s.direita, { width: COL.real }]}>Realizado</Text>
        <Text style={[s.celula, { width: COL.status }]}>Status</Text>
        <Text style={[s.celula, { width: COL.obs }]}>Causa / observação</Text>
      </View>
      {resumo.atividades.length === 0 && <Text style={[s.celula, s.suave]}>Nenhuma atividade planejada.</Text>}
      {grupos.map((g) => (
        <View key={g.id ?? "sem"}>
          {(g.id !== null || grupos.length > 1) && <Text style={[s.negrito, { marginTop: 6 }]} minPresenceAhead={20}>{nome(g.id)}</Text>}
          {g.atividades.map((a, i) => <LinhaAtividade key={a.id} a={a} zebra={i % 2 === 1} />)}
        </View>
      ))}
    </View>
  );
}

function LinhaAtividade({ a, zebra }: { a: ResumoTurno["atividades"][number]; zebra: boolean }) {
  return (
        <View style={[s.linha, zebra ? s.linhaZebra : {}]} wrap={false}>
          <Text style={[s.celula, { width: COL.desc }]}>
            {a.tipo ? <Text style={s.negrito}>{`${ROTULO_TIPO[a.tipo].toUpperCase()} · `}</Text> : null}
            {a.descricao}
          </Text>
          <Text style={[s.celula, { width: COL.local }]}>{a.local || "—"}</Text>
          <Text style={[s.celula, s.direita, { width: COL.plan }]}>{numeroBR(a.qtd_planejada)} {a.unidade}</Text>
          <Text style={[s.celula, s.direita, { width: COL.real }]}>{qtdRealizada(a.qtd_realizada, a.unidade)}</Text>
          <Text style={[s.celula, { width: COL.status }]}>{ROTULO_STATUS_ATIVIDADE[a.status]}</Text>
          <Text style={[s.celula, { width: COL.obs }]}>
            {[a.causa ? CAUSAS[a.causa] : null, a.observacao].filter(Boolean).join(" — ") || "—"}
          </Text>
        </View>
  );
}

export function ResumoBloco({ resumo, turno }: { resumo: ResumoTurno; turno: TurnoCompleto }) {
  return (
    <View wrap={false}>
      <Text style={s.secao}>Resumo</Text>
      <View style={s.metricas}>
        <View style={s.metrica}>
          <Text style={s.rotulo}>Cumprimento do dia</Text>
          <Text style={s.metricaValor}>{formatarPercentual(resumo.cumprimento)}</Text>
          <Text style={s.suave}>
            {[
              `${resumo.concluidas} de ${resumo.total} atividades concluídas`,
              resumo.avanco === null ? null : `avanço físico ${formatarPercentual(resumo.avanco)}`,
              textoForaDoDia(resumo),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <View style={s.metrica}>
          <Text style={s.rotulo}>Homens-hora (HH)</Text>
          <Text style={s.metricaValor}>{resumo.hh === null ? "—" : numeroBR(resumo.hh)}</Text>
          <Text style={s.suave}>{turno.hora_inicio_real && turno.hora_fim_real ? "Horário real" : "Horário previsto"}</Text>
        </View>
        <View style={s.metrica}>
          <Text style={s.rotulo}>Efetivo total</Text>
          <Text style={s.metricaValor}>{resumo.efetivoTotal}</Text>
          <Text style={s.suave}>pessoas</Text>
        </View>
        {resumo.hhParado !== null && resumo.hhParado > 0 && (
          <View style={s.metrica}>
            <Text style={s.rotulo}>HH parado</Text>
            <Text style={s.metricaValor}>{numeroBR(resumo.hhParado)}</Text>
            <Text style={s.suave}>
              {(Object.entries(resumo.hhParadoPorCausa) as [keyof typeof CAUSAS, number][])
                .map(([c, h]) => `${CAUSAS[c]} ${numeroBR(h)}`)
                .join(" · ")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function Restricoes({ resumo }: { resumo: ResumoTurno }) {
  return (
    <View>
      <Text style={s.secao}>Restrições por causa</Text>
      {resumo.restricoesPorCausa.length === 0 && <Text style={s.suave}>Nenhuma restrição registrada.</Text>}
      {resumo.restricoesPorCausa.map((c) => (
        <View key={c.causa} style={s.item} wrap={false}>
          <Text style={s.negrito}>{c.rotulo} ({c.atividades.length})</Text>
          {c.atividades.map((d, i) => <Text key={i} style={s.suave}>•  {d}</Text>)}
        </View>
      ))}
    </View>
  );
}

const Par = ({ a, b, forte }: { a: string; b: string; forte?: boolean }) => (
  <View style={[s.linha, { justifyContent: "space-between" }]}>
    <Text style={[s.celula, forte ? s.negrito : {}]}>{a}</Text>
    <Text style={[s.celula, forte ? s.negrito : {}]}>{b}</Text>
  </View>
);

/**
 * `comFotos`: o PDF traz as fotos das paradas no fim (download individual). Sem elas (lote), a parada com foto
 * ganha "(foto no app)".
 */
export function EfetivoEClima({ turno, resumo, comFotos = false }: { turno: TurnoCompleto; resumo: ResumoTurno; comFotos?: boolean }) {
  const nome = nomeDaEquipe(turno.responsaveis);
  const terminados = turno.terminados ?? [];
  return (
    <View wrap={false}>
      <Text style={s.secao}>Efetivo</Text>
      {turno.efetivo.length === 0 && <Text style={s.suave}>Nenhum efetivo informado.</Text>}
      {porResponsavel([], turno.efetivo).map((g, _, todos) => (
        <View key={g.id ?? "sem"}>
          {(g.id !== null || todos.length > 1) && <Text style={[s.negrito, { marginTop: 4 }]}>{nome(g.id)}</Text>}
          {somarEfetivoPorFuncao(g.efetivo).map((e) => <Par key={e.funcao} a={`   ${e.funcao}`} b={String(e.quantidade)} />)}
        </View>
      ))}
      <Par a="Total" b={String(resumo.efetivoTotal)} forte />
      {turno.ocorrencias.length > 0 && (
        <View style={s.item}>
          <Text style={s.negrito}>Movimentações do efetivo</Text>
          {turno.ocorrencias.map((o) => (
            <Text key={o.id} style={s.suave}>•  {`${linhaOcorrencia(o, nome)}${o.foto_path && !comFotos ? " (foto no app)" : ""}`}</Text>
          ))}
          {resumo.avisosEfetivo.map((a) => (
            <Text key={a} style={s.suave}>Atenção: {a} (contado só o que a linha tem).</Text>
          ))}
        </View>
      )}

      {terminados.length > 0 && (
        <Text style={s.suave}>
          {`Equipes que terminaram: ${terminados.map((t) => `${nome(t.responsavel_id)} ${horaCurta(t.terminou_em)}`).join(" · ")}`}
        </Text>
      )}

      <Text style={s.secao}>Clima</Text>
      {turno.clima_turno ? (
        <>
          <Par a="Temperatura média" b={`${Math.round(turno.clima_turno.temp_media)}° (máx ${Math.round(turno.clima_turno.temp_max)}° · mín ${Math.round(turno.clima_turno.temp_min)}°)`} />
          <Par a="Chuva" b={turno.clima_turno.choveu ? `Choveu · ${numeroBR(turno.clima_turno.chuva_mm)} mm` : "Não choveu"} />
          <Text style={s.suave}>
            {turno.clima_turno.leituras.map((l) => `${l.hora.slice(11, 13)}h ${rotuloTempo(l.codigo)} ${Math.round(l.temperatura)}° ${numeroBR(l.chuva_mm)} mm`).join("  ·  ")}
          </Text>
          <Text style={s.suave}>Dados: Open-Meteo</Text>
        </>
      ) : (
        <Text style={s.suave}>{turno.obra.local_nome ? "Clima não disponível no momento do fechamento" : "Clima não registrado (obra sem cidade)"}</Text>
      )}
      {resumo.paradasClima > 0 && <Par a="Atividades paradas por clima" b={String(resumo.paradasClima)} />}
    </View>
  );
}

/** Fotos das paradas (só no download individual; o lote não carrega imagens). */
export function FotosParadas({ turno, fotos }: { turno: TurnoCompleto; fotos: Record<string, Uint8Array> }) {
  const com = turno.ocorrencias.filter((o) => o.foto_path && fotos[o.foto_path]);
  if (com.length === 0) return null;
  const nome = nomeDaEquipe(turno.responsaveis);
  return (
    <View>
      <Text style={s.secao}>Fotos das paradas</Text>
      {com.map((o) => (
        <View key={o.id} style={s.item} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          <Image src={{ data: Buffer.from(fotos[o.foto_path!]), format: "jpg" }} style={{ width: 300, objectFit: "contain" }} />
          <Text style={s.suave}>{linhaOcorrencia(o, nome)}</Text>
        </View>
      ))}
    </View>
  );
}
