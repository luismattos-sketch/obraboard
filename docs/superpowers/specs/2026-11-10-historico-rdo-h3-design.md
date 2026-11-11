# Frentia — Histórico de RDO, etapa H3: baixar os RDOs do mês em PDF único (design)

Data: 2026-11-10 · Branch: `historico-rdo-h3` · Etapa H3 de 4 do histórico de RDO (H1 versões oficiais e
H2 linha do tempo no ar).

## Objetivo

Com um clique, baixar **um único PDF** com todos os RDOs oficiais de um mês (de uma obra ou de todas),
para enviar ao cliente ou arquivar. Cada RDO dentro do arquivo é idêntico ao download individual.

Público: planejador.

## Contexto (estado atual)

- Listas `/rdos` (filtros obra + mês) e `/obras/[obraId]/rdos` (filtro mês), formulário GET
  (`components/rdo/FiltrosRdo.tsx`), lista em `components/rdo/ListaRdos.tsx`.
- `listarVersoes` (`lib/db/rdo-versoes.ts`) devolve `ItemVersao[]` sem a foto; `agruparVersoes`
  (`lib/dominio/historico-rdo.ts`) monta um `GrupoRdo` por turno com `atual` e `anteriores`.
- PDF individual: `respostaVersao` → `lerFoto` + `emissaoDaVersao(v, anterior)` → `respostaPdf`, que
  renderiza `DocumentoRdo` com `renderToBuffer` (`lib/rdo/responder.ts`). Rodapé "Página X de Y"
  por documento.
- Nome do arquivo: `nomeArquivoRdo` (`lib/rdo/nome-arquivo.ts`, com `slug`).

## Decisões

| Tema | Decisão |
|---|---|
| Como escolher | Botão na lista usando o filtro da tela (obra + mês). Só aparece com mês escolhido e ≥ 1 RDO. Sem caixinhas. |
| Que versão | Só a versão atual de cada turno (a mesma do "Baixar" da linha). Turno reaberto: entra a última oficial e a capa avisa. |
| Organização | Capa com índice + RDOs em ordem: obra (nome), depois data e período (`compararTurnos`) crescente. |
| Montagem | Cada RDO renderizado como hoje e juntado com `pdf-lib` (dependência nova). Paginação de cada RDO preservada. |
| Teto | 120 RDOs por arquivo; acima disso nada é gerado e a tela pede para escolher uma obra. |
| Falha | Se qualquer RDO falhar, o lote inteiro falha (nada é pulado em silêncio). |

## Fora do escopo

Período livre (datas início/fim), seleção manual, ZIP, versões anteriores no lote, consolidado (H4),
guardar o PDF do lote.

## 1. Seleção — `lib/dominio/lote-rdo.ts` (puro)

- `LIMITE_LOTE = 120`.
- `selecionarLote(itens: ItemVersao[], mes: string, obraId: string | null): ItemLote[]` — usa
  `agruparVersoes(itens, mes)`, filtra por `obraId` quando dado, devolve `{ atual: ItemVersao, reaberto,
  anterior?: { numero, emitidoEm } }` ordenado por `obraNome` (`localeCompare` pt-BR), depois
  `compararTurnos` crescente. `anterior` = item do mesmo turno com `numero - 1` (vem de
  `grupo.anteriores`), para o texto "substitui a versão N" sem nova consulta.
- `paginasIniciais(paginasCapa: number, paginasPorRdo: number[]): number[]` — página (1-based, no arquivo
  final) onde cada RDO começa.
- `nomeArquivoLote(obraNome: string | null, mes: string)` em `lib/rdo/nome-arquivo.ts` →
  `RDOs-<slug-obra>-AAAA-MM.pdf` ou `RDOs-todas-as-obras-AAAA-MM.pdf`.

## 2. Geração

### `lib/rdo/responder.ts`
Extrair `renderizarRdo(turno, emissao): Promise<Buffer>` (o `renderToBuffer` de hoje); `respostaPdf`
passa a usá-la. Download individual e lote compartilham o mesmo caminho.

### `lib/db/rdo-versoes.ts`
`obterVersoes(c, ids: string[]): Promise<VersaoRdo[]>` — uma consulta `.in("id", ids)` com a foto
(ids ≤ 120, cabe num pedido).

### `lib/rdo/lote.ts`
`gerarLote(c, lote: ItemLote[], cabecalho: { mes, obraNome | null, geradoEm }): Promise<Uint8Array>`
1. `obterVersoes` dos `lote[i].atual.id`; faltar alguma → erro.
2. Para cada item, em sequência (memória): `lerFoto` + `emissaoDaVersao(v, anterior)` +
   `renderizarRdo`; carregar com `PDFDocument.load` e guardar o número de páginas.
3. Renderizar a capa supondo 1 página; se sair com P > 1 páginas, renderizar de novo com
   `paginasIniciais(P, …)` (no máximo 2 tentativas; o número de linhas não muda entre elas).
4. `PDFDocument.create()`, copiar páginas da capa e de cada RDO (`copyPages`), definir título
   ("RDOs — <obra|Todas as obras> — <mês>"), autor/criador "Frentia"; `save()`.

### `lib/rdo/capa-lote.tsx`
Documento react-pdf com o mesmo estilo/logo (`estilos.ts`, `logoFrentia` exportado de `documento.tsx`)
e texto sanitizado (`sanitizarProfundo`):
- Título "RDOs de novembro de 2026"; linha da obra ou "Todas as obras"; "23 RDOs";
  "Gerado em 10/11/2026 14:32 (horário de Brasília)".
- Se houver reabertos: "N turno(s) reaberto(s): incluída a última versão oficial."
- Índice (tabela): [Obra, só com várias obras] · Data · Período · Versão · % cumprido · Página.
- Rodapé "Página X de Y" da própria capa.

### Rota `app/api/rdo/lote/route.ts`
`GET ?mes=AAAA-MM&obra=<uuid opcional>`; `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
`maxDuration = 60`.
1. Sem sessão → `redirect("/login?proximo=…")` com `caminhoSeguro` (fora de try/catch).
2. `normalizarMes`; inválido/ausente → 400 `{ erro: "Escolha um mês" }`. `obra` presente e não-UUID → 400.
3. `listarVersoes(c, obra ? { obraId } : {})` (RLS limita à empresa) → `selecionarLote`.
4. Vazio → 404 `{ erro: "Nenhum RDO neste filtro" }`. > 120 → 422
   `{ erro: "Muitos RDOs neste filtro; escolha uma obra" }`.
5. `gerarLote` → `application/pdf`, `Content-Disposition: attachment; filename="…"`, `no-store`.
   Exceção → log + 500 `{ erro: "Não foi possível gerar o arquivo" }`.

## 3. Tela

`components/rdo/BaixarLote.tsx` (servidor, sem JS): recebe `quantidade`, `href`.
- `quantidade === 0` ou sem mês → nada.
- `quantidade > LIMITE_LOTE` → `Aviso` "Muitos RDOs neste filtro (N). Escolha uma obra para baixar em
  PDF único."
- Senão → link com `classesBotao("primario")`: "Baixar os N RDOs (PDF único)" (1 → "Baixar o RDO (PDF
  único)").

Usado em `/rdos` e `/obras/[obraId]/rdos`, entre filtros e lista; `quantidade` = número de grupos do
filtro (`agruparVersoes` já calculado pela página). `href` = `/api/rdo/lote?mes=…[&obra=…]`.

## 4. Testes

- Unidade (`vitest`): `selecionarLote` (só atual, filtro obra/mês, ordem obra→data→período, reaberto,
  `anterior`), `paginasIniciais`, `nomeArquivoLote`, `BaixarLote` (0 / 1 / N / > 120).
- Integração (`SUPABASE_TEST=1`): obra própria com 2 turnos fechados (um reaberto e fechado de novo →
  v2) → `gerarLote` → `PDFDocument.load`: páginas = capa + soma dos individuais; rota sem sessão
  redireciona; usuário de outra empresa recebe 404.
- E2E (Playwright): na lista da obra, escolher mês, clicar "Baixar os N RDOs", download `.pdf` começando
  com `%PDF`. Pré-aquecer a rota com `page.request.get`.
- Medir o tempo de geração na integração (alvo: < 60 s para 120 RDOs; registrar o valor observado).

## 5. Entrega

Sem migration. `npm i pdf-lib`. Branch `historico-rdo-h3` → push (prévia Vercel) → validação do
usuário → merge `--no-ff` na `main` + push (produção).
