-- Item 9: equipe prevista (função + quantidade) da atividade avulsa/extra do turno.
-- Atividade programada lê a equipe da programação (programacao_efetivo); esta coluna fica [].
alter table public.atividades
  add column equipe jsonb not null default '[]'::jsonb
  check (jsonb_typeof(equipe) = 'array' and jsonb_array_length(equipe) <= 50);
