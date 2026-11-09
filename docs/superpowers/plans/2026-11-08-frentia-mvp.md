# Frentia MVP (ciclo do turno) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o app do zero como Frentia: planejador com login planeja turnos, encarregado lança a execução por link no celular, e o planejador vê o resumo do turno e baixa o RDO em PDF.

**Architecture:** Next.js 16 App Router com Server Components e Server Actions; o navegador nunca acessa tabelas. Supabase Auth + Postgres com RLS para o planejador (cliente com sessão via `@supabase/ssr`); a página de campo valida um token (SHA-256 guardado no banco) e usa o cliente service role restrito às operações de execução. Regras de negócio puras em `lib/dominio/`, testadas com Vitest.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, `@react-pdf/renderer`, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-08-frentia-mvp-design.md`

## Global Constraints

- Antes de usar qualquer API do Next, ler o guia em `node_modules/next/dist/docs/01-app/`. Em Next 16: `middleware.ts` chama-se **`proxy.ts`** (export `proxy`); `params` e `searchParams` são **Promises** (`await params`); `cookies()` é async.
- Proibido `localStorage`/`sessionStorage` em qualquer arquivo da aplicação.
- A chave `SUPABASE_SERVICE_ROLE_KEY` só é lida em arquivos com `import "server-only"`; nunca em variável `NEXT_PUBLIC_`.
- Variáveis de ambiente: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Textos de interface em português do Brasil. Nome do produto: **Frentia**. Logo: `public/frentia-logo.png`.
- Nenhum arquivo acima de ~300 linhas.
- Formas de dados usam os nomes de coluna do banco (snake_case) em todas as camadas — sem mapeamento para camelCase.
- Datas "de hoje" sempre no fuso `America/Sao_Paulo` (o servidor Vercel roda em UTC).
- Todo trabalho acontece na branch `frentia`; deploy só como **preview** (`npx vercel`, sem `--prod`) até o merge final. Ao concluir cada task que altera o app, gerar um preview (regra do `AGENTS.md`).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ambiente sem Docker: testes de integração e E2E rodam contra o projeto Supabase **de desenvolvimento** do Frentia, criando e removendo seus próprios dados; ficam desligados sem `SUPABASE_TEST=1`.

## Review Focus

- Número digitado com vírgula no celular ("2,5") deve virar 2.5, não erro nem 25 — teste em Task 2 (`parseNumero`).
- Às 22h em Brasília o "hoje" do servidor (UTC) já é amanhã; o novo turno deve sugerir a data de Brasília — teste em Task 2 (`hojeSaoPaulo`).
- Clicar duas vezes em "Trazer pendentes" não pode duplicar atividades — teste em Task 7 (filtra por `origem_id` já presente).
- Encarregado com a página aberta após "Gerar novo link", ou após o planejador remover uma atividade, deve receber mensagem clara, não erro 500 — teste em Task 9.
- Criar dois turnos na mesma obra, data e período deve dar mensagem "Já existe um turno diurno nesse dia", não erro do banco — teste em Task 7.

---

## File Structure

```
proxy.ts                               renova sessão; protege /obras
lib/dominio/tipos.ts                   tipos e constantes (status, períodos, causas, condições)
lib/dominio/calculos.ts                statusAtividade, percentualCumprimento, horasEntre, hhTurno, saldoPendente
lib/dominio/regras.ts                  errosDeCausa, transicaoTurno, compararTurnos
lib/dominio/entrada.ts                 parseNumero, hojeSaoPaulo
lib/dominio/token.ts                   gerarToken, hashToken (node:crypto)
lib/supabase/servidor.ts               cliente com sessão (cookies)
lib/supabase/admin.ts                  cliente service role (server-only)
lib/supabase/proxy.ts                  atualizarSessao(request)
lib/db/resultado.ts                    tipo Resultado e helpers
lib/db/obras.ts                        listar/obter/criar obra
lib/db/turnos.ts                       listar/obter/criar turno, transições, link
lib/db/atividades.ts                   CRUD de atividades e pendentes (planejador)
lib/db/campo.ts                        operações do encarregado por token
lib/rdo/documento.tsx                  componente @react-pdf do RDO
app/(publico)/...                      landing, login, cadastro, recuperar/redefinir senha, termos, privacidade
app/auth/confirmar/route.ts            confirmação de e-mail e recuperação
app/(app)/layout.tsx                   cabeçalho logado
app/(app)/obras/...                    telas do planejador
app/t/[token]/...                      página do encarregado
app/api/rdo/[turnoId]/route.ts         PDF
components/ui/*.tsx                    Botao, Campo, Cartao, Selo, Aviso
supabase/migrations/20261108000000_frentia_schema.sql
tests/dominio/*.test.ts                Vitest unitário
tests/integracao/*.test.ts             Vitest contra Supabase dev (SUPABASE_TEST=1)
tests/e2e/ciclo-turno.spec.ts          Playwright
```

---

### Task 1: Backup do legado, branch `frentia` e esqueleto

**Files:**
- Create: `vitest.config.ts`, `tests/dominio/sanidade.test.ts`, `app/layout.tsx`, `app/globals.css`, `app/(publico)/page.tsx` (placeholder "Frentia — em breve")
- Modify: `package.json`, `.env.example`, `next.config.ts`
- Delete: todo o resto (ver Step 4)

**Interfaces:**
- Produces: scripts `npm test` (vitest run), `npm run test:e2e` (playwright test), `npm run build`, `npm run lint`; alias `@/*` → raiz.

- [ ] **Step 1: Conferir que nenhum segredo vai para o commit do legado**

Run: `git status --porcelain | grep -E "\.env($|\.)" | grep -v ".env.example"`
Expected: nenhuma linha.

- [ ] **Step 2: Salvar o estado atual na branch de legado**

```bash
git checkout -b legado-obrasapp
git add -A
git commit -m "chore: estado final do ObrasApp antes da reconstrução Frentia"
git tag obrasapp-final
git push -u origin legado-obrasapp --tags   # pedir confirmação ao usuário antes do push
```

- [ ] **Step 3: Criar a branch `frentia` a partir do `main` e trazer os arquivos de marca do legado**

```bash
git checkout -b frentia main
git checkout legado-obrasapp -- app/icon.png app/apple-icon.png app/favicon.ico public/frentia-logo.png docs/superpowers
```

- [ ] **Step 4: Remover todo o código antigo**

Remover (git rm / rm) tudo exceto: `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`, `public/frentia-logo.png`, `docs/superpowers/`, `.env.example`, `.gitignore`, `.vercel/` (não versionado), `AGENTS.md`, `CLAUDE.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `node_modules/`. Inclui apagar logs, `*.bat`, `*.cmd`, `*.pid`, `outputs/`, `tools/`, `supabase/`, `README.md` (recriado curto em Task 11).

- [ ] **Step 5: Ajustar dependências**

```bash
npm pkg set name=frentia
npm uninstall recharts
npm install @supabase/ssr @supabase/supabase-js @react-pdf/renderer server-only
npm install -D vitest @playwright/test
npx playwright install chromium
npm pkg set scripts.test="vitest run" scripts.test:e2e="playwright test"
```

`.env.example`: manter as quatro variáveis da seção Global Constraints, remover as de Mercado Pago, `NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co`.
`next.config.ts`: manter `allowedDevOrigins`; adicionar `serverExternalPackages: ["@react-pdf/renderer"]`.
`vitest.config.ts`: ambiente `node`, alias `@` → raiz, `include: ["tests/dominio/**/*.test.ts", "tests/integracao/**/*.test.ts"]`.

- [ ] **Step 6: Escrever `tests/dominio/sanidade.test.ts`** (`expect(1 + 1).toBe(2)`) e o layout raiz com `<html lang="pt-BR">`, `metadata.title = "Frentia"`, fonte via `next/font/google` (Inter) e Tailwind importado em `globals.css`.

- [ ] **Step 7: Verificar**

Run: `npm test && npm run lint && npm run build`
Expected: 1 teste passando; lint e build sem erros.

- [ ] **Step 8: Commit e preview**

```bash
git add -A
git commit -m "chore: recomeçar como Frentia (esqueleto Next 16 + Vitest + Playwright)"
npx vercel
```
Expected: URL de preview mostrando "Frentia — em breve".

---

### Task 2: Domínio — tipos, cálculos e entrada

**Files:**
- Create: `lib/dominio/tipos.ts`, `lib/dominio/calculos.ts`, `lib/dominio/entrada.ts`
- Test: `tests/dominio/calculos.test.ts`, `tests/dominio/entrada.test.ts`
- Delete: `tests/dominio/sanidade.test.ts`

**Interfaces:**
- Produces (`tipos.ts`):
  - `type Periodo = "diurno" | "noturno"`
  - `type StatusTurno = "planejado" | "em_campo" | "enviado" | "fechado"`
  - `type StatusAtividade = "concluida" | "parcial" | "nao_iniciada"`
  - `type Causa = "material" | "mao_de_obra" | "equipamento" | "projeto_informacao" | "clima" | "atividade_predecessora" | "liberacao_area" | "seguranca" | "outro"`
  - `const CAUSAS: Record<Causa, string>` com rótulos: Material, Mão de obra, Equipamento, Projeto/Informação, Clima, Atividade predecessora, Liberação de área/Interferência, Segurança, Outro
  - `type PeriodoClima = "manha" | "tarde" | "noite"`; `type CondicaoClima = "bom" | "chuva_leve" | "chuva_forte"`; `const CONDICOES: Record<CondicaoClima,string>` (Bom, Chuva leve, Chuva forte)
  - `const ROTULO_STATUS_TURNO: Record<StatusTurno,string>` (Planejado, Em campo, Enviado, Fechado); `const ROTULO_STATUS_ATIVIDADE` (Concluída, Parcial, Não iniciada)
  - `const FUNCOES_SUGERIDAS = ["Pedreiro","Servente","Carpinteiro","Armador","Eletricista","Encanador","Pintor","Encarregado","Operador"]`
  - `type AtividadeExec = { id: string; descricao: string; qtd_planejada: number; qtd_realizada: number | null; causa: Causa | null; observacao: string | null }`
- Produces (`calculos.ts`):
  - `statusAtividade(qtd_planejada: number, qtd_realizada: number | null): StatusAtividade`
  - `percentualCumprimento(atividades: Pick<AtividadeExec,"qtd_planejada"|"qtd_realizada">[]): number | null` — fração 0..1
  - `horasEntre(inicio: string | null, fim: string | null): number | null` — "HH:MM"; fim < início soma 24 h
  - `hhTurno(efetivo: { quantidade: number }[], previsto: {inicio: string|null; fim: string|null}, real: {inicio: string|null; fim: string|null}): number | null` — usa real se ambos informados, senão previsto
  - `saldoPendente(qtd_planejada: number, qtd_realizada: number | null): number`
- Produces (`entrada.ts`):
  - `parseNumero(texto: string): number | null` — aceita "2,5", "2.5", " 3 "; vazio/inválido/negativo → null
  - `hojeSaoPaulo(agora?: Date): string` — "AAAA-MM-DD"

- [ ] **Step 1: Escrever os testes que falham**

```ts
// calculos.test.ts
expect(statusAtividade(10, 10)).toBe("concluida");
expect(statusAtividade(10, 12)).toBe("concluida");
expect(statusAtividade(10, 4)).toBe("parcial");
expect(statusAtividade(10, 0)).toBe("nao_iniciada");
expect(statusAtividade(10, null)).toBe("nao_iniciada");
expect(percentualCumprimento([])).toBeNull();
expect(percentualCumprimento([{qtd_planejada:10,qtd_realizada:10},{qtd_planejada:5,qtd_realizada:2}])).toBe(0.5);
expect(horasEntre("07:00","17:00")).toBe(10);
expect(horasEntre("22:00","06:00")).toBe(8);
expect(horasEntre("07:30", null)).toBeNull();
expect(hhTurno([{quantidade:4},{quantidade:2}], {inicio:"07:00",fim:"17:00"}, {inicio:null,fim:null})).toBe(60);
expect(hhTurno([{quantidade:4}], {inicio:"07:00",fim:"17:00"}, {inicio:"07:00",fim:"16:00"})).toBe(36);
expect(hhTurno([], {inicio:null,fim:null}, {inicio:null,fim:null})).toBeNull();
expect(saldoPendente(10, 4)).toBe(6);
expect(saldoPendente(10, null)).toBe(10);
// entrada.test.ts
expect(parseNumero("2,5")).toBe(2.5);
expect(parseNumero("2.5")).toBe(2.5);
expect(parseNumero(" 3 ")).toBe(3);
expect(parseNumero("")).toBeNull();
expect(parseNumero("abc")).toBeNull();
expect(parseNumero("-1")).toBeNull();
expect(hojeSaoPaulo(new Date("2026-11-09T01:30:00Z"))).toBe("2026-11-08");
expect(hojeSaoPaulo(new Date("2026-11-08T15:00:00Z"))).toBe("2026-11-08");
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar `tipos.ts`, `calculos.ts`, `entrada.ts`** com as assinaturas acima. `hojeSaoPaulo` usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`.
- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(dominio): status, cumprimento, HH e entrada numérica"`

---

### Task 3: Domínio — regras de causa, transições, ordenação e token

**Files:**
- Create: `lib/dominio/regras.ts`, `lib/dominio/token.ts`
- Test: `tests/dominio/regras.test.ts`, `tests/dominio/token.test.ts`

**Interfaces:**
- Consumes: tipos e `statusAtividade` da Task 2.
- Produces:
  - `errosDeCausa(atividades: AtividadeExec[]): Record<string, string>` — chave = id da atividade; mensagens exatas: `"Informe a causa para atividades não concluídas"` e `"Descreva a causa na observação"` (causa `outro` sem observação)
  - `type AcaoTurno = "liberar" | "enviar" | "fechar" | "reabrir"`
  - `transicaoTurno(atual: StatusTurno, acao: AcaoTurno, dados: { atividades: AtividadeExec[] }): { ok: true; novo: StatusTurno } | { ok: false; erro: string }`
    - liberar: planejado → em_campo; exige ≥ 1 atividade (`"Adicione ao menos uma atividade"`)
    - enviar: em_campo → enviado; exige `errosDeCausa` vazio (`"Há atividades sem causa informada"`)
    - fechar: em_campo|enviado → fechado; mesma exigência
    - reabrir: fechado → enviado
    - qualquer outra combinação: `{ ok:false, erro:"Ação não permitida para turno <rótulo>" }`
  - `compararTurnos(a: {data: string; periodo: Periodo}, b: {data: string; periodo: Periodo}): number` — por data, depois diurno < noturno
  - `gerarToken(): string` — 32 bytes, base64url (43 caracteres)
  - `hashToken(token: string): string` — SHA-256 em hex (64 caracteres)

- [ ] **Step 1: Escrever os testes que falham**

```ts
const a = (p: Partial<AtividadeExec>): AtividadeExec => ({ id:"1", descricao:"x", qtd_planejada:10, qtd_realizada:10, causa:null, observacao:null, ...p });
expect(errosDeCausa([a({})])).toEqual({});
expect(errosDeCausa([a({qtd_realizada:3})])).toEqual({ "1": "Informe a causa para atividades não concluídas" });
expect(errosDeCausa([a({qtd_realizada:0, causa:"outro"})])).toEqual({ "1": "Descreva a causa na observação" });
expect(errosDeCausa([a({qtd_realizada:0, causa:"clima"})])).toEqual({});
expect(transicaoTurno("planejado","liberar",{atividades:[]})).toEqual({ok:false, erro:"Adicione ao menos uma atividade"});
expect(transicaoTurno("planejado","liberar",{atividades:[a({qtd_realizada:null})]})).toEqual({ok:true, novo:"em_campo"});
expect(transicaoTurno("em_campo","enviar",{atividades:[a({qtd_realizada:2})]})).toEqual({ok:false, erro:"Há atividades sem causa informada"});
expect(transicaoTurno("enviado","fechar",{atividades:[a({})]})).toEqual({ok:true, novo:"fechado"});
expect(transicaoTurno("em_campo","fechar",{atividades:[a({})]})).toEqual({ok:true, novo:"fechado"});
expect(transicaoTurno("fechado","reabrir",{atividades:[]})).toEqual({ok:true, novo:"enviado"});
expect(transicaoTurno("fechado","enviar",{atividades:[a({})]})).toEqual({ok:false, erro:"Ação não permitida para turno Fechado"});
expect([{data:"2026-11-08",periodo:"noturno"},{data:"2026-11-08",periodo:"diurno"},{data:"2026-11-07",periodo:"noturno"}].sort(compararTurnos).map(t=>t.data+t.periodo))
  .toEqual(["2026-11-07noturno","2026-11-08diurno","2026-11-08noturno"]);
// token.test.ts
expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
expect(gerarToken()).not.toBe(gerarToken());
expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.
- [ ] **Step 3: Implementar `regras.ts` e `token.ts`** (`node:crypto` `randomBytes`/`createHash`).
- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(dominio): regras de causa, transições de turno e token"`

---

### Task 4: Schema Supabase, RLS e clientes

**Pré-requisito do usuário (pausar e pedir):** criar o projeto Supabase "frentia" no dashboard, desativar nada de Auth (manter confirmação de e-mail), e colocar as quatro variáveis em `.env.local`. Em Auth → URL Configuration: Site URL = URL de preview/local, Redirect URLs incluindo `http://127.0.0.1:3000/**` e `https://*.vercel.app/**`. Aplicar a migration colando o SQL no SQL Editor (ou `npx supabase@latest db push` se o usuário preferir logar no CLI).

**Files:**
- Create: `supabase/migrations/20261108000000_frentia_schema.sql`, `lib/supabase/servidor.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `lib/db/resultado.ts`
- Test: `tests/integracao/ajuda.ts`, `tests/integracao/rls.test.ts`

**Interfaces:**
- Produces:
  - Tabelas e colunas exatamente como na seção 4 da spec, com `id uuid default gen_random_uuid()`, `created_at`/`updated_at timestamptz default now()` (trigger de `updated_at`), FKs `on delete cascade`. Checks: `periodo in ('diurno','noturno')`, `status in ('planejado','em_campo','enviado','fechado') default 'planejado'`, `qtd_planejada > 0`, `qtd_realizada >= 0`, `quantidade > 0`, `causa` nos 9 códigos de `Causa`, `clima.periodo in ('manha','tarde','noite')`, `condicao in ('bom','chuva_leve','chuva_forte')`. Uniques: `membros(empresa_id,user_id)`, `turnos(obra_id,data,periodo)`, `turnos(token_hash)`, `clima(turno_id,periodo)`. Colunas `hora_*` do tipo `time`.
  - Função `public.eh_membro(p_empresa uuid) returns boolean` (`security definer`, `stable`, `set search_path = public`).
  - RLS habilitado em todas; políticas para `authenticated`: `empresas`/`membros` só SELECT do próprio vínculo; `obras` ALL `using/with check eh_membro(empresa_id)`; `turnos` ALL via obra; `atividades`/`efetivo`/`clima` ALL via turno→obra. Nenhuma política para `anon`.
  - `criarClienteServidor(): Promise<SupabaseClient>` — `createServerClient` com `await cookies()` (getAll/setAll)
  - `criarClienteAdmin(): SupabaseClient` — `import "server-only"`, service role, `auth: { persistSession: false }`
  - `atualizarSessao(request: NextRequest): Promise<NextResponse>` — padrão `@supabase/ssr` com `supabase.auth.getUser()`; sem usuário em `/obras/**` → redirect `/login?proximo=<caminho>`
  - `proxy.ts`: `export async function proxy(request)` chamando `atualizarSessao`; `matcher` exclui `_next/static`, `_next/image`, arquivos de imagem e `/t/`
  - `type Resultado<T = undefined> = { ok: true; dados: T } | { ok: false; erro: string; campos?: Record<string, string> }`; helpers `ok<T>(dados: T)` e `falha(erro: string, campos?)`
  - `tests/integracao/ajuda.ts`: `const ligado = process.env.SUPABASE_TEST === "1"`; `criarUsuarioTeste(): Promise<{ userId, email, senha, empresaId, cliente }>` (admin cria usuário com `email_confirm: true`, empresa e membro; cliente logado com senha); `removerUsuarioTeste(userId)` (apaga empresa e usuário)

- [ ] **Step 1: Escrever `rls.test.ts` (com `describe.skipIf(!ligado)`)** — usuário A cria obra; usuário B lista obras → `[]`; B tenta `insert` em `turnos` com `obra_id` de A → erro; cliente sem login (`anon`) lista `obras` → `[]`; A insere atividade com `qtd_planejada: 0` → erro de check; dois turnos A mesma obra/data/período → erro com `code === "23505"`.
- [ ] **Step 2: Rodar e ver falhar** — `SUPABASE_TEST=1 npm test -- tests/integracao` → FAIL (tabelas inexistentes).
- [ ] **Step 3: Escrever a migration** e pedir ao usuário para aplicá-la; escrever os três clientes, `proxy.ts` e `resultado.ts`.
- [ ] **Step 4: Rodar e ver passar** — `SUPABASE_TEST=1 npm test` → PASS; `npm test` sem a variável → integração pulada, domínio PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): schema Frentia com RLS e clientes Supabase"`

---

### Task 5: UI base, landing e autenticação

**Files:**
- Create: `components/ui/Botao.tsx`, `Campo.tsx`, `Cartao.tsx`, `Selo.tsx`, `Aviso.tsx`; `app/(publico)/page.tsx` (substitui placeholder), `app/(publico)/termos/page.tsx`, `app/(publico)/privacidade/page.tsx`, `app/(publico)/login/page.tsx`, `app/(publico)/cadastro/page.tsx`, `app/(publico)/recuperar-senha/page.tsx`, `app/(publico)/redefinir-senha/page.tsx`, `app/(publico)/auth-acoes.ts`, `app/auth/confirmar/route.ts`
- Test: `tests/integracao/cadastro.test.ts`

**Interfaces:**
- Consumes: `criarClienteServidor`, `criarClienteAdmin`, `Resultado`.
- Produces:
  - `Botao` props: `variante?: "primario" | "secundario" | "perigo"`, `carregando?: boolean`, demais de `<button>`; altura mínima 48px (uso no celular)
  - `Campo` props: `rotulo`, `erro?`, demais de `<input>`; `Selo` props: `tom: "neutro"|"info"|"sucesso"|"alerta"|"perigo"`, `children`; `Aviso` props: `tom`, `children`
  - Paleta como tokens em `globals.css` (`@theme`): cor primária extraída da logo, neutros, sucesso/alerta/perigo
  - Server Actions em `auth-acoes.ts` (todas `(estado: Resultado | null, form: FormData) => Promise<Resultado>`): `cadastrar` (campos `nome`, `empresa`, `email`, `senha` ≥ 8) → `auth.signUp` com `emailRedirectTo = ${NEXT_PUBLIC_APP_URL}/auth/confirmar` e `options.data = { nome }` (exibido no layout logado), depois admin cria `empresas` + `membros(papel 'dono')`; sucesso mostra "Enviamos um link de confirmação para <email>"; `entrar` → `signInWithPassword`, sucesso `redirect(proximo ?? "/obras")`, erro `"E-mail ou senha incorretos"`; `recuperarSenha` → `resetPasswordForEmail` com redirect `/auth/confirmar?proximo=/redefinir-senha`, sempre responde "Se o e-mail existir, enviamos um link"; `redefinirSenha` → `updateUser({ password })`; `sair` → `signOut` e `redirect("/")`
  - `app/auth/confirmar/route.ts` GET: lê `token_hash`, `type`, `proximo`; `verifyOtp`; ok → redirect `proximo ?? "/obras"`; erro → `/login?erro=link-expirado`
  - Landing: título "Frentia", subtítulo "Planeje o turno, acompanhe a execução e gere o RDO direto do canteiro.", três blocos (Planeje o turno / Encarregado lança pelo celular / RDO em PDF), botões "Criar conta grátis" → `/cadastro` e "Entrar" → `/login`
  - Formulários usam `useActionState` e mostram `erro`/`campos` via `Campo.erro`

- [ ] **Step 1: Escrever `cadastro.test.ts` (skipIf)** — chamar a função interna `criarEmpresaDoDono(userId, nomeEmpresa)` (exportada de `lib/db/empresas.ts`, usada por `cadastrar`) e verificar que o usuário logado vê exatamente 1 linha em `membros` com `papel = 'dono'`.
- [ ] **Step 2: Rodar e ver falhar** — `SUPABASE_TEST=1 npm test -- cadastro` → FAIL.
- [ ] **Step 3: Implementar** `lib/db/empresas.ts` (`criarEmpresaDoDono(userId: string, nome: string): Promise<Resultado<{ empresaId: string }>>`), componentes, páginas e actions. Supabase "Email templates" de confirmação e recuperação devem apontar para `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email` / `type=recovery&proximo=/redefinir-senha` — instruir o usuário a ajustar no dashboard.
- [ ] **Step 4: Verificar** — `SUPABASE_TEST=1 npm test` PASS; `npm run dev`, cadastrar com e-mail real, confirmar pelo link, sair, entrar, recuperar senha. Acessar `/obras` deslogado → redireciona para `/login?proximo=/obras`.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: landing, UI base e autenticação"`; `npx vercel`.

---

### Task 6: Obras

**Files:**
- Create: `lib/db/obras.ts`, `app/(app)/layout.tsx`, `app/(app)/obras/page.tsx`, `app/(app)/obras/nova/page.tsx`, `app/(app)/obras/acoes.ts`
- Test: `tests/integracao/obras.test.ts`

**Interfaces:**
- Consumes: `criarClienteServidor`, `Resultado`, componentes UI.
- Produces:
  - `type Obra = { id: string; empresa_id: string; nome: string; cliente: string | null; endereco: string | null; created_at: string }`
  - `listarObras(cliente: SupabaseClient): Promise<Obra[]>` (ordem `nome`)
  - `obterObra(cliente: SupabaseClient, id: string): Promise<Obra | null>`
  - `criarObra(cliente: SupabaseClient, dados: { nome: string; cliente?: string; endereco?: string }): Promise<Resultado<Obra>>` — `nome` obrigatório (`"Informe o nome da obra"`); `empresa_id` = única empresa do usuário (MVP)
  - Todas as funções de `lib/db/*` recebem o cliente como primeiro argumento (permite testar com cliente de teste)
  - Action `novaObra` → `criarObra` e `redirect("/obras/<id>")`
  - Layout logado: logo Frentia → `/obras`, nome do usuário, botão "Sair"
  - `/obras` vazio: Cartao "Cadastre sua primeira obra" com botão; com obras: cartões com nome, cliente e link

- [ ] **Step 1: Escrever `obras.test.ts` (skipIf)** — `criarObra(cliente, { nome: "" })` → `{ ok:false, erro:"Informe o nome da obra" }`; criar "Edifício Aurora" → `listarObras` contém 1 obra com esse nome; `obterObra` de id inexistente → `null`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `obras.ts`, layout, páginas, action.
- [ ] **Step 4: Rodar e ver passar**; conferir no navegador criar e listar obra.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: cadastro e lista de obras"`

---

### Task 7: Planejar turno

**Files:**
- Create: `lib/db/turnos.ts`, `lib/db/atividades.ts`, `app/(app)/obras/[obraId]/page.tsx`, `app/(app)/obras/[obraId]/turnos/novo/page.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/acoes.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/ListaAtividades.tsx`
- Test: `tests/integracao/turnos.test.ts`

**Interfaces:**
- Consumes: `compararTurnos`, `saldoPendente`, `statusAtividade`, `parseNumero`, `hojeSaoPaulo`, `ROTULO_STATUS_TURNO`.
- Produces:
  - `type Turno = { id; obra_id; data: string; periodo: Periodo; hora_inicio_prevista: string|null; hora_fim_prevista: string|null; hora_inicio_real: string|null; hora_fim_real: string|null; status: StatusTurno; token_hash: string|null; enviado_em: string|null; fechado_em: string|null }`
  - `type Atividade = AtividadeExec & { turno_id: string; ordem: number; local: string|null; unidade: string; origem_id: string|null }`
  - `type Efetivo = { id; turno_id; funcao: string; quantidade: number }`; `type Clima = { turno_id; periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean }`
  - `type TurnoCompleto = Turno & { obra: Obra; atividades: Atividade[]; efetivo: Efetivo[]; clima: Clima[] }`
  - `listarTurnos(c, obraId): Promise<Turno[]>` — ordem decrescente por `compararTurnos`
  - `obterTurnoCompleto(c, turnoId): Promise<TurnoCompleto | null>` — atividades por `ordem`
  - `criarTurno(c, { obra_id, data, periodo, hora_inicio_prevista?, hora_fim_prevista? }): Promise<Resultado<Turno>>` — erro `23505` → `"Já existe um turno <diurno|noturno> nesse dia"`
  - `adicionarAtividade(c, turnoId, { descricao, local?, unidade, qtd_planejada }): Promise<Resultado<Atividade>>` — `ordem` = máx + 1; validações `"Informe a descrição"`, `"Informe a unidade"`, `"Quantidade deve ser maior que zero"`
  - `editarAtividade(c, atividadeId, campos parciais)`, `removerAtividade(c, atividadeId)`, `moverAtividade(c, atividadeId, direcao: "cima" | "baixo")` — todos `Promise<Resultado>`; planejador pode editar qualquer campo, inclusive execução, enquanto status ≠ `fechado` (`"Turno fechado: reabra para editar"`)
  - `trazerPendentes(c, turnoId): Promise<Resultado<{ adicionadas: number }>>` — turno anterior = maior turno da mesma obra com `compararTurnos(t, atual) < 0`; copia atividades `parcial`/`nao_iniciada` com `qtd_planejada = saldoPendente(...)`, `origem_id` = id original, `qtd_realizada/causa/observacao = null`; ignora as cujo id já é `origem_id` de alguma atividade do turno atual; sem turno anterior → `{ ok:false, erro:"Não há turno anterior nesta obra" }`
  - Página da obra: lista de turnos (data em `dd/mm/aaaa`, período, `Selo` de status, % de cumprimento quando ≥ em_campo) e botão "Novo turno"
  - Novo turno: data padrão `hojeSaoPaulo()`, período padrão `diurno`, horário previsto padrão 07:00–17:00 (diurno) / 19:00–05:00 (noturno)
  - Tela do turno em `planejado`: formulário de atividade (descrição, local, quantidade com `inputMode="decimal"` lida por `parseNumero`, unidade), lista com editar/remover/subir/descer, botão "Trazer pendentes do turno anterior"

- [ ] **Step 1: Escrever `turnos.test.ts` (skipIf)**
  - criar turno 2026-11-08 diurno duas vezes → segunda `{ ok:false, erro:"Já existe um turno diurno nesse dia" }`
  - `adicionarAtividade` com `qtd_planejada: 0` → `erro:"Quantidade deve ser maior que zero"`
  - turno A (07/11 noturno) com atividades X (10, realizado 4), Y (5, realizado 5), Z (3, null); turno B (08/11 diurno): `trazerPendentes(B)` → `adicionadas: 2`, atividades de B = X com `qtd_planejada 6` e Z com `3`, ambas com `origem_id`
  - `trazerPendentes(B)` de novo → `adicionadas: 0` e B continua com 2 atividades
  - `trazerPendentes` no primeiro turno da obra → `erro:"Não há turno anterior nesta obra"`
  - `moverAtividade(Z, "cima")` → ordem de B vira Z, X
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `turnos.ts`, `atividades.ts`, páginas, actions e `ListaAtividades` (client component com `useActionState`).
- [ ] **Step 4: Rodar e ver passar**; conferir no navegador criar turno, adicionar "2,5" m³ e reordenar.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: planejamento de turno com pendentes do turno anterior"`

---

### Task 8: Liberar para campo (link e WhatsApp)

**Files:**
- Modify: `lib/db/turnos.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `.../acoes.ts`
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/PainelLink.tsx`
- Test: `tests/integracao/link.test.ts`

**Interfaces:**
- Consumes: `transicaoTurno`, `gerarToken`, `hashToken`, `obterTurnoCompleto`.
- Produces:
  - `aplicarAcao(c, turnoId, acao: AcaoTurno): Promise<Resultado<{ status: StatusTurno; token?: string }>>` — usa `transicaoTurno` com as atividades do turno; `liberar` gera token, grava `token_hash` e devolve o `token` em claro **apenas nessa resposta**; `enviar` grava `enviado_em`; `fechar` grava `fechado_em`; `reabrir` limpa `fechado_em`
  - `gerarNovoLink(c, turnoId): Promise<Resultado<{ token: string }>>` — permitido em `em_campo`/`enviado`; substitui `token_hash`
  - `urlCampo(token: string): string` = `${NEXT_PUBLIC_APP_URL}/t/${token}`
  - `PainelLink`: após liberar/gerar, mostra a URL, "Copiar link" (`navigator.clipboard`) e "Enviar pelo WhatsApp" (`https://wa.me/?text=` + `encodeURIComponent("Turno <data> <período> — <obra>: <url>")`). Como o token não fica salvo em claro, ao recarregar a página o painel mostra "Link enviado. Perdeu o link? Gere um novo (o anterior deixa de funcionar)." com botão "Gerar novo link"

- [ ] **Step 1: Escrever `link.test.ts` (skipIf)** — turno sem atividades: `aplicarAcao(liberar)` → `erro:"Adicione ao menos uma atividade"`; com atividade: retorna `status:"em_campo"` e token de 43 caracteres, e o `token_hash` no banco = `hashToken(token)`; `gerarNovoLink` → novo hash ≠ anterior.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar**; conferir no celular que o botão do WhatsApp abre com a mensagem.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: liberar turno para campo com link e WhatsApp"`

---

### Task 9: Página do encarregado (`/t/[token]`)

**Files:**
- Create: `lib/db/campo.ts`, `app/t/[token]/page.tsx`, `app/t/[token]/acoes.ts`, `app/t/[token]/BlocoAtividades.tsx`, `BlocoEfetivo.tsx`, `BlocoClima.tsx`, `BlocoHorario.tsx`, `app/t/[token]/IndicadorSalvo.tsx`, `app/t/[token]/useAutoSalvar.ts`
- Test: `tests/integracao/campo.test.ts`

**Interfaces:**
- Consumes: `criarClienteAdmin`, `hashToken`, `errosDeCausa`, `transicaoTurno`, `statusAtividade`, `parseNumero`, `CAUSAS`, `CONDICOES`, `FUNCOES_SUGERIDAS`, `TurnoCompleto`.
- Produces (`lib/db/campo.ts`, sempre com o cliente admin e sempre filtrando pelo turno do token):
  - `obterTurnoPorToken(token: string): Promise<TurnoCompleto | null>`
  - `salvarExecucao(token, atividadeId, { qtd_realizada: number|null; causa: Causa|null; observacao: string|null }): Promise<Resultado>`
  - `salvarEfetivo(token, linhas: { funcao: string; quantidade: number }[]): Promise<Resultado>` — substitui todas as linhas do turno
  - `salvarClima(token, { periodo, condicao, impediu }): Promise<Resultado>` — upsert por `(turno_id, periodo)`
  - `salvarHorarioReal(token, { hora_inicio_real: string|null; hora_fim_real: string|null }): Promise<Resultado>`
  - `enviarTurnoCampo(token): Promise<Resultado<{ status: StatusTurno }>>` — via `transicaoTurno(...,"enviar",...)`; se status já é `enviado`, retorna ok sem mudar
  - Erros exatos: token sem turno → `"Link inválido ou substituído. Peça um novo link ao planejador."`; status `planejado`/`fechado` → `"Este turno não está aberto para lançamentos."`; atividade fora do turno → `"Esta atividade foi removida pelo planejador. Recarregue a página."`
  - `BlocoAtividades`, `BlocoEfetivo`, `BlocoClima`, `BlocoHorario` recebem os dados e as funções de salvar por props (`salvar: (dados) => Promise<Resultado>`), sem importar actions — a Task 10 os reaproveita com as actions do planejador
  - Página: token inválido renderiza tela amigável com a primeira mensagem (sem 404/500); `fechado` renderiza tudo somente leitura com `Aviso` "Turno fechado pelo planejador"; cabeçalho com obra, data e período
  - `useAutoSalvar(salvar: () => Promise<Resultado>, deps, atrasoMs = 800): { estado: "ocioso"|"salvando"|"salvo"|"erro"; mensagem?: string }` — debounce; em falha de rede repete a cada 5 s mantendo o valor na tela; em erro de negócio mostra a mensagem e não repete
  - `IndicadorSalvo` textos: "Salvando…", "Salvo ✓", "Sem conexão — tentando de novo"
  - Bloco de atividades: campo quantidade (`inputMode="decimal"`), botão "100%" (preenche `qtd_planejada`), `Selo` com status calculado; seletor de causa + observação aparecem quando status ≠ concluída, com o erro de `errosDeCausa` exibido
  - Botão "Enviar turno": desabilitado com lista dos pendentes enquanto `errosDeCausa` não estiver vazio; após envio mostra "Turno enviado ✓ — você ainda pode corrigir até o planejador fechar"

- [ ] **Step 1: Escrever `campo.test.ts` (skipIf)** — com turno liberado (token T):
  - `obterTurnoPorToken("token-inexistente")` → `null`
  - `salvarExecucao(T, atividadeDoTurno, { qtd_realizada: 3, causa:"material", observacao:null })` → ok, e o banco reflete
  - `salvarExecucao(T, atividadeDeOutroTurno, ...)` → `erro:"Esta atividade foi removida pelo planejador. Recarregue a página."`
  - após `gerarNovoLink`, `salvarExecucao(T, ...)` → `erro:"Link inválido ou substituído. Peça um novo link ao planejador."`
  - `enviarTurnoCampo` com atividade parcial sem causa → `erro:"Há atividades sem causa informada"`
  - após `aplicarAcao(fechar)`, `salvarClima(T2, ...)` → `erro:"Este turno não está aberto para lançamentos."`
  - `salvarEfetivo(T2, [{funcao:"Pedreiro",quantidade:4}])` duas vezes → turno tem 1 linha de efetivo
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `campo.ts`, actions (repassam o token da rota), blocos e hook.
- [ ] **Step 4: Rodar e ver passar**; conferir no celular real (preview Vercel): lançar, ativar modo avião, alterar, ver "Sem conexão — tentando de novo", voltar a rede e ver "Salvo ✓".
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: página do encarregado com salvamento automático"`

---

### Task 10: Resumo do turno, correções e fechamento

**Files:**
- Create: `lib/dominio/resumo.ts`, `lib/dominio/formato.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/Resumo.tsx`, `.../EdicaoExecucao.tsx`
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `.../acoes.ts`, `lib/db/atividades.ts`
- Test: `tests/dominio/resumo.test.ts`

**Interfaces:**
- Consumes: `percentualCumprimento`, `hhTurno`, `statusAtividade`, `errosDeCausa`, `aplicarAcao`, `editarAtividade`, `TurnoCompleto`.
- Produces:
  - `resumirTurno(t: TurnoCompleto): ResumoTurno` em `lib/dominio/resumo.ts` (pura), com `type ResumoTurno = { cumprimento: number | null; hh: number | null; efetivoTotal: number; atividades: (Atividade & { status: StatusAtividade })[]; restricoesPorCausa: { causa: Causa; rotulo: string; atividades: string[] }[]; climaImpediu: boolean }` — `restricoesPorCausa` ordenado por quantidade decrescente
  - `formatarPercentual(x: number | null): string` → `"50%"` / `"—"` e `formatarData("2026-11-08"): "08/11/2026"` em `lib/dominio/formato.ts`
  - Tela do turno com status ≥ `em_campo`: `Resumo` (cartões % de cumprimento, HH, efetivo total; tabela planejado × realizado; restrições por causa; clima) + `EdicaoExecucao` (planejador corrige realizado/causa/efetivo/clima/horário com as mesmas regras; reaproveita os blocos de `app/t/[token]/` passando as actions do planejador por props)
  - Botões: "Baixar RDO (PDF)" → `/api/rdo/<turnoId>`; "Fechar turno" (confirmação "Depois de fechado, o RDO fica definitivo e o link para de aceitar lançamentos."); em `fechado`: "Reabrir turno"

- [ ] **Step 1: Escrever `resumo.test.ts`** — turno com atividades (10/10), (10/4 causa material), (5/null causa material), (2/0 causa clima), efetivo [4, 2], previsto 07:00–17:00, clima tarde chuva_forte impediu: espera `cumprimento 0.25`, `hh 60`, `efetivoTotal 6`, `restricoesPorCausa[0].causa === "material"` com 2 atividades, `climaImpediu true`; `formatarPercentual(0.25) === "25%"`, `formatarPercentual(null) === "—"`, `formatarData("2026-11-08") === "08/11/2026"`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `resumo.ts`, `formato.ts`, componentes e actions de fechar/reabrir/corrigir.
- [ ] **Step 4: Rodar e ver passar**; no navegador: fechar turno com causa faltando → mensagem "Há atividades sem causa informada"; fechar → link mostra somente leitura; reabrir → link volta a aceitar.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: resumo do turno, correções e fechamento"`

---

### Task 11: RDO em PDF

**Files:**
- Create: `lib/rdo/documento.tsx`, `lib/rdo/nome-arquivo.ts`, `app/api/rdo/[turnoId]/route.ts`, `README.md`
- Test: `tests/dominio/rdo.test.ts`

**Interfaces:**
- Consumes: `obterTurnoCompleto`, `resumirTurno`, `formatarData`, `formatarPercentual`, `CAUSAS`, `CONDICOES`, `ROTULO_STATUS_TURNO`, `criarClienteServidor`.
- Produces:
  - `nomeArquivoRdo(obra: string, data: string, periodo: Periodo): string` — obra sem acentos, minúsculas, espaços → `-`: `RDO-edificio-aurora-2026-11-08-diurno.pdf`
  - `DocumentoRdo({ turno: TurnoCompleto, resumo: ResumoTurno, geradoEm: Date })` — blocos 1–7 da seção 7 da spec, A4, logo de `public/frentia-logo.png`, cabeçalho fixo e numeração "Página X de Y" (props `fixed`/`render` do react-pdf), marca d'água diagonal "PRELIMINAR" quando `status !== "fechado"`; datas/hora do rodapé em `America/Sao_Paulo`
  - `GET /api/rdo/[turnoId]` — `const { turnoId } = await params`; usuário sem sessão → 401; turno não visível pelo RLS → 404; senão `renderToBuffer(<DocumentoRdo/>)` com `Content-Type: application/pdf` e `Content-Disposition: attachment; filename="<nomeArquivoRdo>"`
  - `README.md`: o que é o Frentia, como rodar (`.env.local`, `npm run dev`), como testar (`npm test`, `SUPABASE_TEST=1`, `npm run test:e2e`)

- [ ] **Step 1: Escrever `rdo.test.ts`** — `nomeArquivoRdo("Edifício Aurora", "2026-11-08", "diurno") === "RDO-edificio-aurora-2026-11-08-diurno.pdf"`; `renderToBuffer(<DocumentoRdo .../>)` com um `TurnoCompleto` de exemplo (40 atividades, para forçar várias páginas) retorna buffer que começa com `%PDF`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Se `npm run build` reclamar do react-pdf, confirmar `serverExternalPackages` da Task 1 e `export const runtime = "nodejs"` na rota.
- [ ] **Step 4: Verificar** — `npm test` PASS; baixar o PDF de um turno em campo (marca "PRELIMINAR") e de um fechado (sem marca); abrir no celular e conferir acentos e paginação.
- [ ] **Step 5: Commit e preview** — `git commit -m "feat: RDO em PDF"`

---

### Task 12: Teste ponta a ponta e preparação para lançamento

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/ciclo-turno.spec.ts`, `tests/e2e/preparar.ts`

**Interfaces:**
- Consumes: `criarUsuarioTeste`/`removerUsuarioTeste` (Task 4); rotas de todas as tasks.
- Produces: `npm run test:e2e` verde.

- [ ] **Step 1: Escrever `ciclo-turno.spec.ts`** — `playwright.config.ts` sobe `npm run dev` em `http://127.0.0.1:3000`, projetos `Desktop Chrome` e `Pixel 7` (página de campo). Fluxo: usuário criado por `preparar.ts` (já confirmado) faz login → cria obra "Obra E2E" → novo turno → adiciona "Concretagem laje" 10 m³ e "Alvenaria" 20 m² → liberar → captura a URL do painel → em contexto mobile sem login abre a URL, lança 10 na primeira, 8 na segunda com causa "Material", efetivo Pedreiro 4, clima manhã Bom, horário 07:00–16:00, espera "Salvo ✓", clica "Enviar turno" → planejador recarrega e vê "50%" e "36" HH → "Fechar turno" → baixa o RDO e confere `download.suggestedFilename()` = `RDO-obra-e2e-<data>-diurno.pdf` → a URL de campo mostra "Turno fechado pelo planejador". `afterAll` remove o usuário.
- [ ] **Step 2: Rodar** — `SUPABASE_TEST=1 npm run test:e2e` → corrigir até PASS.
- [ ] **Step 3: Verificação completa** — `npm run lint && npm test && SUPABASE_TEST=1 npm test && npm run build` sem erros; `grep -rnE "localStorage|sessionStorage" app components lib` sem resultados.
- [ ] **Step 4: Commit e preview** — `git commit -m "test: ciclo completo do turno ponta a ponta"`; `npx vercel`; enviar a URL de preview ao usuário para teste de aceitação (critério da seção 12 da spec).
- [ ] **Step 5: Lançamento (somente com aprovação explícita do usuário)** — configurar as variáveis do projeto Supabase Frentia em Production no Vercel, ajustar Site URL do Supabase para `https://www.frentia.com.br`, merge `frentia` → `main`, `git push`, `npx vercel --prod`.
