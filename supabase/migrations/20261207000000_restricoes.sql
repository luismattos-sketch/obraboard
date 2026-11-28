-- Item 5.2: restricoes de cada item do lookahead (tipo, descricao, responsavel, prazo, situacao).
-- Sem aviso ao cliente: so se relaciona um responsavel.

create table public.restricoes (
  id uuid primary key default gen_random_uuid(),
  cronograma_item_id uuid not null references public.cronograma_itens(id) on delete cascade,
  tipo text not null check (tipo in (
    'material','mao_de_obra','equipamento','projeto_informacao','clima',
    'atividade_predecessora','liberacao_area','seguranca','outro')),
  descricao text not null check (char_length(descricao) between 1 and 300),
  responsavel text not null check (char_length(responsavel) between 1 and 100),
  prazo date,
  removida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restricoes_item_idx on public.restricoes (cronograma_item_id);

alter table public.restricoes enable row level security;
revoke all on public.restricoes from anon, authenticated;
grant select, insert, update, delete on public.restricoes to authenticated;
grant all on public.restricoes to service_role;

create policy restricoes_all on public.restricoes
  for all to authenticated
  using (exists (select 1 from public.cronograma_itens ci join public.obras o on o.id = ci.obra_id
                 where ci.id = restricoes.cronograma_item_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.cronograma_itens ci join public.obras o on o.id = ci.obra_id
                      where ci.id = restricoes.cronograma_item_id and public.eh_membro(o.empresa_id)));
