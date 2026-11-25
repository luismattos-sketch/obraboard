-- Item 2.5: problemas e oportunidades do quadro (problema, acao, responsavel, prazo).
-- Responsavel em texto livre (pode ser alguem do cliente); o app sugere os responsaveis da obra.

create table public.problemas_quadro (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  tipo text not null default 'problema' check (tipo in ('problema', 'oportunidade')),
  descricao text not null check (btrim(descricao) <> '' and length(descricao) <= 300),
  acao text check (acao is null or length(acao) <= 300),
  responsavel text check (responsavel is null or length(responsavel) <= 60),
  prazo date,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index problemas_quadro_obra_idx on public.problemas_quadro (obra_id, resolvido_em);

create trigger problemas_quadro_updated_at before update on public.problemas_quadro
  for each row execute function public.tg_atualizar_updated_at();

alter table public.problemas_quadro enable row level security;
revoke all on public.problemas_quadro from anon, authenticated;
grant select, insert, update, delete on public.problemas_quadro to authenticated;
grant all on public.problemas_quadro to service_role;

create policy problemas_quadro_all on public.problemas_quadro
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = problemas_quadro.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = problemas_quadro.obra_id and public.eh_membro(o.empresa_id)));
