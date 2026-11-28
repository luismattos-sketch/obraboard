# 5.2 — Restrições por item do lookahead

Épico 5, item 5.2. Conversado com o Luis em 2026-11-27. Depende do 5.1 (no ar).

## Por quê

No lookahead, o planejador marca o que impede cada item de ser executado e quem tem de destravar, para chegar à semana com o item livre (o 5.3 vai usar isso como trava). **Não há aviso nem link para o cliente** — decisão do Luis: basta relacionar um responsável.

## Objetivo

- Cada item do lookahead (`cronograma_itens`, importado ou manual) pode ter várias restrições: **tipo**, **descrição**, **responsável**, **prazo**, **situação** (Aberta / Removida).
- Ver no lookahead quantas restrições abertas cada item tem e quais estão vencidas.

## Fora do escopo / anti-objetivos

- Avisar, mandar link, WhatsApp ou PDF ao cliente.
- Trava na programação (é o 5.3).
- Restrição em atividade da semana criada sem o lookahead.

## Abordagens

Um caminho só: tabela própria ligada ao item do lookahead. Pôr a restrição na atividade da semana chegaria tarde (o lookahead existe para destravar antes); guardar como texto no item não dá prazo nem situação.

## Desenho

**Dados** (migration nova; conferir o maior número em `supabase/migrations`, hoje `20261206000000`):
`restricoes(id, cronograma_item_id fk cronograma_itens on delete cascade, tipo text, descricao text not null (1–300), responsavel text not null (1–100), prazo date null, removida_em timestamptz null, created_at, updated_at)`. `tipo` usa a mesma lista das causas (`material, mao_de_obra, equipamento, projeto_informacao, clima, atividade_predecessora, liberacao_area, seguranca, outro`) e os mesmos rótulos do app. RLS pela obra do item (mesmo padrão de `cronograma_itens`).

**Tela Lookahead:**
- No cartão do item: selo "N restrições abertas" (alerta) ou "N vencidas" (perigo, prazo < hoje e aberta); "Sem restrições" não aparece. Toque em "Restrições" abre a lista do item.
- Lista do item: cada restrição com tipo, descrição, responsável, prazo; botões "Removida" (marca `removida_em`), "Reabrir", "Editar", "Apagar". Removidas aparecem riscadas/recolhidas abaixo.
- "Adicionar restrição": tipo (menu), descrição, responsável (texto com sugestões dos responsáveis da obra, como em Problemas e oportunidades), prazo (opcional).
- Itens removidos do cronograma mantêm as restrições (não apagam).

**Manual/Novidades:** passo novo no capítulo "Programar a semana" (`restricoes`), captura, linha em Novidades; fluxograma só se a sequência mudar (não muda).

## Decisões minhas (o Luis pode corrigir)

- Responsável é texto livre com sugestões (pode ser alguém do cliente).
- Prazo opcional; "vencida" = aberta com prazo antes de hoje.
- Tipos = a lista de causas existente (permite comparar depois restrição prevista × causa real).
- Restrições vivem no item do lookahead, não na atividade da semana.
