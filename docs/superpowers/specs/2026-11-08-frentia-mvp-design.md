# Frentia — MVP (ciclo do turno) — Design

Data: 2026-11-08
Status: aguardando revisão

## 1. Contexto e objetivo

O ObrasApp será reconstruído do zero com o nome **Frentia**, mantendo domínio e logo. O app apoia
obras que usam o **Last Planner System (LPS)**. O desenvolvimento é incremental: este documento
cobre apenas o MVP de lançamento.

**Objetivo do MVP:** um planejador consegue planejar um turno, o encarregado lança a execução pelo
celular e o planejador obtém o **resumo do turno** e o **RDO em PDF**.

### Decisões tomadas

| Tema | Decisão |
|---|---|
| Escopo | Só o ciclo do turno (sem plano semanal/PPC semanal e sem lookahead) |
| Usuários | Planejador com login; encarregado por link sem login |
| Dados | Banco novo (projeto Supabase novo); nada é migrado do ObrasApp |
| Cobrança | Lançamento gratuito; sem Mercado Pago no MVP |
| Arquitetura | Lógica no servidor Next.js (Server Components + Server Actions); navegador não acessa tabelas |
| PDF | Gerado no servidor com `@react-pdf/renderer` |
| Deploy | Desenvolvimento na branch `frentia` com previews Vercel; domínio troca ao concluir o MVP |

### Fora do MVP (incrementos futuros)

Plano semanal e PPC semanal, lookahead e restrições, fotos, equipamentos, login/convite de equipe,
cobrança, blog, páginas de SEO, chat de suporte, catálogo de HH, medição, painel de indicadores.

## 2. Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4, Supabase (Auth + Postgres),
Vercel. Antes de escrever código, consultar `node_modules/next/dist/docs/` (versão com mudanças
incompatíveis em relação a versões anteriores). Proibido usar `localStorage`/`sessionStorage`
(regra do projeto): todo estado persistente fica no Supabase.

## 3. Fluxo e telas

### 3.1 Site público
- `/` — landing do Frentia: o que é, para quem, botão "Criar conta grátis". Usa a logo atual.
- `/login`, `/cadastro`, `/recuperar-senha` — e-mail e senha via Supabase Auth.
- `/termos`, `/privacidade` — páginas de texto simples.

### 3.2 Planejador (logado)
1. **Minhas obras** (`/obras`) — lista de obras da empresa; "Nova obra" (nome, cliente, endereço).
2. **Obra** (`/obras/[obraId]`) — turnos ordenados por data (mais recente primeiro) com status;
   botão "Novo turno".
3. **Planejar turno** (`/obras/[obraId]/turnos/[turnoId]`) — data, período (diurno/noturno),
   horário previsto de início e fim; lista de atividades (descrição, local, quantidade planejada,
   unidade), com reordenação, edição e remoção. Atalho **"Trazer pendentes do turno anterior"**:
   copia as atividades com status Parcial ou Não iniciada do turno anterior da mesma obra, com
   quantidade planejada = saldo (planejado − realizado) e `origem_id` apontando para a original.
4. **Liberar para campo** — gera o link `/t/<token>` e mostra "Copiar link" e "Enviar pelo
   WhatsApp" (`https://wa.me/?text=...`). Status passa a `Em campo`. "Gerar novo link" invalida o
   anterior.
5. **Resumo do turno** (na mesma tela, quando status ≥ `Em campo`) — planejado × realizado por
   atividade, % de cumprimento, restrições agrupadas por causa, efetivo, HH, clima. Ações:
   corrigir lançamentos, **"Baixar RDO (PDF)"**, **"Fechar turno"**.

### 3.3 Encarregado (`/t/[token]`, celular, sem login)
Página única vertical, botões grandes, quatro blocos:
1. **Atividades** — para cada uma: quantidade realizada (campo numérico + atalho "100%"). Se o
   status resultante for Parcial ou Não iniciada, exige **causa** (lista fixa) e permite
   observação.
2. **Efetivo** — linhas função + quantidade; sugestões de funções comuns (pedreiro, servente,
   carpinteiro, armador, eletricista, encanador, pintor, encarregado, operador).
3. **Clima** — manhã, tarde e noite: condição (bom / chuva leve / chuva forte) e "impediu o
   trabalho?".
4. **Horário real** de início e fim + botão **"Enviar turno"** (status → `Enviado`).

Cada campo salva automaticamente no servidor ao ser alterado (com debounce). Cada bloco mostra
"Salvando…", "Salvo ✓" ou "Sem conexão — tentando de novo" (nova tentativa automática).
Após `Enviado`, o encarregado ainda pode editar até o turno ser `Fechado`. Após `Fechado`, a página
fica somente leitura.

### 3.4 Ciclo de vida do turno

`Planejado` → `Em campo` → `Enviado` → `Fechado`

- `Planejado`: só o planejador edita; link não existe.
- `Em campo` / `Enviado`: encarregado edita os dados de execução; planejador pode corrigir tudo.
- `Fechado`: ninguém edita; RDO definitivo. O planejador pode **reabrir** (volta a `Enviado`).

## 4. Modelo de dados

Todas as tabelas com `id uuid`, `created_at`, `updated_at`; RLS habilitado em todas.

| Tabela | Campos |
|---|---|
| `empresas` | nome |
| `membros` | empresa_id, user_id, papel (`dono` no MVP) — único (empresa_id, user_id) |
| `obras` | empresa_id, nome, cliente, endereco |
| `turnos` | obra_id, data, periodo (`diurno`/`noturno`), hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, status, token_hash (nulo até liberar), enviado_em, fechado_em — único (obra_id, data, periodo) |
| `atividades` | turno_id, ordem, descricao, local, unidade, qtd_planejada (> 0), qtd_realizada (≥ 0, nulo = não informado), causa, observacao, origem_id (FK atividades, nulo) |
| `efetivo` | turno_id, funcao, quantidade (> 0) |
| `clima` | turno_id, periodo (`manha`/`tarde`/`noite`), condicao (`bom`/`chuva_leve`/`chuva_forte`), impediu (bool) — único (turno_id, periodo) |

No cadastro, o servidor cria a `empresa` (nome informado pelo usuário) e o `membro` dono.

## 5. Regras de domínio (`lib/dominio/`, funções puras)

- **Status da atividade:** `Concluída` se realizado ≥ planejado; `Parcial` se 0 < realizado <
  planejado; `Não iniciada` se realizado é 0 ou nulo.
- **Causa obrigatória** quando o status é Parcial ou Não iniciada e o turno vai para `Enviado` ou
  `Fechado`. Causas: Material, Mão de obra, Equipamento, Projeto/Informação, Clima, Atividade
  predecessora, Liberação de área/Interferência, Segurança, Outro (`Outro` exige observação).
- **% de cumprimento do turno:** atividades Concluídas ÷ total de atividades (0 atividades → sem
  valor, exibe "—").
- **HH do turno:** Σ quantidade do efetivo × horas do turno; horas = horário real se ambos
  informados, senão o previsto. Turno noturno que cruza a meia-noite: fim < início soma 24 h.
- **Transições de status:** função única que valida a transição pedida a partir do status atual
  e dos dados (ex.: `Fechar` exige causas preenchidas e horário real ou previsto).

## 6. Arquitetura e segurança

- **Planejador:** Server Components e Server Actions usam o cliente Supabase com a sessão do
  usuário (cookies). O RLS restringe tudo às obras das empresas onde o usuário é membro.
- **Encarregado:** o token tem 32 bytes aleatórios (base64url); o banco guarda apenas o SHA-256.
  As Server Actions de `/t/[token]` calculam o hash, localizam o turno e usam o cliente com
  **service role** restrito, no código, às operações de execução daquele turno: qtd_realizada,
  causa, observacao, efetivo, clima, horário real e "Enviar turno". Nada de planejamento.
  Turno `Fechado` → somente leitura; token inexistente → página "Link inválido ou substituído —
  peça um novo link ao planejador".
- A chave de service role só existe no servidor (nunca em variável `NEXT_PUBLIC_`).

## 7. RDO em PDF

Rota `app/api/rdo/[turnoId]/route.ts` (somente planejador autenticado com acesso à obra), gerado
com `@react-pdf/renderer` a partir dos dados atuais. Conteúdo:

1. Cabeçalho: logo Frentia, obra, cliente, endereço, data, período, horário previsto e real.
2. Atividades: descrição, local, planejado, realizado, unidade, status, causa/observação.
3. Resumo: % de cumprimento e HH.
4. Restrições agrupadas por causa.
5. Efetivo por função e total.
6. Clima por período.
7. Rodapé: gerado em (data/hora), status do turno.

Turno não `Fechado` → marca d'água "PRELIMINAR". Nome do arquivo:
`RDO-<obra>-<AAAA-MM-DD>-<periodo>.pdf`.

## 8. Estrutura de código

```
app/(publico)/            landing, login, cadastro, recuperar-senha, termos, privacidade
app/(app)/obras/...       telas do planejador
app/t/[token]/            página do encarregado
app/api/rdo/[turnoId]/    geração do PDF
lib/dominio/              regras puras (status, cumprimento, HH, causas, transições)
lib/db/                   acesso ao Supabase por assunto (obras, turnos, atividades, campo)
lib/supabase/             criação de clientes (sessão, service role)
components/ui/            componentes visuais Frentia
supabase/migrations/      schema novo
```

Meta: nenhum arquivo acima de ~300 linhas.

## 9. Tratamento de erros

- Toda Server Action valida a entrada no servidor e devolve erros por campo, exibidos no
  formulário em português claro.
- Falhas de rede no campo: indicador por bloco e nova tentativa automática; o dado digitado
  permanece na tela até ser salvo.
- Página de erro amigável para link inválido e para obra/turno inexistente ou sem acesso.

## 10. Testes

- **Vitest** para `lib/dominio/`, escrito antes da implementação (TDD).
- **Playwright**: um teste ponta a ponta do ciclo completo (cadastro → nova obra → planejar →
  liberar → lançar pelo link → enviar → fechar → baixar PDF) contra o projeto Supabase de
  desenvolvimento do Frentia (não há Docker para Supabase local), criando e removendo os próprios
  dados de teste.
- `npm run build` e `npm run lint` sem erros antes de cada deploy de preview.

## 11. Transição do código antigo e deploy

1. Commitar todo o estado atual (inclusive arquivos não rastreados) na branch
   `legado-obrasapp` e criar a tag `obrasapp-final`.
2. Criar a branch `frentia` a partir de `main` e remover dela todo o código, mantendo apenas:
   logo e ícones (`app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`,
   `public/frentia-logo.png`), `.env.example` (atualizado), `.vercel/`, `.gitignore`,
   `AGENTS.md`/`CLAUDE.md` e esta pasta `docs/superpowers/`. Logs e scripts locais
   (`*.log`, `*.bat`, `*.cmd`, `*.pid`) são removidos.
3. Criar um projeto Supabase novo para o Frentia; o antigo fica intacto.
4. Cada etapa concluída gera deploy de preview no Vercel a partir da branch `frentia`.
5. Ao concluir o MVP: merge em `main` e o domínio de produção passa a servir o Frentia.

## 12. Critério de sucesso

Um usuário novo, sem ajuda, consegue: criar conta, cadastrar uma obra, planejar um turno com
atividades, enviar o link ao encarregado, o encarregado lançar tudo pelo celular, e o planejador
fechar o turno e baixar o RDO em PDF com todos os blocos da seção 7 preenchidos.
