# 5.1 — Lookahead de 3 a 6 semanas (cronograma importado ou manual)

Épico 5 (Lookahead e restrições), item 5.1. Conversado com o Luis em 2026-11-27. Ordem do épico: 5.1 → 5.2 → 5.3 → 5.4, um por vez.

## Por quê

No LPS, o planejador olha 3 a 6 semanas à frente para ver o que vai começar e destravar o que impede (5.2 restrições; 5.3 só entra na semana o que está livre). Hoje a atividade só existe dentro de uma semana (`semanas` rascunho → programada → encerrada); não há onde guardar o que vem depois.

Na indústria (capex), o cliente tem o cronograma master e gerencia várias contratadas; o cronograma detalhado da montagem é da contratada, feito em MS Project ou Primavera. É esse que entra no Frentia.

## Objetivos

- Subir o cronograma da contratada em **CSV ou Excel (.xlsx)** exportado do Project/Primavera.
- Montar o lookahead **também à mão**, sem cronograma (itens manuais).
- Tela **Lookahead**: próximas 3–6 semanas (seletor 3/4/5/6, padrão 4), itens agrupados por semana.
- **Levar para a semana**: um item vira atividade no rascunho da semana, ligada ao item; um item pode virar várias atividades (quebra à mão).
- **Subir de novo** reconhece cada linha pelo código: atualiza, marca o que saiu, nunca apaga o que foi levado (e, no 5.2, o que tem restrição).

## Fora do escopo

- Restrições (5.2), trava de entrada (5.3), roteiro guiado (5.4).
- Ler XML do Project / XER do Primavera (fica se o piloto pedir).
- Quebra automática com IA (10.5).
- Gantt, dependências entre linhas, caminho crítico, % avançado vindo do cronograma.

## Anti-objetivos

- Subir de novo apagar ou mudar atividades já levadas para semanas, ou itens manuais.
- Obrigar a ter cronograma para usar o lookahead.
- Mudar o fluxo atual das semanas (rascunho/programada/encerrada, "Trazer", sequência).

## Abordagens consideradas

- **A. Cronograma como lista própria da obra + lookahead como janela sobre ela** — escolhida. Semanas intactas; 5.2/5.3 se apoiam no item; quebra natural.
- B. Importar criando semanas futuras em rascunho — reimportação bagunça rascunhos, sem lugar para restrição antes da semana, quebra confusa.
- C. Ler XML/XER direto — dois formatos difíceis; ambos os programas exportam Excel.

## Desenho

### Dados (migration nova; conferir o maior número em `supabase/migrations` — hoje 20261205000000)

Tabela `cronograma_itens`:
- `id`, `obra_id` (fk obras, cascade), `origem` (`'importado' | 'manual'`)
- `codigo` text — obrigatório se importado, nulo se manual; único por obra entre importados
- `descricao` text not null, `inicio` date not null, `fim` date not null (`fim >= inicio`)
- `local`, `unidade` text; `quantidade` numeric (> 0 ou nulo)
- `removido_em` timestamptz — "saiu do cronograma" (só importados)
- `created_at`, `updated_at`
- RLS igual às demais tabelas da obra (pela empresa do membro).

Tabela `cronograma_importacoes` (histórico mínimo + mapeamento lembrado):
- `id`, `obra_id`, `arquivo_nome`, `mapeamento` jsonb (qual coluna é qual campo), `novos`, `atualizados`, `removidos` int, `created_at`.
- O mapeamento da última importação da obra é o padrão da próxima.

`programacao_atividades`: nova coluna `cronograma_item_id uuid` (fk, `on delete set null`), nula para atividades que não vieram do lookahead.

### Importação

1. Na tela Lookahead, "Subir cronograma" aceita `.csv` e `.xlsx` (primeira planilha). Instalar uma biblioteca para ler xlsx (escolha do construtor; preferir leve e mantida). CSV: aceitar `;` e `,`, UTF-8 e Latin-1 (Excel em pt-BR).
2. O Frentia adivinha as colunas por nomes comuns em pt e en (Id, EDT/WBS, Activity ID, Nome da tarefa/Task Name/Activity Name, Início/Start, Término/Fim/Finish, Local/Área, Quantidade, Unidade) e mostra **prévia**: escolha de coluna por campo (código, descrição, início e fim obrigatórios) + primeiras linhas + contagem "X novos · Y atualizados · Z saem do cronograma · W linhas ignoradas (motivo)".
3. Datas: aceitar data do Excel, `dd/mm/aaaa`, `dd/mm/aa`, ISO, e com hora (descarta a hora). Linha sem código, sem descrição ou com data inválida é ignorada e listada na prévia. Linhas-resumo do Project (pacotes) entram como qualquer outra — o planejador decide o que levar.
4. Confirmar grava tudo numa transação:
   - código novo → cria item;
   - código existente → atualiza descrição, datas, local, quantidade, unidade; se estava removido, volta;
   - código ausente no arquivo → `removido_em = now()` (não apaga);
   - itens manuais não são tocados.
5. Atividades já levadas **não mudam** quando o item muda. Na lista, o item mostra "mudou desde que foi levado" quando datas/descrição/quantidade mudaram depois da última atividade levada (comparar `updated_at` do item com o `created_at` da atividade ligada mais recente).

### Itens manuais

"Adicionar item" no Lookahead: descrição, início, fim (obrigatórios), local, quantidade, unidade. Editar e apagar livre (apagar não mexe nas atividades já levadas; o vínculo fica nulo). Item importado não é editável nem apagável à mão (o cronograma é a fonte); se o planejador quiser outra coisa, cria item manual.

### Tela Lookahead

- Nova etapa **Lookahead** no menu lateral da obra, entre Programação e Turnos (ou onde fizer sentido no menu atual).
- Topo: seletor 3/4/5/6 semanas (padrão 4; guardar a escolha no remoto ou só na URL — sem localStorage), "Subir cronograma", "Adicionar item", data da última importação.
- Começa na **semana seguinte à atual** (a atual já é a Programação). Cada semana é um bloco "Semana de dd/mm" com seu status (sem programação / rascunho / programada).
- Um item aparece em **toda semana em que seu período cai** (inicio ≤ domingo e fim ≥ segunda).
- Cada item: descrição, código (se houver), período, local, quantidade+unidade, selo "manual", selo "saiu do cronograma" (cinza, ainda visível se tem atividade levada; sem atividade levada fica oculto atrás de "mostrar removidos"), selo "na semana de dd/mm" para cada semana onde já virou atividade, aviso "mudou desde que foi levado".
- Celular primeiro, como o resto do app.

### Levar para a semana

- Botão "Levar para esta semana" no item, dentro do bloco da semana.
- Só para semana **sem programação ou em rascunho**: se não existe, cria o rascunho. Semana programada/encerrada: botão desativado com "semana já programada".
- Abre o formulário de atividade já usado na programação, **pré-preenchido**: descrição, local, unidade; dias = dias do período do item dentro da semana; meta = quantidade do item, se houver (planejador ajusta); período diurno. Ao salvar, grava `cronograma_item_id`.
- Pode levar o mesmo item de novo (quebra à mão).
- Na tela da semana (Programação), atividade com `cronograma_item_id` mostra o código do cronograma, discreto.

### Manual, capturas, novidades (regra do AGENTS.md)

- Capítulo/seção do Lookahead em `lib/ajuda/`, capturas (`MANUAL_CAPITULO=<capitulo>`), passo no fluxograma (`lib/ajuda/fluxograma.ts`: Lookahead antes de Programação) e linha em `lib/ajuda/novidades.ts`.
- Vocabulário: "responsável", nunca "encarregado".

## Decisões minhas (o Luis pode corrigir)

- Lookahead começa na semana seguinte; padrão 4 semanas.
- Item importado não se edita à mão; manual sim.
- Item aparece em todas as semanas que cobre.
- Atividade levada não acompanha mudanças do cronograma; só aparece o aviso.
- "Levar" só em semana sem programação ou rascunho.
- Linhas-resumo do Project não são filtradas.

## Fica para o construtor

Biblioteca de xlsx, desenho exato dos componentes, onde guardar o seletor de semanas (URL ou remoto), limite de tamanho do arquivo (sugestão: 5 MB / 5.000 linhas), testes (parse de datas, adivinhar colunas, regra de reimportação).
