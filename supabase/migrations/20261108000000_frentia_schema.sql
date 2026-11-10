-- Frentia: schema, RLS e funcoes auxiliares.
create extension if not exists pgcrypto;

create or replace function public.tg_atualizar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'dono' check (papel in ('dono')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, user_id)
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cliente text,
  endereco text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null,
  periodo text not null check (periodo in ('diurno','noturno')),
  hora_inicio_prevista time,
  hora_fim_prevista time,
  hora_inicio_real time,
  hora_fim_real time,
  status text not null default 'planejado'
    check (status in ('planejado','em_campo','enviado','fechado')),
  token_hash text,
  enviado_em timestamptz,
  fechado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, data, periodo),
  unique (token_hash)
);

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  ordem integer not null default 0,
  descricao text not null,
  local text,
  unidade text,
  qtd_planejada numeric not null check (qtd_planejada > 0),
  qtd_realizada numeric check (qtd_realizada >= 0),
  causa text check (causa in (
    'material','mao_de_obra','equipamento','projeto_informacao','clima',
    'atividade_predecessora','liberacao_area','seguranca','outro')),
  observacao text,
  origem_id uuid references public.atividades(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.efetivo (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  funcao text not null,
  quantidade integer not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clima (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  periodo text not null check (periodo in ('manha','tarde','noite')),
  condicao text not null check (condicao in ('bom','chuva_leve','chuva_forte')),
  impediu boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turno_id, periodo)
);

-- Indices em FKs
create index membros_user_id_idx on public.membros (user_id);
create index obras_empresa_id_idx on public.obras (empresa_id);
create index turnos_obra_id_idx on public.turnos (obra_id);
create index atividades_turno_id_idx on public.atividades (turno_id);
create index atividades_origem_id_idx on public.atividades (origem_id);
create index efetivo_turno_id_idx on public.efetivo (turno_id);

-- Triggers de updated_at
create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.tg_atualizar_updated_at();
create trigger membros_updated_at before update on public.membros
  for each row execute function public.tg_atualizar_updated_at();
create trigger obras_updated_at before update on public.obras
  for each row execute function public.tg_atualizar_updated_at();
create trigger turnos_updated_at before update on public.turnos
  for each row execute function public.tg_atualizar_updated_at();
create trigger atividades_updated_at before update on public.atividades
  for each row execute function public.tg_atualizar_updated_at();
create trigger efetivo_updated_at before update on public.efetivo
  for each row execute function public.tg_atualizar_updated_at();
create trigger clima_updated_at before update on public.clima
  for each row execute function public.tg_atualizar_updated_at();

-- Funcao de pertencimento (security definer evita recursao de RLS em membros)
create or replace function public.eh_membro(p_empresa uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.empresa_id = p_empresa and m.user_id = auth.uid()
  );
$$;

revoke all on function public.eh_membro(uuid) from public;
revoke all on function public.eh_membro(uuid) from anon;
grant execute on function public.eh_membro(uuid) to authenticated, service_role;

-- RLS
alter table public.empresas enable row level security;
alter table public.membros enable row level security;
alter table public.obras enable row level security;
alter table public.turnos enable row level security;
alter table public.atividades enable row level security;
alter table public.efetivo enable row level security;
alter table public.clima enable row level security;

-- Grants explicitos nos dois sentidos (nao depender dos default privileges do Supabase):
-- anon nao recebe nada; authenticated so le empresas/membros; service_role recebe tudo.
grant usage on schema public to authenticated;
revoke all on public.empresas, public.membros, public.obras, public.turnos,
  public.atividades, public.efetivo, public.clima from anon, authenticated;
grant select on public.empresas, public.membros to authenticated;
grant select, insert, update, delete on public.obras, public.turnos,
  public.atividades, public.efetivo, public.clima to authenticated;
grant all on all tables in schema public to service_role;

create policy empresas_select on public.empresas
  for select to authenticated
  using (public.eh_membro(id));

create policy membros_select on public.membros
  for select to authenticated
  using (user_id = auth.uid());

create policy obras_all on public.obras
  for all to authenticated
  using (public.eh_membro(empresa_id))
  with check (public.eh_membro(empresa_id));

create policy turnos_all on public.turnos
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = turnos.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = turnos.obra_id and public.eh_membro(o.empresa_id)));

create policy atividades_all on public.atividades
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = atividades.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = atividades.turno_id and public.eh_membro(o.empresa_id)));

create policy efetivo_all on public.efetivo
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = efetivo.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = efetivo.turno_id and public.eh_membro(o.empresa_id)));

create policy clima_all on public.clima
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = clima.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = clima.turno_id and public.eh_membro(o.empresa_id)));
