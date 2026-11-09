# Catálogo de HH

O catálogo de HH fica na tabela `public.catalogo_hh` e é usado no check-in para sugerir atividades, preencher índice/unidade e calcular o HH planejado.

## Importação CSV

Use o painel do Supabase para importar registros na tabela `catalogo_hh` com este formato:

```csv
disciplina,atividade,indice_hh,unidade
Mecânica,Montagem de tubulação de 2 polegadas,0.85,m
Mecânica,Montagem de estrutura metálica,0.12,kg
Elétrica,Lançamento de cabo elétrico,0.08,m
```

Informe `indice_hh` com ponto como separador decimal. A interface exibe números em `pt-BR`, mas a importação no banco deve usar decimal com ponto.

Não é necessário preencher `id`, `ativo`, `criado_em` ou `atualizado_em`; o banco define esses valores automaticamente.
