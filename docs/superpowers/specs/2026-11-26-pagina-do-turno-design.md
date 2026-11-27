# Página do turno mais curta (item 16 do backlog)

## Por quê
O planejador entra no turno várias vezes ao dia para **acompanhar e cobrar**; corrige números só de vez em quando.
Hoje a página tem ~5.500–6.250 px, e "Fechar turno" fica no fim — no teste de 2026-11-16 fechar o dia custou ~8 cliques
e muita rolagem. Cada atividade planejada tem um "Remover" vermelho cheio e setas ↑ ↓ sem rótulo (tela "perigosa").

## Objetivos
- Aberta, a página cabe em ~1–1,5 tela com o que serve para acompanhar/cobrar.
- "Fechar turno" alcançável sem rolar; pendências de causa aparecem ali, com atalho até cada atividade.
- "Remover" deixa de chamar atenção; setas com rótulo.

Não-objetivos: mudar regras de fechamento, de causa ou de cálculo; criar tela nova ou abas.
Anti-objetivo: esconder algo que o planejador precisa ver para cobrar (paradas abertas, "O que falta").

## Abordagens consideradas
- **A. Reordenar e recolher + "Fechar turno" no cabeçalho** — escolhida. Usa o padrão `<details>` já usado em
  "Editar planejamento"; o "ir" da causa continua sendo uma rolagem.
- B. Abas (Acompanhar | Corrigir | RDO e histórico) — padrão novo no app, um toque a mais para corrigir, "ir" precisa trocar de aba.
- C. Só fixar barra "Fechar turno" no rodapé — barata, mas a página continua com 5.500 px.

## Design (turno em campo / enviado)
Ordem, de cima para baixo:
1. Cabeçalho: título, selo, **[Fechar turno]**, [Ver quadro], "?".
2. Área de fechamento (aparece ao tocar "Fechar turno"): se houver causa pendente, a lista
   "Antes de fechar, informe a causa em:" com "ir"; senão, a confirmação de hoje (paradas sem fim + aviso + Confirmar/Cancelar).
3. Paradas abertas (FaixaParadas) — aberto.
4. O que falta — aberto.
5. Resumo do turno — aberto.
6. Recolhidos (`<details>`, fechados por padrão): **Corrigir execução**, Editar planejamento, Link de campo, RDO,
   Relatos do campo, Problemas e oportunidades, Histórico.
- "ir" abre "Corrigir execução" (e o card) antes de rolar até o campo de causa.
- Enquanto há salvamento em andamento, "Fechar turno" mostra "Salvando…" como hoje.

**Turno planejado:** sem mudança de ordem (lista de atividades + dados do turno), só o tratamento do "Remover"/setas.
**Turno fechado:** "Reabrir turno" no cabeçalho; RDO aberto (é o que se procura num turno fechado); resto recolhido.

**Remover e setas:** "Remover" vira botão de texto discreto (sem fundo vermelho), mantendo a confirmação.
Setas com texto visível curto ou `aria-label` "Subir"/"Descer".

## Decisões minhas (a conferir)
- Link de campo recolhido: o link já foi enviado no início do turno; reaparece aberto se ainda não existe link.
- Problemas e oportunidades recolhido (cadastro raro).
- "Corrigir execução" lembra se estava aberto? Não — fecha a cada visita (sem armazenamento local, regra do projeto).

## Para quem constrói
- Estado de "Fechar turno"/pendências hoje vive em `EdicaoExecucao` (lista local editada); o botão no cabeçalho precisa
  enxergar esse estado — subir o estado ou envolver cabeçalho + execução num mesmo componente cliente.
- Atualizar manual (`lib/ajuda/conteudo/fechar-turno.ts` e capítulos do turno), capturas
  (`MANUAL_CAPITULO=…`), e uma linha em Novidades. Fluxograma só se a sequência mudar (não deve).
