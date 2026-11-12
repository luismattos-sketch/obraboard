import { Text, View } from "@react-pdf/renderer";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { somarEfetivoPorFuncao } from "@/lib/dominio/calculos";
import { formatarData, formatarPercentual, horaCurta, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { ResumoTurno } from "@/lib/dominio/resumo";
import { CAUSAS, CONDICOES, PERIODOS_CLIMA, ROTULO_STATUS_ATIVIDADE } from "@/lib/dominio/tipos";
import { estilos as s } from "./estilos";
import { qtdRealizada } from "./formatar";

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

const COL = { desc: "34%", local: "16%", plan: "12%", real: "12%", status: "12%", obs: "14%" };

export function Atividades({ resumo }: { resumo: ResumoTurno }) {
  return (
    <View>
      <Text style={s.secao}>Atividades</Text>
      <View style={s.linhaCab} wrap={false}>
        <Text style={[s.celula, { width: COL.desc }]}>Descrição</Text>
        <Text style={[s.celula, { width: COL.local }]}>Local</Text>
        <Text style={[s.celula, s.direita, { width: COL.plan }]}>Planejado</Text>
        <Text style={[s.celula, s.direita, { width: COL.real }]}>Realizado</Text>
        <Text style={[s.celula, { width: COL.status }]}>Status</Text>
        <Text style={[s.celula, { width: COL.obs }]}>Causa / obs.</Text>
      </View>
      {resumo.atividades.length === 0 && <Text style={[s.celula, s.suave]}>Nenhuma atividade planejada.</Text>}
      {resumo.atividades.map((a, i) => (
        <View key={a.id} style={[s.linha, i % 2 ? s.linhaZebra : {}]} wrap={false}>
          <Text style={[s.celula, { width: COL.desc }]}>{a.descricao}</Text>
          <Text style={[s.celula, { width: COL.local }]}>{a.local || "—"}</Text>
          <Text style={[s.celula, s.direita, { width: COL.plan }]}>{numeroBR(a.qtd_planejada)} {a.unidade}</Text>
          <Text style={[s.celula, s.direita, { width: COL.real }]}>{qtdRealizada(a.qtd_realizada, a.unidade)}</Text>
          <Text style={[s.celula, { width: COL.status }]}>{ROTULO_STATUS_ATIVIDADE[a.status]}</Text>
          <Text style={[s.celula, { width: COL.obs }]}>
            {[a.causa ? CAUSAS[a.causa] : null, a.observacao].filter(Boolean).join(" — ") || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ResumoBloco({ resumo, turno }: { resumo: ResumoTurno; turno: TurnoCompleto }) {
  const concluidas = resumo.atividades.filter((a) => a.status === "concluida").length;
  return (
    <View wrap={false}>
      <Text style={s.secao}>Resumo</Text>
      <View style={s.metricas}>
        <View style={s.metrica}>
          <Text style={s.rotulo}>Cumprimento</Text>
          <Text style={s.metricaValor}>{formatarPercentual(resumo.cumprimento)}</Text>
          <Text style={s.suave}>{concluidas} de {resumo.atividades.length} atividades concluídas</Text>
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

export function EfetivoEClima({ turno, resumo }: { turno: TurnoCompleto; resumo: ResumoTurno }) {
  return (
    <View wrap={false}>
      <Text style={s.secao}>Efetivo</Text>
      {turno.efetivo.length === 0 && <Text style={s.suave}>Nenhum efetivo informado.</Text>}
      {somarEfetivoPorFuncao(turno.efetivo).map((e) => <Par key={e.funcao} a={e.funcao} b={String(e.quantidade)} />)}
      <Par a="Total" b={String(resumo.efetivoTotal)} forte />

      <Text style={s.secao}>Clima</Text>
      {PERIODOS_CLIMA.map((p) => {
        const c = turno.clima.find((x) => x.periodo === p.id);
        return <Par key={p.id} a={p.rotulo} b={c ? `${CONDICOES[c.condicao]}${c.impediu ? " · impediu o trabalho" : ""}` : "—"} />;
      })}
    </View>
  );
}
