# 5.3 Trava com motivo — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. **Spec:** docs/superpowers/specs/2026-11-27-trava-restricao-design.md

## Global Constraints
Migration `20261208000000_trava_restricao.sql` (recria `salvar_programacao_atividade` a partir da versão de 20261206 e `foto_semana` a partir de 20261127, só acrescentando o campo); produção só com OK. Sem localStorage; "responsável".

## Review Focus
- Restrição aberta surge depois de levar → "Programar semana" pede motivo (Task 1, 2).
- Item manual apagado depois de levar (vínculo nulo) → não pede motivo (Task 1).
- Edição da atividade não apaga o motivo (Task 2).
- Semana encerrada continua mostrando o selo e contando na Análise (foto) (Task 2).

### Task 1: Regras puras — `lib/dominio/travaRestricao.ts`, test `tests/dominio/trava-restricao.test.ts`
```ts
export function restricoesAbertasDoItem(itemId: string | null | undefined, porItem: Map<string, Pick<Restricao,"descricao"|"responsavel"|"prazo"|"removida_em">[]>): {descricao: string; responsavel: string; prazo: string|null}[];
export function pendentesDeMotivo(atividades: Pick<AtividadeProgramada,"id"|"descricao"|"cronograma_item_id"|"justificativa_restricao">[], porItem: Map<...>): {id: string; descricao: string; restricoes: string[]}[];
export function validarMotivo(t: string): string | null; // 1–300 após trim, senão null
export function resumoComRestricao(atividades: Pick<AtividadeResumida,"situacao"|"justificativa_restricao">[]): { total: number; cumpridas: number };
```
### Task 2: Banco — migration; `AtividadeProgramada.justificativa_restricao?: string|null`; `EntradaAtividadeProgramada.justificativa_restricao`; `obterDadosSemana`/`dadosDaFoto` leem o campo; `salvarAtividadeProgramada` exige motivo na inclusão quando o item tem restrição aberta (`ERRO_MOTIVO_RESTRICAO = "Informe por que a atividade entra mesmo com restrição aberta."`); `programarSemanaComMotivo(c, semana, motivo: string|null): Promise<Resultado<undefined> & {pendentes?}>`. Test integração `tests/integracao/trava-restricao.test.ts`.
### Task 3: UI — form (aviso + campo obrigatório), `ListaRascunho` (selo/motivo, formulário de programar com lista e motivo), `Acompanhamento` (selo), Análise (bloco). e2e no `lookahead.spec.ts`.
### Task 4: manual/capturas/novidades, suíte, build, revisão, entrega.
