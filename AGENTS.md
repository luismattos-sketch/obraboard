<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:obraapp-deploy-rules -->
# ObraApp deployment rules

- Sempre atualizar o Vercel depois de concluir alterações no projeto.
- Nunca incluir `localStorage` ou `sessionStorage` no código da aplicação; use Supabase/remoto como fonte oficial.
- Funcionalidade que muda o que o usuário vê ou faz atualiza no mesmo PR o manual (`lib/ajuda/`), as capturas (`SUPABASE_TEST=1 npm run manual:capturas`, ou `MANUAL_CAPITULO=<capitulo>` para um só) e, se mudar a sequência, o fluxograma (`lib/ajuda/fluxograma.ts`); e ganha uma linha em Novidades (`lib/ajuda/novidades.ts`).
<!-- END:obraapp-deploy-rules -->
