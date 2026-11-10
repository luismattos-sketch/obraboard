# Frentia — Análise de PPC e causas (design)

Data: 2026-11-09 · Branch: `analise-ppc` · Bloco 1 do roadmap LPS (aprendizado).

## Objetivo

Transformar os dados que o MVP já coleta (turnos fechados com planejado, realizado e causa) em
aprendizado: evolução do PPC ao longo das semanas e ranking das causas de não cumprimento, para o
engenheiro da obra agir sobre as causas recorrentes.

## Decisões

| Tema | Decisão |
|---|---|
| Público | Engenheiro da obra; análise dentro de cada obra. Comparativo entre obras e relatório PDF ao cliente ficam para depois (reaproveitam este cálculo). |
| Granularidade | PPC por semana (segunda a domingo, fuso America/Sao_Paulo), com detalhamento dos turnos de cada semana. |
| Turnos considerados | Somente status `fechado`. |
| Pendentes reaproveitados | Contam em cada turno em que aparecem (cada turno é um compromisso). |
| Fórmula do PPC | Soma de atividades concluídas ÷ soma de atividades, ponderada por atividade (não é média dos % dos turnos). |
| Ranking de causas | Contagem simples de atividades não concluídas por causa, com % e lista das atividades. |
| Abordagem técnica | Cálculo puro em TypeScript no app; gráficos de barra em HTML/CSS; sem biblioteca nova; sem migration. |

## Fora do escopo

Comparativo entre obras, PDF de PPC, evolução temporal por causa, ponderação por quantidade,
plano semanal, lookahead e restrições.

## Tela — `/obras/[obraId]/analise`

- Acesso: botão "Análise (PPC)" na página da obra, ao lado de "Novo turno".
- Período: últimas N semanas incluindo a atual, N ∈ {4, 8, 12}, padrão 8, via query `?semanas=N`
  (valor ausente ou inválido → 8). Nada em localStorage/sessionStorage.
- Blocos, de cima para baixo:
  1. **Indicadores**: PPC do período (`72% — 58 de 80 atividades`); PPC da semana atual e variação
     em pontos percentuais versus a semana anterior.
  2. **PPC por semana**: uma linha por semana (rótulo = data da segunda-feira, `dd/mm`), barra
     horizontal e %; semana atual destacada. Semana sem turno fechado mostra "—". Cada semana com
     dados abre (acordeão, `<details>`) a lista de turnos: data, período, % e link para o turno.
  3. **Causas de não cumprimento**: uma linha por causa com barra, contagem e %, ordem decrescente.
     Cada causa abre a lista de atividades: data, período, descrição e observação.
- Obra sem turno fechado no período: mensagem "Feche turnos para ver a análise." no lugar dos blocos.
- Layout mobile-first, componentes de `components/ui` existentes.

## Dados — `lib/db/turnos.ts`

Nova função `listarTurnosFechadosParaAnalise(c, obraId, desde: string /* YYYY-MM-DD */)`:
turnos com `obra_id = obraId`, `status = 'fechado'`, `data >= desde`, ordenados por data e período,
com `atividades(descricao, qtd_planejada, qtd_realizada, causa, observacao, ordem)`. Usa o cliente
do usuário (RLS). Converte quantidades para `number` como `listarTurnosComAtividades`. Erro de
consulta: `console.error` + `throw`, como as demais leituras de `lib/db/turnos.ts`; a página captura.

## Cálculo — `lib/dominio/analise.ts` (puro)

- `semanasDaAnalise(hoje: string, n: number)`: lista de N segundas-feiras (YYYY-MM-DD), da mais
  antiga até a da semana de `hoje`. `hoje` é calculado no fuso America/Sao_Paulo pela página.
- `normalizarSemanas(valor: unknown): 4 | 8 | 12` (padrão 8).
- `analisarObra(turnos, semanas)` devolve:
  - `periodo`: `{ concluidas, total, ppc: number | null }`.
  - `semanas[]`: `{ inicio, concluidas, total, ppc: number | null, atual: boolean, turnos: { id, data, periodo, ppc }[] }`.
  - `variacao`: `ppc(atual) − ppc(anterior)` ou `null` se alguma for `null`.
  - `causas[]`: `{ causa, rotulo, quantidade, fracao, atividades: { turnoId, data, periodo, descricao, observacao }[] }`,
    ordem decrescente de quantidade, empate estável pela ordem de aparição.
- "Concluída" usa `statusAtividade` de `calculos.ts`; o % do turno usa `percentualCumprimento`
  (igual ao resumo do turno e ao RDO). Turno sem atividades não soma ao total nem aparece com %.
- Turnos com status diferente de `fechado` são ignorados (defesa extra além do filtro da consulta).
- Atividade não concluída sem causa (não deveria ocorrer em turno fechado) não entra no ranking.

## Erros

- Obra inexistente/sem acesso → `notFound()`.
- Falha na consulta → cartão com "Não foi possível carregar a análise. Tente novamente."
- `?semanas` inválido → 8.

## Testes

- Vitest `lib/dominio/analise.test.ts`: PPC ponderado; semana vazia = `null`; variação nula sem as
  duas semanas; turnos não fechados ignorados; turno sem atividades; ranking, frações e empate;
  virada domingo→segunda; `normalizarSemanas`.
- Playwright: estender o E2E do ciclo completo — após fechar o turno, abrir "Análise (PPC)" e
  conferir o PPC e a causa exibidos.
- Validação do usuário na prévia do Vercel antes do merge na `main`.
