-- Item 4.3: ciencia do fiscal do cliente nos servicos extras, por link semanal sem conta.
-- A ciencia fica em tabela propria: o turno fechado (e o RDO oficial) nao muda.

create table public.links_ciencia (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  codigo text not null,
  codigo_hash text not null unique,
  created_at timestamptz not null default now(),
  unique (obra_id, semana)
);

alter table public.links_ciencia enable row level security;
revoke all on public.links_ciencia from anon, authenticated;
grant select, insert, update, delete on public.links_ciencia to authenticated;
grant all on public.links_ciencia to service_role;

create policy links_ciencia_all on public.links_ciencia
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = links_ciencia.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = links_ciencia.obra_id and public.eh_membro(o.empresa_id)));

-- Uma ciencia por servico extra; gravada so pelo servidor (service_role) depois de validar o link.
create table public.ciencias_extra (
  atividade_id uuid primary key references public.atividades(id) on delete cascade,
  link_id uuid not null references public.links_ciencia(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  ciente_em timestamptz not null default now()
);

alter table public.ciencias_extra enable row level security;
revoke all on public.ciencias_extra from anon, authenticated;
grant select on public.ciencias_extra to authenticated;
grant all on public.ciencias_extra to service_role;

create policy ciencias_extra_select on public.ciencias_extra
  for select to authenticated
  using (exists (select 1 from public.links_ciencia l join public.obras o on o.id = l.obra_id
                 where l.id = ciencias_extra.link_id and public.eh_membro(o.empresa_id)));
