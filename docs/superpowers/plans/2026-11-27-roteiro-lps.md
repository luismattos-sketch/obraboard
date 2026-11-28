# 5.4 Roteiro da semana + pauta — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. **Spec:** docs/superpowers/specs/2026-11-27-roteiro-lps-design.md

**Goal:** painel "Roteiro da semana" na página da obra, página "Pauta da reunião" e capítulo "O método LPS".
**Architecture:** regras puras em `lib/dominio/roteiro.ts` recebem dados já carregados e devolvem passos/pauta; página da obra e `/obras/[obraId]/reuniao` só carregam e desenham. Sem migration.

## Global Constraints
Sem localStorage; "responsável", nunca "encarregado"; sem "pleito". Testes no PowerShell (C:\ maiúsculo).

## Review Focus
- Obra nova sem semanas nem turnos → painel só com Lookahead e Programar (sem erro) (Task 1).
- Semana anterior em rascunho → passo "Encerrar" some (Task 1).
- Dois turnos hoje (diurno e noturno) → passo usa o que pede ação primeiro (planejado/em campo antes de fechado) (Task 1).
- Pauta sem restrições/sem lookahead → seções com texto "Nada…", não somem (Task 2).

### Task 1: Regras do roteiro — `lib/dominio/roteiro.ts`, test `tests/dominio/roteiro.test.ts`
```ts
export type SituacaoPasso = "feito" | "pendente" | "atencao";
export type Passo = { id: "encerrar" | "lookahead" | "programar" | "turno"; titulo: string; detalhe: string; situacao: SituacaoPasso; href: string; rotuloBotao: string; porque: string; ajuda: string };
export function passosDoRoteiro(e: {
  obraId: string; hoje: string;
  anterior: { inicio: string; status: StatusSemana; ppc: number | null } | null;
  proxima: { inicio: string; status: StatusSemana } | null; proximaInicio: string;
  restricoes: { abertas: number; vencidas: number };
  turnosHoje: { id: string; status: StatusTurno; periodo: Periodo }[];
}): Passo[];
export function agruparCausas(naoCumpridas: { causa: Causa | null }[]): { causa: Causa | null; rotulo: string; n: number }[]; // desc por n; null = "Sem causa"
export function restricoesPorResponsavel<T extends { responsavel: string; prazo: string | null; removida_em: string | null }>(l: T[], hoje: string): { responsavel: string; itens: (T & { vencida: boolean })[] }[]; // só abertas; grupos com vencida primeiro, depois alfabético; dentro: vencidas, prazo asc, sem prazo por último
```
Textos: títulos "Encerrar a semana passada" / "Olhar o Lookahead" / "Programar a próxima semana" / "Turno de hoje"; detalhes ex.: "PPC 78%", "Semana de 23/11 aguardando encerramento", "2 restrições vencidas", "3 restrições abertas", "Nenhuma restrição aberta", "Semana de 07/12 programada", "Semana de 07/12 em rascunho", "Semana de 07/12 sem programação", "Check-in do turno diurno", "Fechar o turno noturno", "Turno fechado".
- [ ] testes → FAIL → implementar → PASS → commit.

### Task 2: Painel e pauta
- Create `components/obra/RoteiroSemana.tsx` (server, recebe `Passo[]`; ✓/○/! com Selo sucesso/neutro/alerta; "Por que isso?" em `<details>` com link "Saiba mais" → `/ajuda/metodo-lps#…`; botão "Abrir pauta da reunião").
- Modify `app/(app)/obras/[obraId]/page.tsx`: carrega semanas (anterior, próxima), resumo da anterior, restrições, turnos de hoje (já tem `turnos`) e mostra o painel no topo.
- Create `app/(app)/obras/[obraId]/reuniao/page.tsx` + `BotaoImprimir.tsx` (client, `window.print()`), seções conforme a spec; `@media print` esconde menu (`print:hidden` nas classes do menu/cabeçalho se necessário).
- e2e: `tests/e2e/lookahead.spec.ts` no fim: abre a obra → vê "Roteiro da semana" e "Olhar o Lookahead" com "1 restrição aberta"; abre pauta → vê "Restrições abertas" com "Carlos".
- [ ] tsc/eslint, e2e PASS, commit.

### Task 3: Capítulo "O método LPS" e entrega
- `lib/ajuda/conteudo/metodo-lps.ts` (slug `metodo-lps`, passos `o-que-e`, `ciclo`, `encerrar`, `lookahead`, `programar`, `turno`, `reuniao` — capturas: `roteiro` (heading "Roteiro da semana") e `reuniao` (heading "Pauta da reunião")); registrar em `capitulos.ts` e `SlugCapitulo`; fluxograma ("Reunião semanal" na seção "Toda semana"); Novidades; capturas em `tests/manual/capturas.spec.ts`.
- [ ] `MANUAL_CAPITULO=metodo-lps npm run manual:capturas`; suíte + build; revisão; entrega com OK.
