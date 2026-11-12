-- Programacao semanal + efetivo previsto (bloco 2 revisado).
-- Semana (seg-dom) com atividades programadas (meta, dias, periodo, equipe prevista); turnos executam
-- a programacao via atividades.programacao_atividade_id. Regras no banco; foto oficial ao programar e
-- ao encerrar (dados de entrada; o app calcula PPC e previsto x real a partir dela).
-- Erros de negocio: P0001 com mensagem fixa (semana_travada, turno_aberto, causa_pendente,
-- programacao_vazia, atividade_com_execucao, programacao_incompativel, transicao_invalida,
-- motivo_obrigatorio, motivo_repetido).

-- 0. Dias da semana: 0 = segunda ... 6 = domingo; ao menos 1, sem repeticao.
create or replace function public.dias_validos(p smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p, 1), 0) >= 1
     and (select bool_and(d between 0 and 6) from unnest(p) d)
     and (select count(distinct d) = count(*) from unnest(p) d);
$$;

-- 1. Tabelas
create table public.semanas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  inicio date not null check (extract(isodow from inicio) = 1),
  status text not null default 'rascunho' check (status in ('rascunho','programada','encerrada')),
  programada_em timestamptz,
  encerrada_em timestamptz,
  motivo_reabertura text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obra_id, inicio)
);

create table public.programacao_atividades (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references public.semanas(id) on delete cascade,
  ordem integer not null default 0,
  descricao text not null,
  local text,
  unidade text,
  meta numeric not null check (meta > 0),
  dias smallint[] not null check (public.dias_validos(dias)),
  periodo text not null default 'diurno' check (periodo in ('diurno','noturno')),
  causa text check (causa in (
    'material','mao_de_obra','equipamento','projeto_informacao','clima',
    'atividade_predecessora','liberacao_area','seguranca','outro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programacao_efetivo (
  id uuid primary key default gen_random_uuid(),
  programacao_atividade_id uuid not null references public.programacao_atividades(id) on delete cascade,
  funcao text not null,
  quantidade integer not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK "no action" (verificada no fim do comando): o cascade de obra apaga turnos e semanas juntos.
-- O bloqueio de apagar atividade programada com execucao e feito por gatilho (item 6).
alter table public.atividades
  add column programacao_atividade_id uuid references public.programacao_atividades(id);

create table public.semana_versoes (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references public.semanas(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  numero integer not null check (numero > 0),
  evento text not null check (evento in ('programada','encerrada')),
  emitido_em timestamptz not null,
  formato integer not null default 1,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  unique (semana_id, numero)
);

create index programacao_atividades_semana_idx on public.programacao_atividades (semana_id);
create index programacao_efetivo_atividade_idx on public.programacao_efetivo (programacao_atividade_id);
create index atividades_programacao_idx on public.atividades (programacao_atividade_id);
create unique index atividades_turno_programacao_uniq on public.atividades (turno_id, programacao_atividade_id)
  where programacao_atividade_id is not null;
create index semana_versoes_obra_idx on public.semana_versoes (obra_id);

create trigger semanas_updated_at before update on public.semanas
  for each row execute function public.tg_atualizar_updated_at();
create trigger programacao_atividades_updated_at before update on public.programacao_atividades
  for each row execute function public.tg_atualizar_updated_at();
create trigger programacao_efetivo_updated_at before update on public.programacao_efetivo
  for each row execute function public.tg_atualizar_updated_at();

-- 2. Trava: semana programada/encerrada nao muda atividades nem equipe.
--    Programada aceita so a gravacao de causa (encerramento). Rascunho nao recebe causa nova.
--    Semana inexistente (cascade de obra/semana): nada a bloquear.
create or replace function public.tg_programacao_atividades_trava()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select s.status into v_status from public.semanas s where s.id = old.semana_id;
    if v_status = 'encerrada' then
      raise exception 'semana_travada' using errcode = 'P0001';
    end if;
    if v_status = 'programada' then
      if tg_op = 'DELETE'
         or (to_jsonb(new) - 'causa' - 'updated_at') <> (to_jsonb(old) - 'causa' - 'updated_at') then
        raise exception 'semana_travada' using errcode = 'P0001';
      end if;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select s.status into v_status from public.semanas s where s.id = new.semana_id;
    if v_status = 'encerrada' or (tg_op = 'INSERT' and v_status = 'programada') then
      raise exception 'semana_travada' using errcode = 'P0001';
    end if;
    if v_status = 'rascunho' and new.causa is not null
       and (tg_op = 'INSERT' or new.causa is distinct from old.causa) then
      raise exception 'semana_travada' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger programacao_atividades_trava before insert or update or delete on public.programacao_atividades
  for each row execute function public.tg_programacao_atividades_trava();

create or replace function public.tg_programacao_efetivo_trava()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if exists (select 1 from public.programacao_atividades pa join public.semanas s on s.id = pa.semana_id
               where pa.id = old.programacao_atividade_id and s.status <> 'rascunho') then
      raise exception 'semana_travada' using errcode = 'P0001';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if exists (select 1 from public.programacao_atividades pa join public.semanas s on s.id = pa.semana_id
               where pa.id = new.programacao_atividade_id and s.status <> 'rascunho') then
      raise exception 'semana_travada' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger programacao_efetivo_trava before insert or update or delete on public.programacao_efetivo
  for each row execute function public.tg_programacao_efetivo_trava();

-- 3. Apagar atividade programada que ja tem execucao em turno (fora de cascade).
create or replace function public.tg_programacao_atividades_com_execucao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.semanas s where s.id = old.semana_id)
     and exists (select 1 from public.atividades a where a.programacao_atividade_id = old.id) then
    raise exception 'atividade_com_execucao' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger programacao_atividades_com_execucao before delete on public.programacao_atividades
  for each row execute function public.tg_programacao_atividades_com_execucao();

-- 4. Transicoes da semana.
create or replace function public.tg_semanas_transicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if not ((old.status = 'rascunho' and new.status = 'programada')
       or (old.status = 'programada' and new.status = 'encerrada')
       or (old.status = 'programada' and new.status = 'rascunho')
       or (old.status = 'encerrada' and new.status = 'programada')) then
    raise exception 'transicao_invalida' using errcode = 'P0001';
  end if;

  if old.status = 'rascunho' then
    if not exists (select 1 from public.programacao_atividades pa where pa.semana_id = new.id) then
      raise exception 'programacao_vazia' using errcode = 'P0001';
    end if;
    new.programada_em := now();
    return new;
  end if;

  if new.status = 'encerrada' then
    if exists (select 1 from public.turnos t
               where t.obra_id = new.obra_id and t.data between new.inicio and new.inicio + 6
                 and t.status <> 'fechado') then
      raise exception 'turno_aberto' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.programacao_atividades pa
               where pa.semana_id = new.id and pa.causa is null
                 and coalesce((select sum(a.qtd_realizada) from public.atividades a
                               where a.programacao_atividade_id = pa.id), 0) < pa.meta) then
      raise exception 'causa_pendente' using errcode = 'P0001';
    end if;
    new.encerrada_em := now();
    return new;
  end if;

  -- Reaberturas: motivo obrigatorio e diferente do anterior (mesma regra do turno).
  if char_length(coalesce(btrim(new.motivo_reabertura), '')) not between 3 and 500 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  if old.motivo_reabertura is not null
     and btrim(new.motivo_reabertura) = btrim(old.motivo_reabertura) then
    raise exception 'motivo_repetido' using errcode = 'P0001';
  end if;
  new.motivo_reabertura := btrim(new.motivo_reabertura);
  if new.status = 'rascunho' then
    new.programada_em := null;
  else
    new.encerrada_em := null;
  end if;
  return new;
end;
$$;

create trigger semanas_transicao before update on public.semanas
  for each row execute function public.tg_semanas_transicao();

-- 5. Ligacao turno <-> atividade programada: mesma obra, dia marcado da semana, mesmo periodo.
create or replace function public.tg_atividades_programacao_compativel()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if new.programacao_atividade_id is null then
    return new;
  end if;
  select (t.obra_id = s.obra_id
          and t.data between s.inicio and s.inicio + 6
          and (t.data - s.inicio)::smallint = any (pa.dias)
          and t.periodo = pa.periodo)
    into v_ok
    from public.programacao_atividades pa
    join public.semanas s on s.id = pa.semana_id
    join public.turnos t on t.id = new.turno_id
   where pa.id = new.programacao_atividade_id;
  if v_ok is not true then
    raise exception 'programacao_incompativel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger atividades_programacao_compativel
  before insert or update of programacao_atividade_id, turno_id on public.atividades
  for each row execute function public.tg_atividades_programacao_compativel();

-- 6. Turno com atividade programada nao muda de obra, data ou periodo.
create or replace function public.tg_turnos_programacao_fixa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.obra_id is distinct from old.obra_id or new.data is distinct from old.data
      or new.periodo is distinct from old.periodo)
     and exists (select 1 from public.atividades a
                 where a.turno_id = new.id and a.programacao_atividade_id is not null) then
    raise exception 'programacao_incompativel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger turnos_programacao_fixa before update on public.turnos
  for each row execute function public.tg_turnos_programacao_fixa();

-- 7. Foto oficial da semana (dados de entrada; formato 1).
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
revoke all on function public.foto_semana(uuid) from public;
revoke all on function public.foto_semana(uuid) from anon, authenticated;
grant execute on function public.foto_semana(uuid) to service_role;

create or replace function public.tg_emitir_semana_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.semana_versoes (semana_id, obra_id, numero, evento, emitido_em, dados)
  values (
    new.id,
    new.obra_id,
    coalesce((select max(v.numero) from public.semana_versoes v where v.semana_id = new.id), 0) + 1,
    new.status,
    now(),
    public.foto_semana(new.id)
  );
  return null;
end;
$$;
revoke all on function public.tg_emitir_semana_versao() from public;
revoke all on function public.tg_emitir_semana_versao() from anon, authenticated;

create trigger semanas_emitir_versao after update of status on public.semanas
  for each row
  when (old.status is distinct from new.status and new.status in ('programada', 'encerrada'))
  execute function public.tg_emitir_semana_versao();

-- 8. Gravar atividade programada + equipe numa transacao (insert se p_id nulo).
create or replace function public.salvar_programacao_atividade(p_semana_id uuid, p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_dias smallint[] := (select coalesce(array_agg(x::smallint), '{}')
                        from jsonb_array_elements_text(coalesce(p_dados->'dias', '[]'::jsonb)) x);
begin
  if p_id is null then
    insert into public.programacao_atividades (semana_id, ordem, descricao, local, unidade, meta, dias, periodo)
    values (
      p_semana_id,
      coalesce((select max(pa.ordem) + 1 from public.programacao_atividades pa where pa.semana_id = p_semana_id), 0),
      p_dados->>'descricao', nullif(p_dados->>'local', ''), nullif(p_dados->>'unidade', ''),
      (p_dados->>'meta')::numeric, v_dias, coalesce(p_dados->>'periodo', 'diurno'))
    returning id into v_id;
  else
    update public.programacao_atividades
       set descricao = p_dados->>'descricao', local = nullif(p_dados->>'local', ''),
           unidade = nullif(p_dados->>'unidade', ''), meta = (p_dados->>'meta')::numeric,
           dias = v_dias, periodo = coalesce(p_dados->>'periodo', 'diurno')
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
revoke all on function public.salvar_programacao_atividade(uuid, uuid, jsonb) from public;
revoke all on function public.salvar_programacao_atividade(uuid, uuid, jsonb) from anon;
grant execute on function public.salvar_programacao_atividade(uuid, uuid, jsonb) to authenticated, service_role;

-- 9. Encerrar: grava as causas e muda o status na mesma transacao.
--    p_causas = { "<programacao_atividade_id>": "<causa>" }
create or replace function public.encerrar_semana(p_semana_id uuid, p_causas jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.semanas s where s.id = p_semana_id and s.status = 'programada') then
    raise exception 'transicao_invalida' using errcode = 'P0001';
  end if;
  update public.programacao_atividades pa
     set causa = c.value
    from jsonb_each_text(coalesce(p_causas, '{}'::jsonb)) c
   where pa.semana_id = p_semana_id and pa.id = c.key::uuid;
  update public.semanas set status = 'encerrada' where id = p_semana_id;
end;
$$;
revoke all on function public.encerrar_semana(uuid, jsonb) from public;
revoke all on function public.encerrar_semana(uuid, jsonb) from anon;
grant execute on function public.encerrar_semana(uuid, jsonb) to authenticated, service_role;

-- 10. RLS
alter table public.semanas enable row level security;
alter table public.programacao_atividades enable row level security;
alter table public.programacao_efetivo enable row level security;
alter table public.semana_versoes enable row level security;

revoke all on public.semanas, public.programacao_atividades, public.programacao_efetivo, public.semana_versoes
  from anon, authenticated;
grant select, insert, update, delete on public.semanas, public.programacao_atividades, public.programacao_efetivo
  to authenticated;
grant select on public.semana_versoes to authenticated;
grant all on public.semanas, public.programacao_atividades, public.programacao_efetivo, public.semana_versoes
  to service_role;

create policy semanas_all on public.semanas
  for all to authenticated
  using (exists (select 1 from public.obras o where o.id = semanas.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o where o.id = semanas.obra_id and public.eh_membro(o.empresa_id)));

create policy programacao_atividades_all on public.programacao_atividades
  for all to authenticated
  using (exists (select 1 from public.semanas s join public.obras o on o.id = s.obra_id
                 where s.id = programacao_atividades.semana_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.semanas s join public.obras o on o.id = s.obra_id
                      where s.id = programacao_atividades.semana_id and public.eh_membro(o.empresa_id)));

create policy programacao_efetivo_all on public.programacao_efetivo
  for all to authenticated
  using (exists (select 1 from public.programacao_atividades pa join public.semanas s on s.id = pa.semana_id
                 join public.obras o on o.id = s.obra_id
                 where pa.id = programacao_efetivo.programacao_atividade_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.programacao_atividades pa join public.semanas s on s.id = pa.semana_id
                      join public.obras o on o.id = s.obra_id
                      where pa.id = programacao_efetivo.programacao_atividade_id and public.eh_membro(o.empresa_id)));

create policy semana_versoes_select on public.semana_versoes
  for select to authenticated
  using (exists (select 1 from public.obras o where o.id = semana_versoes.obra_id and public.eh_membro(o.empresa_id)));
