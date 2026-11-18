# Manual do usuário dentro do app (backlog item 20)

Data: 2026-11-18 · Origem: Luis (pedido em 2026-11-17)

## Objetivo

Um planejador que nunca viu o Frentia precisa conseguir aprender a usar o app **sozinho, do zero**, dentro do
próprio app, sem depender de uma apresentação. O responsável de campo (sem login, só com o link) precisa de um
"Como usar" curto na tela dele.

O manual deve acompanhar o app: cada funcionalidade nova atualiza o manual no mesmo PR, e as capturas de tela
não podem envelhecer.

## Metas, não-metas e anti-metas

**Metas**
- Aba **"Ajuda"** no menu lateral com o tutorial completo do planejador, organizado por tarefa, em passos
  numerados com captura da tela real.
- **Fluxograma** do ciclo de uso no topo da Ajuda, só para ilustrar e ajudar a entender a sequência
  (formato "em linha, por fase", escolhido pelo Luis).
- **"Como usar"** curto no link de campo (`/t/[token]`).
- Seção **"Novidades"** no topo da Ajuda.
- Botão **"?"** nas telas principais, levando ao capítulo/passo certo.
- **Busca** simples no manual.
- Capturas geradas por um roteiro automático do Playwright, que roda de novo quando as telas mudam.

**Não-metas (agora)**
- Explicação do método LPS (Luis: "esqueça, por hora"). O fluxograma mostra só o que o app faz hoje.
- Tour guiado com balões sobre a tela real (pode virar item futuro do backlog).
- Marcar "novidade não lida" por usuário (exigiria guardar estado no Supabase).
- Manual público fora do login, vídeos, tradução.

**Anti-metas** (falha mesmo funcionando)
- Capturas que mostram telas antigas ou textos que descrevem botões que não existem mais.
- Manual que promete algo que o app não faz.
- Usar `localStorage`/`sessionStorage` para qualquer coisa (regra do projeto, AGENTS.md).
- Usar "encarregado" para quem assume atividades: o termo é **"Responsável"**.

## Abordagens consideradas

1. **Manual em páginas dentro do app, capturas tiradas pelo robô (Playwright)** — escolhida pelo Luis.
   Ensina do zero, não envelhece (rodar o roteiro atualiza as fotos), cabe no "atualizar no mesmo PR".
   Custo: roteiro de captura e obra de exemplo realista.
2. **Tour guiado sobre a tela real** — mais didático no primeiro uso, mas quebra a cada mudança de tela,
   precisaria guardar progresso no Supabase e não serve de consulta depois.
3. **Manual só em texto** — barato, mas "clique em Liberar ao campo" sem ver a tela atrapalha quem começa do zero.

## Decisões

### 1. Onde fica

- **`/ajuda`** (grupo `(app)`, exige login): página inicial do manual, nesta ordem:
  1. Título "Ajuda" + campo de busca.
  2. **Novidades**: as 3 mais recentes (data, uma frase, link para o capítulo); "Ver todas" expande a lista.
  3. **Fluxograma** "Como o Frentia funciona".
  4. **Índice** dos capítulos (cartões com título e uma linha de resumo).
- **`/ajuda/[capitulo]`**: um capítulo, com passos numerados; cada passo tem `id` para âncora
  (`/ajuda/check-in#liberar`). Ao fim do capítulo, "Próximo: <capítulo seguinte>" e "Voltar à Ajuda".
- **Menu lateral** ([MenuLateral.tsx](../../../components/navegacao/MenuLateral.tsx)): item global "Ajuda"
  (fora das etapas da obra, junto de "RDOs de todas as obras"), com ícone de interrogação, ativo em `/ajuda*`,
  funciona também com o menu recolhido (título no `title`).

### 2. Fluxograma (formato A, aprovado no rascunho)

Componente React só com HTML/CSS (sem biblioteca de diagrama), 4 fases empilhadas, cada fase com as caixas
em linha que quebram para baixo no celular:

1. **Uma vez por obra:** Criar a obra → Cadastrar responsáveis → Gerar link do quadro (TV).
2. **Toda semana:** Programar a semana (meta, dias, equipe, responsável) → "Programar semana" (sai do rascunho).
3. **Todo turno:**
   Novo turno (traz as atividades do dia) → Check-in (quem faz o quê, efetivo) → Liberar ao campo (envia o link) → *TV: check-in*;
   ↓ "Quem é você?" → Lançar execução e efetivo → Parada · serviço extra · adiantar (quando acontece) → Avisar o planejador / Enviar;
   ↓ Check-out (confere, informa causas) → Fechar o turno → RDO gerado → *TV: check-out*.
   Nota pequena: "Dá para criar o turno sem programar a semana; as atividades entram à mão."
4. **Fim da semana:** Encerrar a semana (causas do que não cumpriu) → Análise (PPC) ↺ volta para a semana seguinte.

Cores por quem faz: planejador = azul primário da marca; responsável de campo = laranja da marca; quadro na TV =
caixa clara com borda tracejada. Legenda acima. Usar os tokens de cor do projeto (ver manual da marca em
`docs/marca/`), não cores soltas. **Cada caixa é um link** para o capítulo/passo que a explica. Texto alternativo:
a lista das fases em texto para leitor de tela.

O fluxograma é **dados** (lista de fases → caixas com rótulo, detalhe, ator e link) no mesmo módulo do conteúdo,
para que mudar a sequência seja editar uma lista.

### 3. Capítulos do planejador (primeira versão)

| # | slug | Título | Cobre |
|---|------|--------|-------|
| 1 | `primeiros-passos` | Primeiros passos | criar conta, criar a obra, cadastrar responsáveis, gerar o link do quadro da TV |
| 2 | `programar-semana` | Programar a semana | criar rascunho, adicionar atividade (meta, dias, período, equipe prevista, responsável), "Programar semana", reabrir |
| 3 | `check-in` | Abrir o turno e fazer o check-in | novo turno, trazer da programação, adicionar atividade, efetivo por equipe, liberar ao campo, enviar o link ao responsável |
| 4 | `durante-o-turno` | Acompanhar o turno | quadro, paradas avisadas pelo campo, serviço extra e adiantar pelo planejador |
| 5 | `fechar-turno` | Fechar o turno e gerar o RDO | check-out, corrigir execução, informar causas, fechar, baixar o RDO, reabrir turno |
| 6 | `encerrar-semana` | Encerrar a semana e ler o PPC | encerrar com causas, tela Análise (PPC) |
| 7 | `quadro-tv` | Quadro na TV | link público, check-in × check-out, trocar o link |
| 8 | `duvidas` | Dúvidas comuns | "não salvo"/sinal fraco, conflito entre abas, link desativado, "Responsável" × sem responsável |

O texto descreve o comportamento **atual** do app (conferir na tela e nos specs de cada funcionalidade em
`docs/superpowers/specs/`). Linguagem simples, verbos no imperativo ("Clique em…"), rótulos dos botões entre aspas
exatamente como aparecem na tela.

### 4. "Como usar" no link de campo

Em `/t/[token]`, um link discreto **"Como usar"** no topo (ao lado de "Lançando como … · Trocar", e também na tela
"Quem é você?"). Abre um painel/seção recolhível na própria página (sem navegar, sem guardar estado no
navegador), com 5–7 passos curtos e capturas do celular: escolher seu nome → lançar o executado e o efetivo →
registrar parada → serviço extra / adiantar → avisar o planejador (ou "Enviar" em "Ver tudo") → o que significa
"não salvo". Mesmo módulo de conteúdo, capítulo `campo` (não aparece no índice do planejador, mas tem página
`/ajuda/campo` para o planejador ver o que o campo vê).

### 5. Botão "?"

Um componente `BotaoAjuda` (ícone "?" com rótulo acessível "Ajuda sobre esta tela") no cabeçalho de cada tela
principal, abrindo o capítulo/passo na mesma aba:

| Tela | Destino |
|------|---------|
| Lista de obras / nova obra / página da obra | `primeiros-passos` |
| Programação (lista e semana) | `programar-semana` (semana encerrável → `encerrar-semana`) |
| Novo turno / turno `planejado` / check-in | `check-in` |
| Turno `em_campo` | `durante-o-turno` |
| Turno `enviado`/`fechado`, RDOs | `fechar-turno` |
| Análise (PPC) | `encerrar-semana` |
| Quadro (autenticado) | `quadro-tv` |

### 6. Busca

Campo na `/ajuda`, no cliente, sobre títulos e textos de todos os passos (sem acento e sem maiúsculas: "check in"
acha "Check-in"). Resultados: título do passo + capítulo, link com âncora. Sem resultado: "Nada encontrado.
Veja as Dúvidas comuns." Nada guardado no navegador.

### 7. Conteúdo versionado

- Módulo `lib/ajuda/` com o conteúdo tipado: capítulos → passos (`id`, título, texto em parágrafos curtos,
  dica opcional, captura opcional com `alt`), fluxograma e novidades (`data`, texto, link). Sem dependência nova
  (nada de MDX/Markdown).
- Funções puras testáveis: busca (normalização e ranking simples: título antes de texto), destino do "?" por tela.
- Teste (vitest): toda captura referenciada existe em `public/ajuda/`; todo link do fluxograma, das novidades e
  do "?" aponta para capítulo e passo existentes; ids únicos; nenhum texto contém "encarregado".
- **Regra nova no AGENTS.md:** "Funcionalidade que muda o que o usuário vê ou faz atualiza no mesmo PR o
  manual (`lib/ajuda/`), as capturas (rodar o roteiro) e, se mudar a sequência, o fluxograma; e ganha uma linha
  em Novidades."
- Primeira entrada em Novidades: o próprio manual. Entradas retroativas dos itens 1–7 do backlog (16–17/11).

### 8. Capturas automáticas

- Roteiro Playwright separado dos testes (`tests/manual/capturas.spec.ts`, projeto próprio no
  `playwright.config.ts`, comando `npm run manual:capturas`); **não roda no `npm run test:e2e`**.
- Cria usuário de teste (reusa `prepararUsuario`/`limparUsuario`), monta uma **obra de exemplo** fictícia e
  realista (empreiteira atendendo indústria: ex. "Ampliação do Galpão 3", 3 responsáveis, ~6 atividades na
  semana, um turno com parada e um serviço extra), percorre o fluxograma e fotografa cada passo; apaga tudo no fim.
- Planejador: viewport de computador 1280×800. Campo: contexto móvel (Pixel 7), como no e2e atual.
- Antes de fotografar, destaca o elemento do passo (contorno laranja injetado só na captura).
- Salva em `public/ajuda/<capitulo>-<passo>.png` (commitados). Nomes estáveis: rodar de novo sobrescreve.
- Nenhum dado real de cliente nas capturas; nomes fictícios.
- **Alvo de cada passo no conteúdo** *(decisão do Claude)*: todo passo com captura tem um campo `alvo` no módulo
  `lib/ajuda/` (papel + nome acessível do elemento, ex. `{ papel: "button", nome: "Liberar ao campo" }`). O roteiro
  usa esse alvo para destacar o elemento e **falha** se ele não aparecer na tela, apontando capítulo e passo. Assim,
  botão renomeado ou removido derruba o roteiro em vez de deixar o manual mentindo. O roteiro continua fora do
  `npm run test:e2e` (é lento e reescreve imagens); a regra do AGENTS.md manda rodá-lo em todo PR que muda tela.
- **Datas variam entre rodadas** *(decisão do Claude)*: a obra de exemplo é criada na hora, então datas, semana e
  número do RDO mudam a cada execução e as imagens mudam junto. Aceito: não se força data no servidor. Para reduzir
  ruído, o roteiro aceita rodar só um capítulo (`npm run manual:capturas -- --grep <capitulo>`), e o PR commita só
  as imagens dos capítulos afetados.

## Restrições

- Next.js 16.2.6 com mudanças de API: ler `node_modules/next/dist/docs/` antes de escrever rotas/páginas.
- Sem `localStorage`/`sessionStorage`.
- Identidade visual: tokens existentes (`docs/marca/`), menu lateral atual.
- Funciona no celular (manual é lido no canteiro) e acessível (alt nas capturas, links com texto).
- Depois de concluído: atualizar o Vercel (regra do projeto).

## Deixado para quem constrói

- Texto exato de cada passo (conferindo a tela real) e quantos passos por capítulo.
- Desenho visual do índice, dos cartões e do painel "Como usar", dentro da identidade.
- Detalhes do roteiro de captura (ordem, esperas, recortes por elemento ou tela inteira).
- Escolha do ícone do "?" e do item "Ajuda" no menu, entre os já usados no projeto.
