-- Quadro de check-in/check-out: responsaveis por obra, efetivo por equipe, foto oficial do check-in
-- e link do quadro (TV/gestor). No app o termo e sempre "Responsavel".

-- 1. Responsaveis da obra.
create table public.responsaveis (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  nome text not null check (btrim(nome) <> '' and length(btrim(nome)) <= 60),
  telefone text check (telefone is null or length(telefone) <= 30),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index responsaveis_obra_nome_uniq on public.responsaveis (obra_id, lower(btrim(nome)));

create trigger responsaveis_updated_at before update on public.responsaveis
  for each row execute function public.tg_atualizar_updated_at();

alter table public.responsaveis enable row level security;
revoke all on public.responsaveis from anon, authenticated;
grant select, insert, update, delete on public.responsaveis to authenticated;
grant all on public.responsaveis to service_role;

create policy responsaveis_all on public.responsaveis
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = responsaveis.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = responsaveis.obra_id and public.eh_membro(o.empresa_id)));

-- 2. Colunas de ligacao (opcionais).
alter table public.programacao_atividades
  add column responsavel_id uuid references public.responsaveis(id) on delete set null;
alter table public.atividades
  add column responsavel_id uuid references public.responsaveis(id) on delete set null,
  add column lancado_por_id uuid references public.responsaveis(id) on delete set null;
alter table public.efetivo
  add column responsavel_id uuid references public.responsaveis(id) on delete set null;

create index programacao_atividades_responsavel_idx on public.programacao_atividades (responsavel_id);
create index atividades_responsavel_idx on public.atividades (responsavel_id);
create index atividades_lancado_por_idx on public.atividades (lancado_por_id);
create index efetivo_responsavel_idx on public.efetivo (responsavel_id);

-- 3. Invariante: o responsavel pertence a mesma obra da linha.
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
    v_ids := array[new.responsavel_id, new.lancado_por_id];
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

create trigger programacao_atividades_responsavel_obra
  before insert or update of responsavel_id on public.programacao_atividades
  for each row execute function public.tg_responsavel_mesma_obra();
create trigger atividades_responsavel_obra
  before insert or update of responsavel_id, lancado_por_id on public.atividades
  for each row execute function public.tg_responsavel_mesma_obra();
create trigger efetivo_responsavel_obra
  before insert or update of responsavel_id on public.efetivo
  for each row execute function public.tg_responsavel_mesma_obra();

-- 4. Efetivo substituido sempre por equipe (null = "Sem responsavel").
drop function if exists public.substituir_efetivo(uuid, jsonb, jsonb);

create or replace function public.substituir_efetivo(
  p_turno_id uuid, p_responsavel_id uuid, p_esperado jsonb, p_linhas jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual jsonb;
  v_esperado jsonb;
begin
  -- Serializa substituicoes concorrentes do mesmo turno.
  perform 1 from public.turnos t where t.id = p_turno_id for update;

  select coalesce(jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade)
                            order by e.funcao, e.quantidade), '[]'::jsonb)
    into v_atual
    from public.efetivo e
   where e.turno_id = p_turno_id
     and e.responsavel_id is not distinct from p_responsavel_id;

  select coalesce(jsonb_agg(jsonb_build_object('funcao', x ->> 'funcao', 'quantidade', (x ->> 'quantidade')::integer)
                            order by x ->> 'funcao', (x ->> 'quantidade')::integer), '[]'::jsonb)
    into v_esperado
    from jsonb_array_elements(coalesce(p_esperado, '[]'::jsonb)) as x;

  if v_atual is distinct from v_esperado then
    raise exception 'efetivo_conflito' using errcode = 'P0001';
  end if;

  delete from public.efetivo
   where turno_id = p_turno_id
     and responsavel_id is not distinct from p_responsavel_id;
  insert into public.efetivo (turno_id, funcao, quantidade, responsavel_id)
  select p_turno_id, l.x ->> 'funcao', (l.x ->> 'quantidade')::integer, p_responsavel_id
    from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) with ordinality as l(x, n)
   order by l.n;
end;
$$;
revoke all on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb) from anon;
grant execute on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

-- 5. Foto oficial do check-in (formato EntradaQuadro, lib/dominio/quadro.ts).
create or replace function public.foto_checkin(p_turno_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'obra', (select jsonb_build_object('id', o.id, 'nome', o.nome) from public.obras o where o.id = t.obra_id),
    'turno', jsonb_build_object('id', t.id, 'data', t.data, 'periodo', t.periodo, 'status', t.status,
      'hora_inicio_prevista', t.hora_inicio_prevista, 'hora_fim_prevista', t.hora_fim_prevista,
      'hora_inicio_real', t.hora_inicio_real, 'hora_fim_real', t.hora_fim_real),
    'responsaveis', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'ativo', r.ativo)
                                               order by r.nome)
      from public.responsaveis r
      where r.id in (select a.responsavel_id from public.atividades a where a.turno_id = t.id
                     union select e.responsavel_id from public.efetivo e where e.turno_id = t.id)), '[]'::jsonb),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'programada', a.programacao_atividade_id is not null, 'responsavel_id', a.responsavel_id)
        order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade,
        'responsavel_id', e.responsavel_id) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_checkin(uuid) from public;
revoke all on function public.foto_checkin(uuid) from anon, authenticated;
grant execute on function public.foto_checkin(uuid) to service_role;

create table public.checkin_fotos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null unique references public.turnos(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  emitido_em timestamptz not null,
  formato integer not null default 1,
  dados jsonb not null,
  created_at timestamptz not null default now()
);
create index checkin_fotos_obra_idx on public.checkin_fotos (obra_id);

create or replace function public.tg_emitir_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.checkin_fotos (turno_id, obra_id, emitido_em, dados)
  values (new.id, new.obra_id, now(), public.foto_checkin(new.id))
  on conflict (turno_id) do nothing;
  return null;
end;
$$;
revoke all on function public.tg_emitir_checkin() from public;
revoke all on function public.tg_emitir_checkin() from anon, authenticated;

create trigger turnos_emitir_checkin after update of status on public.turnos
  for each row
  when (old.status = 'planejado' and new.status = 'em_campo')
  execute function public.tg_emitir_checkin();

alter table public.checkin_fotos enable row level security;
revoke all on public.checkin_fotos from anon, authenticated;
grant select on public.checkin_fotos to authenticated;
grant all on public.checkin_fotos to service_role;

create policy checkin_fotos_select on public.checkin_fotos
  for select to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = checkin_fotos.obra_id and public.eh_membro(o.empresa_id)));

-- 6. Link do quadro (so o hash fica no banco).
alter table public.obras add column quadro_token_hash text unique;

-- 7. Programacao semanal grava e fotografa o responsavel.
create or replace function public.salvar_programacao_atividade(p_semana_id uuid, p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_dias smallint[] := (select coalesce(array_agg(x::smallint), '{}')
                        from jsonb_array_elements_text(coalesce(p_dados->'dias', '[]'::jsonb)) x);
  v_resp uuid := nullif(p_dados->>'responsavel_id', '')::uuid;
begin
  if p_id is null then
    insert into public.programacao_atividades (semana_id, ordem, descricao, local, unidade, meta, dias, periodo, responsavel_id)
    values (
      p_semana_id,
      coalesce((select max(pa.ordem) + 1 from public.programacao_atividades pa where pa.semana_id = p_semana_id), 0),
      p_dados->>'descricao', nullif(p_dados->>'local', ''), nullif(p_dados->>'unidade', ''),
      (p_dados->>'meta')::numeric, v_dias, coalesce(p_dados->>'periodo', 'diurno'), v_resp)
    returning id into v_id;
  else
    update public.programacao_atividades
       set descricao = p_dados->>'descricao', local = nullif(p_dados->>'local', ''),
           unidade = nullif(p_dados->>'unidade', ''), meta = (p_dados->>'meta')::numeric,
           dias = v_dias, periodo = coalesce(p_dados->>'periodo', 'diurno'), responsavel_id = v_resp
     where id = p_id and semana_id = p_semana_id
    returning id into v_id;
    if v_id is null then
      raise exception 'nao_encontrada' using errcode = 'P0001';
    end if;
    delete from public.programacao_efetivo where programacao_atividade_id = v_id;
  end if;
  insert into public.programacao_efetivo (programacao_atividade_id, funcao, quantidade)
  select v_id, e->>'funcao', (e->>'quantidade')::integer
    from jsonb_array_elements(coalesce(p_dados->'equipe', '[]'::jsonb)) e;
  return v_id;
end;
$$;

create or replace function public.foto_semana(p_semana_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'semana', jsonb_build_object('id', s.id, 'obra_id', s.obra_id, 'inicio', s.inicio, 'status', s.status,
      'programada_em', s.programada_em, 'encerrada_em', s.encerrada_em, 'motivo_reabertura', s.motivo_reabertura),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'ordem', pa.ordem,
        'descricao', pa.descricao, 'local', pa.local, 'unidade', pa.unidade, 'meta', pa.meta,
        'dias', to_jsonb(pa.dias), 'periodo', pa.periodo, 'causa', pa.causa,
        'responsavel_id', pa.responsavel_id,
        'equipe', coalesce((select jsonb_agg(jsonb_build_object('funcao', pe.funcao, 'quantidade', pe.quantidade)
                                             order by pe.created_at, pe.id)
                            from public.programacao_efetivo pe where pe.programacao_atividade_id = pa.id), '[]'::jsonb))
        order by pa.ordem, pa.created_at)
      from public.programacao_atividades pa where pa.semana_id = s.id), '[]'::jsonb),
    'execucoes', coalesce((select jsonb_agg(jsonb_build_object('id', a.id,
        'programacao_atividade_id', a.programacao_atividade_id, 'turno_id', t.id, 'data', t.data,
        'periodo', t.periodo, 'status_turno', t.status, 'qtd_planejada', a.qtd_planejada,
        'qtd_realizada', a.qtd_realizada, 'causa', a.causa)
        order by t.data, t.periodo, a.ordem, a.created_at)
      from public.atividades a
      join public.turnos t on t.id = a.turno_id
      join public.programacao_atividades pa on pa.id = a.programacao_atividade_id
      where pa.semana_id = s.id), '[]'::jsonb),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'data', t.data, 'periodo', t.periodo,
        'status', t.status, 'hora_inicio_prevista', t.hora_inicio_prevista, 'hora_fim_prevista', t.hora_fim_prevista,
        'hora_inicio_real', t.hora_inicio_real, 'hora_fim_real', t.hora_fim_real,
        'efetivo', coalesce((select jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade)
                                              order by e.created_at, e.id)
                             from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'descricao', a.descricao,
                                              'unidade', a.unidade, 'qtd_planejada', a.qtd_planejada,
                                              'qtd_realizada', a.qtd_realizada) order by a.ordem, a.created_at)
                            from public.atividades a
                            where a.turno_id = t.id and a.programacao_atividade_id is null), '[]'::jsonb))
        order by t.data, t.periodo)
      from public.turnos t where t.obra_id = s.obra_id and t.data between s.inicio and s.inicio + 6), '[]'::jsonb))
  from public.semanas s where s.id = p_semana_id;
$$;
