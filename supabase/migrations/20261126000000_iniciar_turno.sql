-- Iniciar turno por equipe (espelho de turno_equipes_terminadas) e autor do clima.

-- 1. "Iniciar turno" por equipe e turno.
create table if not exists public.turno_equipes_iniciadas (
  turno_id uuid not null references public.turnos(id) on delete cascade,
  responsavel_id uuid not null references public.responsaveis(id) on delete cascade,
  iniciou_em time not null,
  created_at timestamptz not null default now(),
  primary key (turno_id, responsavel_id)
);
create index if not exists turno_equipes_iniciadas_responsavel_idx on public.turno_equipes_iniciadas (responsavel_id);
drop trigger if exists turno_equipes_iniciadas_bloquear_fechado on public.turno_equipes_iniciadas;
create trigger turno_equipes_iniciadas_bloquear_fechado before insert or update or delete on public.turno_equipes_iniciadas
  for each row execute function public.tg_bloquear_turno_fechado();
drop trigger if exists turno_equipes_iniciadas_responsavel_obra on public.turno_equipes_iniciadas;
create trigger turno_equipes_iniciadas_responsavel_obra before insert or update on public.turno_equipes_iniciadas
  for each row execute function public.tg_responsavel_mesma_obra();

alter table public.turno_equipes_iniciadas enable row level security;
revoke all on public.turno_equipes_iniciadas from anon, authenticated;
grant select, insert, update, delete on public.turno_equipes_iniciadas to authenticated;
grant all on public.turno_equipes_iniciadas to service_role;
drop policy if exists turno_equipes_iniciadas_all on public.turno_equipes_iniciadas;
create policy turno_equipes_iniciadas_all on public.turno_equipes_iniciadas
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = turno_equipes_iniciadas.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = turno_equipes_iniciadas.turno_id and public.eh_membro(o.empresa_id)));

-- 2. Clima: quem alterou por último (null com lancado_em = planejador).
alter table public.clima add column if not exists lancado_por_id uuid references public.responsaveis(id) on delete set null;
alter table public.clima add column if not exists lancado_em timestamptz;
create index if not exists clima_lancado_por_idx on public.clima (lancado_por_id);

create or replace function public.tg_responsavel_mesma_obra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_ids uuid[];
begin
  if tg_table_name = 'programacao_atividades' then
    select s.obra_id into v_obra from public.semanas s where s.id = new.semana_id;
    v_ids := array[new.responsavel_id];
  elsif tg_table_name = 'atividades' then
    select t.obra_id into v_obra from public.turnos t where t.id = new.turno_id;
    v_ids := array[new.responsavel_id, new.lancado_por_id, new.criada_por_id];
  elsif tg_table_name = 'efetivo_ocorrencias' then
    select t.obra_id into v_obra from public.turnos t where t.id = new.turno_id;
    v_ids := array[new.responsavel_id, new.destino_responsavel_id, new.aguardando_responsavel_id];
  elsif tg_table_name = 'clima' then
    select t.obra_id into v_obra from public.turnos t where t.id = new.turno_id;
    v_ids := array[new.lancado_por_id];
  else
    select t.obra_id into v_obra from public.turnos t where t.id = new.turno_id;
    v_ids := array[new.responsavel_id];
  end if;

  if exists (
    select 1 from unnest(v_ids) as x(id)
     where x.id is not null
       and not exists (select 1 from public.responsaveis r where r.id = x.id and r.obra_id = v_obra)
  ) then
    raise exception 'responsavel_invalido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.tg_responsavel_mesma_obra() from public;
revoke all on function public.tg_responsavel_mesma_obra() from anon, authenticated;

drop trigger if exists clima_responsavel_obra on public.clima;
create trigger clima_responsavel_obra before insert or update of lancado_por_id on public.clima
  for each row execute function public.tg_responsavel_mesma_obra();
