-- Servico extra e adiantar atividade (backlog item 7). Spec: docs/superpowers/specs/2026-11-17-servico-extra-adiantar-design.md
-- tipo: null = atividade normal do dia; 'extra' = fora da programacao (planejado = executado);
-- 'adiantada' = atividade programada para dia futuro trazida para hoje. Nenhuma das duas exige causa ao fechar.

-- 1. Colunas novas.
alter table public.atividades
  add column tipo text check (tipo in ('extra', 'adiantada')),
  add column criada_por_id uuid references public.responsaveis(id) on delete set null,
  add column foto_path text;
create index atividades_criada_por_idx on public.atividades (criada_por_id);
alter table public.atividades add constraint atividades_tipo_programacao check (
  (tipo is distinct from 'adiantada' or programacao_atividade_id is not null)
  and (tipo is distinct from 'extra' or programacao_atividade_id is null)
);
alter table public.atividades add constraint atividades_foto_so_extra check (foto_path is null or tipo is not distinct from 'extra');

-- 2. Extra: sem meta; o planejado acompanha o executado e nunca tem causa.
create or replace function public.tg_atividade_extra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'extra' then
    if new.qtd_realizada is null or new.qtd_realizada <= 0 then
      raise exception 'extra_sem_quantidade' using errcode = 'P0001';
    end if;
    new.qtd_planejada := new.qtd_realizada;
    new.causa := null;
  end if;
  return new;
end;
$$;
create trigger atividades_extra before insert or update on public.atividades
  for each row execute function public.tg_atividade_extra();

-- 3. Enviar/fechar: extra e adiantada nao exigem causa.
create or replace function public.tg_turno_causa_pendente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('enviado', 'fechado') and old.status <> new.status then
    if exists (
      select 1 from public.atividades a
      where a.turno_id = new.id
        and a.tipo is null
        and (a.qtd_realizada is null or a.qtd_realizada < a.qtd_planejada)
        and (a.causa is null or (a.causa = 'outro' and coalesce(trim(a.observacao), '') = ''))
    ) then
      raise exception 'causa_pendente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- 4. Quem criou pelo campo: responsavel da mesma obra.
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

drop trigger atividades_responsavel_obra on public.atividades;
create trigger atividades_responsavel_obra
  before insert or update of responsavel_id, lancado_por_id, criada_por_id on public.atividades
  for each row execute function public.tg_responsavel_mesma_obra();

-- 5. Fotos oficiais (RDO e check-in) guardam o tipo e quem criou.
create or replace function public.foto_rdo(p_turno_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'obra', (select jsonb_build_object('id', o.id, 'empresa_id', o.empresa_id, 'nome', o.nome,
                                       'cliente', o.cliente, 'endereco', o.endereco)
             from public.obras o where o.id = t.obra_id),
    'turno', jsonb_build_object('id', t.id, 'obra_id', t.obra_id, 'data', t.data, 'periodo', t.periodo,
      'hora_inicio_prevista', t.hora_inicio_prevista, 'hora_fim_prevista', t.hora_fim_prevista,
      'hora_inicio_real', t.hora_inicio_real, 'hora_fim_real', t.hora_fim_real,
      'intervalo_inicio', t.intervalo_inicio, 'intervalo_fim', t.intervalo_fim,
      'enviado_em', t.enviado_em, 'fechado_em', t.fechado_em,
      'motivo_reabertura', t.motivo_reabertura),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'observacao', a.observacao, 'origem_id', a.origem_id, 'tipo', a.tipo, 'criada_por_id', a.criada_por_id) order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'funcao', e.funcao,
        'quantidade', e.quantidade, 'responsavel_id', e.responsavel_id) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'ocorrencias', public.ocorrencias_json(t.id),
    'terminados', public.terminados_json(t.id),
    'responsaveis', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome) order by r.nome)
      from public.responsaveis r where r.obra_id = t.obra_id), '[]'::jsonb),
    'clima', coalesce((select jsonb_agg(jsonb_build_object('periodo', c.periodo, 'condicao', c.condicao,
        'impediu', c.impediu) order by c.periodo)
      from public.clima c where c.turno_id = t.id), '[]'::jsonb))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_rdo(uuid) from public;
revoke all on function public.foto_rdo(uuid) from anon, authenticated;
grant execute on function public.foto_rdo(uuid) to service_role;

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
      'hora_inicio_real', t.hora_inicio_real, 'hora_fim_real', t.hora_fim_real,
      'intervalo_inicio', t.intervalo_inicio, 'intervalo_fim', t.intervalo_fim),
    'responsaveis', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'ativo', r.ativo)
                                               order by r.nome)
      from public.responsaveis r
      where r.id in (select a.responsavel_id from public.atividades a where a.turno_id = t.id
                     union select e.responsavel_id from public.efetivo e where e.turno_id = t.id
                     union select x.destino_responsavel_id from public.efetivo_ocorrencias x where x.turno_id = t.id
                     union select x.aguardando_responsavel_id from public.efetivo_ocorrencias x where x.turno_id = t.id
                     union select x.responsavel_id from public.turno_equipes_terminadas x where x.turno_id = t.id)), '[]'::jsonb),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'programada', a.programacao_atividade_id is not null, 'responsavel_id', a.responsavel_id,
        'tipo', a.tipo, 'criada_por_id', a.criada_por_id)
        order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade,
        'responsavel_id', e.responsavel_id) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'ocorrencias', public.ocorrencias_json(t.id),
    'terminados', public.terminados_json(t.id))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_checkin(uuid) from public;
revoke all on function public.foto_checkin(uuid) from anon, authenticated;
grant execute on function public.foto_checkin(uuid) to service_role;

-- 6. Ligacao com a programacao: alem do dia marcado, aceita adiantada (todos os dias marcados depois do
--    turno) e atrasada (atividade normal com algum dia marcado antes do turno). Mesma obra, semana e periodo.
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
          and t.periodo = pa.periodo
          and case
                when new.tipo = 'adiantada' then (t.data - s.inicio)::smallint < all (pa.dias)
                else (t.data - s.inicio)::smallint = any (pa.dias)
                     or (t.data - s.inicio)::smallint > any (pa.dias)
              end)
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

drop trigger atividades_programacao_compativel on public.atividades;
create trigger atividades_programacao_compativel
  before insert or update of programacao_atividade_id, turno_id, tipo on public.atividades
  for each row execute function public.tg_atividades_programacao_compativel();

-- 7. Atividade puxada da semana (adiantada ou atrasada): o planejador pode remover enquanto o turno nao fecha.
alter table public.atividades add column if not exists puxada boolean not null default false;

-- 8. Reabrir a semana e editar uma atividade com adiantada/atrasada puxada: aceita a adiantada em qualquer dia
--    e a atrasada puxada depois de algum dia marcado; as demais continuam presas aos dias marcados.
create or replace function public.tg_programacao_dias_com_execucao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.atividades a
      join public.turnos t on t.id = a.turno_id
      join public.semanas s on s.id = new.semana_id
     where a.programacao_atividade_id = new.id
       and not (t.periodo = new.periodo
                and (a.tipo is not distinct from 'adiantada'
                     or (t.data - s.inicio)::smallint = any (new.dias)
                     or (a.puxada and (t.data - s.inicio)::smallint > any (new.dias))))
  ) then
    raise exception 'programacao_incompativel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
