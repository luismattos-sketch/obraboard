# Nome da empresa no RDO + "Minha empresa" (7.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cabeçalho fixo do RDO (turno e capa do lote) mostra o nome da empresa, editável na nova página "Minha empresa".

**Architecture:** O nome vem sempre de `empresas.nome` atual (lido com o cliente do usuário; a RLS só devolve a empresa dele), nunca da foto da versão. Os renderizadores recebem `empresaNome` como dado. Escrita via migration que dá ao dono `update (nome)` com policy própria.

**Tech Stack:** Next.js (app router, server actions), Supabase (RLS), @react-pdf/renderer, Vitest, Playwright (capturas).

**Spec:** `docs/superpowers/specs/2026-11-26-nome-empresa-rdo-design.md`

## Global Constraints

- Sem `localStorage`/`sessionStorage`.
- Cabeçalho: `[logo Frentia]   NOME DA EMPRESA (centralizado)   RDO · obra · data` — negrito, cor primária, uma linha, nome longo cortado com "…".
- Rótulo do campo: `Nome da empresa (aparece no RDO)`. Aviso abaixo: `Trocar o logo do Frentia pelo da sua empresa: disponível no plano pago (em breve)`.
- Obrigatório: vazio → `Informe o nome da empresa.`; acima de `LIMITES.empresa` → `mensagemMaximo(LIMITES.empresa)` (mesmas regras do cadastro em `app/(publico)/auth-acoes.ts`).
- Salva sozinho com `useAutoSalvar` + `IndicadorSalvo` (components/execucao/).
- Nada de logo, upload ou noção de plano (7.6).
- Testes: PowerShell com cwd `C:\` maiúsculo.

## Review Focus

- Nome com emoji/acentos → passa por `sanitizarProfundo` como o resto do texto; PDF renderiza (teste na Task 2).
- Nome de 120 caracteres → uma linha com "…", sem empurrar o título da direita (teste de `nomeCabecalho` na Task 2).
- Falha ao ler o nome (null) → PDF sai sem o nome, nunca 500 (Task 3).
- Usuário de outra empresa tentando mudar o nome → bloqueado pela RLS (teste na Task 1).
- Só espaços no campo → tratado como vazio, não salva (Task 1).

---

### Task 1: Migration + leitura/escrita do nome

**Files:**
- Create: `supabase/migrations/20261204000000_empresa_nome_update.sql`
- Create: `lib/dominio/empresa.ts`
- Modify: `lib/db/empresas.ts`
- Test: `tests/dominio/empresa.test.ts`, `tests/integracao/empresa-nome.test.ts`

**Interfaces:**
- Produces: `validarNomeEmpresa(bruto: string): { ok: true; nome: string } | { ok: false; erro: string }`; `obterNomeEmpresa(c: SupabaseClient): Promise<string | null>`; `editarNomeEmpresa(c: SupabaseClient, bruto: string): Promise<Resultado<{ nome: string }>>`.

- [ ] **Step 1: Testes que falham.** Domínio: `"  Acme  "` → `{ok:true, nome:"Acme"}`; `"   "` → erro `Informe o nome da empresa.`; `"x".repeat(LIMITES.empresa+1)` → `mensagemMaximo(LIMITES.empresa)`. Integração (padrão de `tests/integracao/rls.test.ts`, usuários A e B): A edita para `"Nova A"` e `obterNomeEmpresa` de A devolve `"Nova A"`; B faz `update` direto em `empresas` com o id de A → nenhuma linha alterada e o nome de A continua `"Nova A"`.
- [ ] **Step 2:** Rodar `npx vitest run tests/dominio/empresa.test.ts tests/integracao/empresa-nome.test.ts` → FAIL.
- [ ] **Step 3: Migration.** `grant update (nome) on public.empresas to authenticated;` + policy `empresas_update_dono` `for update to authenticated using (exists (select 1 from public.membros m where m.empresa_id = id and m.user_id = auth.uid() and m.papel = 'dono')) with check (` mesma condição `)`. Aplicar no banco de teste.
- [ ] **Step 4: Código.** `obterNomeEmpresa`: `select nome from empresas limit 1` (RLS filtra); erro → `null` com `console.error`. `editarNomeEmpresa`: valida, busca o id com o mesmo select, `update({nome}).eq("id", id).select("nome").single()`; falha → `{ok:false, erro:"Não foi possível salvar o nome."}`. `lib/db/empresas.ts` é `server-only`; manter.
- [ ] **Step 5:** Mesmo comando → PASS.
- [ ] **Step 6: Commit** `feat(empresa): dono pode editar o nome da empresa (7.5)`.

### Task 2: Nome no cabeçalho do PDF

**Files:**
- Modify: `lib/rdo/formatar.ts`, `lib/rdo/estilos.ts`, `lib/rdo/documento.tsx`, `lib/rdo/capa-lote.tsx`
- Test: `tests/dominio/rdo.test.tsx`

**Interfaces:**
- Produces: `nomeCabecalho(nome: string | null | undefined, max = 48): string | null` (trim; vazio → null; maior que `max` → `slice(0, max-1).trimEnd() + "…"`); prop `empresaNome?: string | null` em `DocumentoRdo`; campo `empresaNome: string | null` em `CabecalhoLote`; estilo `s.empresaFixo` (`flex: 1, textAlign: "center", marginHorizontal: 8`, mesma fonte/cor de `tituloFixo`).

- [ ] **Step 1: Testes que falham.** `nomeCabecalho("  Acme ")` = `"Acme"`; `nomeCabecalho("")` = `null`; `nomeCabecalho("a".repeat(120))` tem 48 caracteres e termina em `"…"`. `DocumentoRdo` com `empresaNome="Construtora Ação 🚧"` renderiza (buffer não vazio, sem erro). `CapaLote` com `empresaNome` renderiza.
- [ ] **Step 2:** `npx vitest run tests/dominio/rdo.test.tsx` → FAIL.
- [ ] **Step 3:** Entre o logo e o título fixo, `{nome && <Text style={s.empresaFixo}>{nome}</Text>}` nos dois componentes, com `nome = nomeCabecalho(sanitizarProfundo(empresaNome))`. Sem nome, cabeçalho igual ao de hoje.
- [ ] **Step 4:** Mesmo comando → PASS. Gerar o PDF de exemplo do teste existente e conferir visualmente: três blocos numa linha.
- [ ] **Step 5: Commit** `feat(rdo): nome da empresa no cabeçalho do RDO e da capa (7.5)`.

### Task 3: Ligar o nome aos downloads

**Files:**
- Modify: `lib/rdo/responder.ts`, `lib/rdo/lote.ts`, `app/api/rdo/[turnoId]/route.ts`
- Test: `tests/integracao/rdo-lote.test.ts` (ou o teste de download existente)

**Interfaces:**
- Consumes: `obterNomeEmpresa` (Task 1), `empresaNome` (Task 2).
- Produces: `renderizarRdo(turno, emissao, fotos?, empresaNome?: string | null)`; `respostaPdf(turno, emissao, nomeArquivo, empresaNome: string | null)`; `respostaVersao(c, versaoId)` lê o nome por conta própria; `montarLote(lote, versoes, cabecalho)` repassa `cabecalho.empresaNome` a cada `renderizarRdo`.

- [ ] **Step 1: Teste que falha.** Com o usuário de teste com empresa `"Empresa Teste PDF"`, o PDF do lote (via `respostaLote`) contém o texto `Empresa Teste PDF` (extrair com `pdf-lib`/busca no buffer descomprimido, como os testes atuais do lote fazem; se não houver padrão, testar que `montarLote` chama `renderizarRdo` com o nome via spy).
- [ ] **Step 2:** Rodar o teste → FAIL.
- [ ] **Step 3:** Rota do rascunho e `respostaVersao` chamam `obterNomeEmpresa(c)`; `respostaLote` põe `empresaNome: await obterNomeEmpresa(c)` no cabeçalho. Versões emitidas não são regravadas (o nome não entra na foto).
- [ ] **Step 4:** Teste → PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** `feat(rdo): downloads usam o nome atual da empresa (7.5)`.

### Task 4: Página "Minha empresa" + menu + manual

**Files:**
- Create: `app/(app)/empresa/page.tsx`, `app/(app)/empresa/NomeEmpresa.tsx`, `app/(app)/empresa/acoes.ts`, `lib/ajuda/conteudo/` (passo novo em `primeiros-passos.ts`)
- Modify: `components/navegacao/MenuLateral.tsx`, `lib/ajuda/novidades.ts`, `tests/manual/capturas.spec.ts` (se o passo precisar de preparo)
- Test: `tests/e2e/` (spec da página, no padrão dos existentes)

**Interfaces:**
- Consumes: `obterNomeEmpresa`, `editarNomeEmpresa` (Task 1).
- Produces: rota `/empresa`; `salvarNomeEmpresaAcao(nome: string): Promise<Resultado<{ nome: string }>>` (`"use server"`, chama `editarNomeEmpresa(await criarClienteServidor(), nome)`).

- [ ] **Step 1: Teste e2e que falha:** entra, abre "Minha empresa" pelo menu, troca o nome, vê `Salvo ✓`, recarrega e o campo mantém o nome; apagar tudo mostra `Informe o nome da empresa.`; o aviso do logo está visível.
- [ ] **Step 2:** Rodar o e2e → FAIL.
- [ ] **Step 3:** `page.tsx` (server): título "Minha empresa", `Cartao` com `NomeEmpresa inicial={nome}` e `Aviso` com o texto do plano pago. `NomeEmpresa` (client): input controlado, `useAutoSalvar(() => salvarNomeEmpresaAcao(valor), [valor.trim()])`, `IndicadorSalvo`. Menu: link `/empresa` "Minha empresa" logo antes de "Ajuda", ícone de prédio (path SVG no mesmo formato dos `ICONE_*`), `aria-current` e `title` quando recolhido como os vizinhos.
- [ ] **Step 4:** e2e → PASS.
- [ ] **Step 5: Manual e Novidades.** Passo `minha-empresa` em `primeiros-passos.ts` após `criar-conta`: "No menu lateral, \"Minha empresa\" mostra o nome que aparece no cabeçalho de todo RDO. Para corrigir, digite o nome novo: salva sozinho." com captura (`alvo: { papel: "textbox", nome: "Nome da empresa (aparece no RDO)" }`, `dispositivo: "computador"`). Linha em `NOVIDADES` (data `2026-11-27`): "O RDO agora traz o nome da sua empresa no cabeçalho de todas as páginas. Para corrigir o nome, use \"Minha empresa\" no menu lateral." `href: "/ajuda/primeiros-passos#minha-empresa"`. Rodar `SUPABASE_TEST=1 MANUAL_CAPITULO=primeiros-passos npm run manual:capturas`. Fluxograma não muda.
- [ ] **Step 6:** Suíte completa (`npx vitest run`, `npx tsc --noEmit`, `npm run lint`) verde.
- [ ] **Step 7: Commit** `feat(empresa): página Minha empresa no menu, manual e novidades (7.5)`; aplicar a migration em produção, PR, merge, deploy Vercel, marcar 7.5 no backlog.
