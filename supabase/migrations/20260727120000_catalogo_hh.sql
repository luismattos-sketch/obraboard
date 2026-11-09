create extension if not exists pgcrypto;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.catalogo_hh (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null,
  atividade text not null,
  indice_hh numeric(12, 4) not null check (indice_hh >= 0),
  unidade text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint catalogo_hh_registro_unico unique (disciplina, atividade, unidade)
);

create index if not exists catalogo_hh_disciplina_idx
on public.catalogo_hh (disciplina);

create index if not exists catalogo_hh_atividade_trgm_idx
on public.catalogo_hh
using gin (atividade extensions.gin_trgm_ops);

create or replace function public.atualizar_catalogo_hh_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists catalogo_hh_atualizado_em_trg on public.catalogo_hh;
create trigger catalogo_hh_atualizado_em_trg
before update on public.catalogo_hh
for each row
execute function public.atualizar_catalogo_hh_atualizado_em();

alter table public.catalogo_hh enable row level security;

revoke insert, update, delete on table public.catalogo_hh from authenticated;
grant select on table public.catalogo_hh to authenticated;

drop policy if exists "authenticated_read_catalogo_hh" on public.catalogo_hh;
create policy "authenticated_read_catalogo_hh"
on public.catalogo_hh
for select
to authenticated
using (ativo = true);

alter table public.atividades
add column if not exists catalogo_hh_id uuid references public.catalogo_hh(id),
add column if not exists quantidade_planejada numeric(14, 4),
add column if not exists indice_hh_aplicado numeric(12, 4),
add column if not exists unidade_hh text,
add column if not exists hh_planejado numeric(14, 4);

create index if not exists atividades_catalogo_hh_id_idx
on public.atividades (catalogo_hh_id);

create or replace function public.calcular_atividade_hh_planejado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quantidade_planejada is not null
    and new.indice_hh_aplicado is not null
    and new.quantidade_planejada > 0
    and new.indice_hh_aplicado >= 0 then
    new.hh_planejado = round(new.quantidade_planejada * new.indice_hh_aplicado, 4);
  else
    new.hh_planejado = null;
  end if;

  return new;
end;
$$;

drop trigger if exists atividades_hh_planejado_trg on public.atividades;
create trigger atividades_hh_planejado_trg
before insert or update of quantidade_planejada, indice_hh_aplicado on public.atividades
for each row
execute function public.calcular_atividade_hh_planejado();
