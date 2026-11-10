# Frentia

Aplicativo web de planejamento de curto prazo para obras (Last Planner System). O planejador monta o
turno, libera um link para o encarregado apontar o que foi feito em campo, confere o resumo e envia
ao cliente o RDO (Relatório Diário de Obra) em PDF.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth + Postgres com RLS) e
`@react-pdf/renderer` para o RDO.

## Como rodar

1. `npm install`
2. Crie o arquivo `.env.local` na raiz com as variáveis do projeto Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # somente servidor, nunca com prefixo NEXT_PUBLIC_
   ```

3. Aplique as migrations de `supabase/` no seu projeto.
4. `npm run dev` e abra http://127.0.0.1:3000

## Como testar

- `npm test` — testes unitários (regras de domínio, RDO em PDF).
- `SUPABASE_TEST=1 npm test` — inclui os testes de integração contra o Supabase (exige `.env.local`).
- `npm run test:e2e` — testes de ponta a ponta com Playwright.
- `npm run lint` e `npx tsc --noEmit` — lint e checagem de tipos.

## RDO em PDF

`GET /api/rdo/<turnoId>` (somente usuário autenticado com acesso à obra) devolve o PDF.
Turnos que não estão fechados saem com a marca d'água "PRELIMINAR".
