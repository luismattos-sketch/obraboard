# Serviço extra e adiantar atividade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Responsável (link de campo) e planejador lançam serviço extra, adiantam atividade futura da semana e continuam atividade atrasada; extra/adiantada ficam marcados, fora do cumprimento do dia e sem exigir causa.

**Architecture:** Coluna `atividades.tipo` ('extra' | 'adiantada' | null) + `criada_por_id` + `foto_path`, com gatilhos no banco (extra: planejado = executado; fechamento ignora tipo não nulo). Regras de "o que dá para puxar" num módulo de domínio puro; gravação em `lib/db/foraDoDia.ts` (campo: admin escopado ao token; planejador: sessão/RLS). Um componente de tela compartilhado pelos dois lados.

**Tech Stack:** Next.js (versão do repo — ler `node_modules/next/dist/docs/` antes de mexer em rotas/ações), Supabase (Postgres + Storage), Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-11-17-servico-extra-adiantar-design.md

## Global Constraints
- Nunca `localStorage`/`sessionStorage`.
- Termo "Responsável", nunca "encarregado" (em texto novo).
- Migration aplicada à mão no SQL Editor (DEV antes dos testes de integração; PROD antes do merge). Sem psql/CLI.
- Campo: toda consulta admin escopada ao turno resolvido pelo token (`turnoAberto`); nunca confiar em id do cliente sem `.eq("turno_id", ...)`.
- Reenvio idempotente: o id do extra vem do cliente (`crypto.randomUUID()`), como `efetivo_ocorrencias`.
- Arquivos do repo têm CRLF — preservar ao editar.
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo): `npx vitest run <arquivo>`; integração/E2E com `$env:SUPABASE_TEST='1'`.
- Textos exatos: "+ Adiantar atividade da semana", "Continuar atividade atrasada", "+ Serviço extra (fora da programação)", selos "Extra" e "Adiantada", "lançado pelo campo — <nome>" (planejador) / "lançado por você" (campo), vazio: "Nenhuma atividade sua para adiantar nesta semana. Fale com o planejador."
- Atualizar o Vercel ao concluir (push da branch → prévia; merge na main → produção).

## Review Focus
1. Reenvio do mesmo extra depois de envio sem resposta → não duplica (Task 3: teste `lancarExtra reenvio`).
2. Responsável tentando puxar atividade de outro responsável ou de outra obra mexendo no id → recusado (Task 3: teste `puxar de outro responsável recusa`).
3. Corrigir o executado do extra para 0/vazio → recusado com "Para tirar o extra, remova-o." (Task 1 gatilho + Task 3 teste).
4. Adiantada sem execução ao fechar o turno → fecha sem pedir causa e não volta como pendente no turno seguinte (Task 1 teste do gatilho; Task 2 teste `trazerPendentes ignora tipo`).
5. Foto de RDO/check-in antigas sem `tipo` → contam como atividade normal (Task 2: teste `quadro sem tipo usa regra antiga`).

---

### Task 1: Migration e tipo da atividade

**Files:**
- Create: `supabase/migrations/20261119000000_servico_extra.sql`
- Modify: `lib/dominio/tipos.ts` (AtividadeExec), `lib/db/atividades.ts` (Atividade, COLUNAS, normalizarAtividade), `lib/db/mensagens.ts`
- Test: `tests/integracao/servico-extra-banco.test.ts`

**Interfaces:**
- Produces: `export type TipoAtividade = "extra" | "adiantada"` em tipos.ts; `AtividadeExec.tipo?: TipoAtividade | null`; `Atividade.tipo: TipoAtividade | null`, `Atividade.criada_por_id: string | null`, `Atividade.foto_path: string | null` (lidos em COLUNAS e normalizados com `?? null`); `ERRO_EXTRA_SEM_QTD = "Para tirar o extra, remova-o."` em mensagens.ts, mapeado de `erroBanco(error) === "extra_sem_quantidade"`.

SQL (uma migration):
- `alter table atividades add column tipo text check (tipo in ('extra','adiantada')), add column criada_por_id uuid references responsaveis(id) on delete set null, add column foto_path text;` + índice em criada_por_id.
- `check ((tipo is distinct from 'adiantada' or programacao_atividade_id is not null) and (tipo is distinct from 'extra' or programacao_atividade_id is null))` e `check (foto_path is null or tipo = 'extra')`.
- Gatilho `tg_atividade_extra` before insert or update: se `new.tipo = 'extra'`: `qtd_realizada` nula ou ≤ 0 → `raise exception 'extra_sem_quantidade'`; senão `new.qtd_planejada := new.qtd_realizada; new.causa := null`.
- `tg_turno_causa_pendente`: acrescentar `and a.tipo is null` na busca.
- `tg_responsavel_mesma_obra`: em atividades, `v_ids := array[new.responsavel_id, new.lancado_por_id, new.criada_por_id]`; recriar o gatilho de atividades para disparar também em `update of criada_por_id`.
- `foto_rdo` e `foto_checkin`: recriar (copiar a versão de 20261118000000_aviso_parada.sql) acrescentando `'tipo', a.tipo, 'criada_por_id', a.criada_por_id` no objeto de cada atividade; manter revoke/grant.

- [ ] **Step 0: Branch** — `git checkout -b servico-extra` a partir da main atualizada.
- [ ] **Step 1: Escrever testes de integração** (`describe.skipIf(!process.env.SUPABASE_TEST)`, obra própria por teste, usando os ajudantes de `tests/integracao/ajuda.ts`):
  - `extra: planejado acompanha executado` — insert tipo 'extra', qtd_realizada 12, qtd_planejada 1 → linha lida tem qtd_planejada 12; update qtd_realizada 7 → qtd_planejada 7.
  - `extra sem quantidade recusa` — update qtd_realizada null → erro contendo `extra_sem_quantidade`.
  - `checks de tipo` — adiantada sem programacao_atividade_id → 23514; extra com programacao_atividade_id → 23514; foto_path em tipo null → 23514.
  - `fechar ignora extra/adiantada` — turno em_campo com uma adiantada (qtd_realizada null, sem causa) → `aplicarAcao(..., "enviar")` ok.
  - `criada_por_id de outra obra recusa` → `responsavel_invalido`.
  - `foto_rdo inclui tipo` — `rpc('foto_rdo')` → atividades[0].tipo === 'extra'.
- [ ] **Step 2: Aplicar a migration no DEV** (guiar o usuário no SQL Editor) e rodar: `npx vitest run tests/integracao/servico-extra-banco.test.ts` → PASS.
- [ ] **Step 3: Tipos TS** (TipoAtividade, campos novos em Atividade/COLUNAS/normalizar, mensagem). Rodar `npx tsc --noEmit` → sem erros; `npx vitest run tests/dominio` → PASS (fixtures que montam Atividade à mão ganham `tipo: null, criada_por_id: null, foto_path: null`).
- [ ] **Step 4: Commit** `feat(extra): colunas tipo/criada_por_id/foto_path e regras no banco`

### Task 2: Números (cumprimento, quadro, análise, pendentes)

**Files:**
- Modify: `lib/dominio/calculos.ts`, `lib/dominio/resumo.ts`, `lib/dominio/regras.ts`, `lib/dominio/quadro.ts`, `lib/db/quadro.ts`, `lib/db/turnos.ts` (listarTurnosComAtividades, listarTurnosFechadosParaAnalise), `lib/db/atividades.ts` (trazerPendentes), `components/quadro/Quadro.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/Resumo.tsx`, `lib/rdo/secoes.tsx`
- Test: `tests/dominio/calculos.test.ts`, `resumo.test.ts`, `regras.test.ts`, `quadro.test.ts`

**Interfaces:**
- Produces: `export const contaNoDia = (a: { tipo?: TipoAtividade | null }) => !a.tipo` (calculos.ts); `percentualCumprimento` passa a considerar só `contaNoDia`; `ResumoTurno.extras: number`, `ResumoTurno.adiantadas: number`; `ResumoEquipe.adiantadas: number`; `EntradaQuadro["atividades"][number].tipo?: TipoAtividade | null`.

Regras:
- `errosDeCausa`: pula atividade com `tipo`.
- `resumoEquipe`: se nenhuma atividade da faixa tem `tipo` definido (`=== undefined`, foto antiga) → regra antiga. Senão: `contadas` = `tipo` nulo; `extras` = tipo 'extra'; `adiantadas` = tipo 'adiantada'; `base` = "programadas" se temProgramada e todas as contadas são programadas, senão "todas".
- Quadro.tsx: ao lado do `+N extra`, `+N adiantada` (mesma classe).
- Resumo.tsx e secoes.tsx: abaixo do cumprimento, texto "+N extra · +N adiantada" (omitir partes com 0).
- secoes.tsx (tabela de atividades do RDO): descrição com prefixo "Extra · " / "Adiantada · " quando houver tipo (teste em `tests/dominio/rdo.test.tsx`: `RDO marca extra`).
- listarTurnosComAtividades / listarTurnosFechadosParaAnalise: selecionar `tipo` e descartar atividades com tipo antes de devolver.
- trazerPendentes: filtrar também `a.tipo === null`.
- db/quadro.ts: selecionar `tipo`; mapear `tipo: (a.tipo as TipoAtividade | null) ?? null`.

- [ ] **Step 1: Testes que falham**
  - calculos: `cumprimento ignora extra e adiantada` — [concluída normal, parcial normal, extra 12/12, adiantada 0/40] → 0.5.
  - resumo: `conta extras e adiantadas` → extras 1, adiantadas 1, cumprimento 0.5.
  - regras: `adiantada sem causa não bloqueia` — errosDeCausa([{...adiantada, qtd_realizada:null, causa:null}]) → {}.
  - quadro: `marca: atividade avulsa sem tipo conta no dia` — faixa com 1 programada concluída + 1 avulsa tipo null não iniciada + 1 extra → total 2, concluidas 1, extras 1, base "todas".
  - quadro: `quadro sem tipo usa regra antiga` — sem campo tipo, 1 programada + 1 avulsa → total 1, extras 1, base "programadas".
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/calculos.test.ts tests/dominio/resumo.test.ts tests/dominio/regras.test.ts tests/dominio/quadro.test.ts` → FAIL.
- [ ] **Step 3: Implementar** conforme as regras acima.
- [ ] **Step 4: Rodar** `npx vitest run tests/dominio` → PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** `feat(extra): extra e adiantada fora do cumprimento do dia`

### Task 3: O que dá para puxar + gravação (domínio e banco)

**Files:**
- Create: `lib/dominio/foraDoDia.ts`, `lib/db/foraDoDia.ts`
- Modify: `lib/db/campo.ts` (responsaveisDoTurno, salvarExecucao), `lib/db/execucao.ts` (salvarExecucaoPlanejador), `lib/db/fotosParada.ts`
- Test: `tests/dominio/fora-do-dia.test.ts`, `tests/integracao/fora-do-dia.test.ts`

**Interfaces:**
- Produces (domínio, puro):
  - `type OpcaoPuxar = { programacaoAtividadeId: string; descricao: string; unidade: string | null; dias: DiaSemana[]; saldo: number; responsavel_id: string | null }`
  - `opcoesParaPuxar(d: DadosSemana, turno: { id: string; data: string; periodo: Periodo }, responsavelId: string | null): { adiantar: OpcaoPuxar[]; atrasadas: OpcaoPuxar[] }` — só se `d.semana.status === "programada"` e o dia está na semana; filtra `a.periodo === turno.periodo`, `responsavelId === null || a.responsavel_id === responsavelId`, sem execução neste turno; `saldo = arred(meta − realizadoAte(execuções de outros turnos, todos os status))` > 0. `adiantar`: todos os dias > dia de hoje. `atrasadas`: algum dia < hoje. (Só hoje / hoje+futuro: nenhuma lista — é "Trazer da programação".)
  - `type DadosExtra = { id: string; descricao: string; unidade: string; qtd: number; observacao: string | null; responsavel_id: string | null }`; `validarExtra(d: unknown): Resultado<DadosExtra>` — uuid válido, descricao 1..LIMITES.descricao, unidade 1..LIMITES.unidade, `0 < qtd ≤ QTD_PLANEJADA_MAX`, observacao ≤ 500.
  - `copiasParaAjustar(d: DadosSemana, programacaoId: string, aPartirDe: string): { turnoId: string; atividadeId: string; nova: number | null }[]` — turnos com `data > aPartirDe` e status `planejado` cuja execução dessa atividade tem `qtd_realizada === null`; `nova = sugestaoDoDia(a, dia, realizadoAte(outras execuções))`. Exige `ExecucaoLigada.id` (já existe) e o tipo da execução: acrescentar `tipo` ao select de `obterDadosSemana` e só considerar cópias com tipo nulo.
- Produces (banco, `lib/db/foraDoDia.ts`):
  - `puxarDaSemana(c: SupabaseClient, turnoId: string, programacaoAtividadeId: string, modo: "adiantar" | "atrasada", criadaPorId: string | null, escopo: string | null): Promise<Resultado>` — recalcula `opcoesParaPuxar(dados, turno, escopo)`; se o id não estiver na lista do modo → `falha("Esta atividade não está disponível. Recarregue a página.")`; insere `{ tipo: modo === "adiantar" ? "adiantada" : null, programacao_atividade_id, descricao, local, unidade, qtd_planejada: saldo, responsavel_id: a.responsavel_id, criada_por_id }`; violação de unicidade 23505 → `ok` (já está no turno).
  - `lancarExtra(c, turnoId, dados: DadosExtra, criadaPorId: string | null): Promise<Resultado>` — insere com o id do cliente, `tipo: "extra"`, `qtd_realizada: qtd`; se o id já existir no mesmo turno com os mesmos campos → ok; diferente → `falha("Este registro já existe com outros dados. Recarregue a página.")`.
  - `removerForaDoDia(c, turnoId, atividadeId, criadaPorId: string | null): Promise<Resultado>` — com `criadaPorId` não nulo só apaga se `criada_por_id = criadaPorId`; remove a foto (removerFoto) se houver.
  - `reajustarCopiasFuturas(c, programacaoAtividadeId: string, dataTurno: string): Promise<void>` — melhor esforço (só `console.error`): update `qtd_planejada` ou delete conforme `copiasParaAjustar`.
  - Campo (`campo.ts`, admin + `turnoAberto`): `opcoesPuxarCampo(turno: TurnoCompleto, responsavelId: string): Promise<{adiantar; atrasadas}>`, `puxarCampo(token, programacaoAtividadeId, modo, responsavelId: string)`, `lancarExtraCampo(token, dados, responsavelId: string)` (força `responsavel_id = criadaPorId = responsavelId`), `removerForaDoDiaCampo(token, atividadeId, responsavelId: string)`.
  - Planejador (sessão, `turnoAbertoParaCorrecao` ou `turnoEditavel`): `puxarPlanejador(c, turnoId, id, modo)`, `lancarExtraPlanejador(c, turnoId, dados)`, `opcoesPuxarPlanejador(c, turno): Promise<{adiantar; atrasadas}>` (escopo null).
  - `responsaveisDoTurno`: soma os `responsavel_id` das `programacao_atividades` da semana programada do turno (`semanaDoTurno`) com o mesmo período.
  - `salvarExecucao`/`salvarExecucaoPlanejador`: ler `tipo, programacao_atividade_id` junto; extra → `concluida = true` e erro do gatilho vira `ERRO_EXTRA_SEM_QTD`; adiantada → depois do sucesso, `await reajustarCopiasFuturas(...)` com a data do turno.
  - Fotos: generalizar `enviar` de fotosParada.ts para alvo `{ tabela: "efetivo_ocorrencias" | "atividades", id }`; extra usa caminho `<empresa>/<obra>/<turno>/extra-<atividade>.jpg` no mesmo bucket `paradas`, e só aceita atividade `tipo = 'extra'` (campo: `criada_por_id = responsavelId`). Exportar `enviarFotoExtraCampo(token, atividadeId, responsavelId, form)` e `enviarFotoExtraPlanejador(c, turnoId, atividadeId, form)`.

- [ ] **Step 1: Testes de domínio** (`fora-do-dia.test.ts`, semana seg 2026-11-16, turno qua 2026-11-18 diurno):
  - `adiantar só futuras dele` — pintura dias [3,4] da Rita, meta 80 → adiantar [{saldo 80}] para Rita; para Carlos → [].
  - `atrasada vai para atrasadas` — dias [0,1] meta 10, realizado 4 → atrasadas [{saldo 6}], adiantar [].
  - `com hoje e passado é atrasada` — dias [1,2] → atrasadas.
  - `só hoje não aparece` — dias [2] → ambas vazias.
  - `já no turno some` e `saldo zero some` e `outro período some` e `semana rascunho → vazio`.
  - `copiasParaAjustar` — qui planejado com cópia sem execução, adiantada qua com 50 de 80 → nova = 30 (último dia) ; com 80 → nova null; turno qui em_campo → nada.
  - `validarExtra` — qtd 0 → falha; descrição vazia → falha; ok devolve trim.
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/fora-do-dia.test.ts` → FAIL; implementar `lib/dominio/foraDoDia.ts`; → PASS.
- [ ] **Step 3: Testes de integração** (`fora-do-dia.test.ts`): `lancarExtraCampo cria com criada_por_id`; `lancarExtra reenvio` (mesmo id duas vezes → 1 linha, ok); `puxar de outro responsável recusa`; `puxar duas vezes não duplica`; `remover só o que criou` (outro responsável → falha, linha fica); `salvarExecucao em adiantada reajusta quinta`; `salvarExecucao extra para null → ERRO_EXTRA_SEM_QTD`; `responsaveisDoTurno inclui quem só tem programação na semana`; `foto de extra grava foto_path`.
- [ ] **Step 4: Rodar** `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/fora-do-dia.test.ts` → FAIL; implementar `lib/db/foraDoDia.ts` e ajustes; → PASS. Rodar também `tests/integracao/campo.test.ts tests/integracao/execucao.test.ts tests/integracao/fotos-parada.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(extra): puxar da semana, lançar extra e reajustar cópias`

### Task 4: Observação mantida em atividade concluída

**Files:**
- Modify: `lib/db/validacao.ts` (camposExecucao), `components/execucao/BlocoAtividades.tsx`
- Test: `tests/dominio/` (teste existente de camposExecucao/BlocoAtividades, ou novo `observacao-concluida.test.tsx`)

- [ ] **Step 1: Testes** — `camposExecucao(true, {qtd_realizada: 10, causa: "material", observacao: " ok "})` → `{ qtd_realizada: 10, causa: null, observacao: "ok" }`; componente: atividade concluída mostra o textarea "Observação" (getByLabelText) e não mostra "Causa do não cumprimento".
- [ ] **Step 2: Rodar** → FAIL. Implementar: observação sempre gravada e visível; causa só em não concluída; extra não mostra "✓ Concluída" e o rótulo do campo vira "Feito (<unidade>)".
- [ ] **Step 3: Rodar** `npx vitest run tests/dominio` → PASS (ajustar testes antigos que esperavam observação nula em concluída).
- [ ] **Step 4: Commit** `fix(execucao): observação não some em atividade concluída`

### Task 5: Tela do campo

**Files:**
- Create: `components/execucao/ForaDoDia.tsx`
- Modify: `app/t/[token]/acoes.ts`, `app/t/[token]/page.tsx`, `app/t/[token]/FormularioCampo.tsx`, `components/execucao/BlocoAtividades.tsx` (selos), `lib/dominio/whatsapp.ts`
- Test: `tests/dominio/fora-do-dia-ui.test.tsx`, `tests/dominio/whatsapp.test.ts`

**Interfaces:**
- Consumes: Task 3 (`opcoesPuxarCampo`, `puxarCampo`, `lancarExtraCampo`, `removerForaDoDiaCampo`, `enviarFotoExtraCampo`).
- Produces: `ForaDoDia` props `{ adiantar: OpcaoPuxar[]; atrasadas: OpcaoPuxar[]; responsaveis?: ResponsavelRef[] /* só planejador: escolher responsável do extra */; somenteLeitura?: boolean; puxar(id: string, modo: "adiantar" | "atrasada"): Promise<Resultado>; lancarExtra(d: DadosExtra, foto: File | null): Promise<Resultado>; linkWhats?: (texto: string) => string; aoConcluir(): void /* router.refresh */ }`. `BlocoAtividades` ganha prop `autorDe?: (a: Atividade) => string | null` e `remover?: (a: Atividade) => void` (botão "Remover" só em atividade com tipo/criada_por_id permitida). `mensagemExtra(p: Contexto & { descricao: string; qtd: number; unidade: string }): string` → `"➕ Extra — <onde>\n<equipe>: <descricao> — <qtd> <unidade>"`.

Comportamento:
- Botões abaixo das atividades, só com responsável escolhido e turno editável (`!somenteLeitura && responsavelId !== null`). "Continuar atividade atrasada" só com `atrasadas.length > 0`.
- Adiantar/atrasada: lista "Pintura — Qui/Sex — saldo 40 m²" (dias com `ROTULO_DIA` curto existente); toque → `puxar` → refresh. Vazia: texto exato da Global Constraints.
- Extra: campos Descrição, Quantidade feita, Unidade, Observação (opcional), Foto (opcional, mesma entrada da parada). Gera `crypto.randomUUID()` ao abrir o formulário (reenvio reutiliza). Repetição via o mecanismo de `repeticao.ts`/`rastreioSalvamento` já usado na parada. Depois de gravar: link "Avisar o planejador no WhatsApp" com `mensagemExtra`.
- Selos no cartão: "Extra" / "Adiantada"; `autorDe` no campo → "lançado por você" quando `criada_por_id === responsavelId`.
- page.tsx: `opcoesPuxarCampo` só quando há responsável escolhido; `urlsFotos` também com `foto_path` das atividades.

- [ ] **Step 1: Testes** — `ForaDoDia`: mostra os três botões; lista vazia mostra o texto exato; toque em "Pintura" chama `puxar("p1","adiantar")`; extra com qtd vazia não envia e mostra "Informe a quantidade"; envio chama `lancarExtra` com o mesmo id em duas tentativas. whatsapp: `mensagemExtra` exato.
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/fora-do-dia-ui.test.tsx tests/dominio/whatsapp.test.ts` → FAIL; implementar; → PASS.
- [ ] **Step 3: Commit** `feat(campo): adiantar, continuar atrasada e serviço extra no link`

### Task 6: Tela do turno do planejador

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `acoesExecucao.ts`, `EdicaoExecucao.tsx`, `ItemAtividade.tsx`
- Test: `tests/dominio/` (teste de ItemAtividade/EdicaoExecucao existente ou novo `fora-do-dia-planejador.test.tsx`)

**Interfaces:**
- Consumes: Task 3 (`opcoesPuxarPlanejador`, `puxarPlanejador`, `lancarExtraPlanejador`, `removerForaDoDia`, `enviarFotoExtraPlanejador`), Task 5 (`ForaDoDia`, `autorDe`).

- [ ] **Step 1: Testes** — com turno em_campo: `ForaDoDia` visível fora do `<details>` "Editar planejamento"; extra no planejador exige escolher responsável (select com "Sem responsável"); cartão com `criada_por_id` mostra "lançado pelo campo — Carlos Pereira"; ItemAtividade (planejamento) mostra selo "Extra"/"Adiantada".
- [ ] **Step 2: Rodar** → FAIL; implementar ações server (`revalidatePath` como as vizinhas) e montar `ForaDoDia` acima de `EdicaoExecucao` (turno não fechado e não planejado). → PASS.
- [ ] **Step 3: Commit** `feat(turno): serviço extra e adiantar no planejador`

### Task 7: E2E, revisão e publicação

**Files:**
- Create: `tests/e2e/servico-extra.spec.ts`

- [ ] **Step 1: E2E** (abrir a página do planejador ANTES do celular; pré-aquecer rotas com `page.request.get`): Carlos lança "Troca de iluminação da plataforma 3", 12 un → aparece no quadro "+1 extra" e no turno com "lançado pelo campo — Carlos"; Rita adianta a pintura de quinta e lança 40 → semana mostra realizado 40; planejador fecha o turno sem erro de causa.
- [ ] **Step 2: Rodar** `$env:SUPABASE_TEST='1'; npx playwright test` → PASS; `npx vitest run` (tudo, com SUPABASE_TEST) → PASS; `npx tsc --noEmit` e `npm run lint` limpos.
- [ ] **Step 3: Revisão final** por subagente sobre o diff da branch; corrigir o que for importante.
- [ ] **Step 4: Publicar prévia** — `git push -u origin servico-extra` (prévia Vercel); usuário valida.
- [ ] **Step 5: Produção** — aplicar a migration no PROD (SQL Editor), `git merge --no-ff servico-extra` na main, `git push`; marcar o item 7 como feito em docs/backlog.md e atualizar a memória do roadmap.
