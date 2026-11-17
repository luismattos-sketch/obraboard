-- Efetivo e HH corretos (backlog item 4): intervalo de refeicao por obra/turno e ocorrencias do efetivo
-- (emprestimo entre equipes, saida antes, parados). Spec: docs/superpowers/specs/2026-11-16-efetivo-hh-design.md

-- 1. Intervalo padrao da obra (janela de horario, nao duracao).
alter table public.obras
  add column intervalo_diurno_inicio time default '12:00',
  add column intervalo_diurno_fim time default '13:00',
  add column intervalo_noturno_inicio time default '00:00',
  add column intervalo_noturno_fim time default '01:00';
update public.obras set
  intervalo_diurno_inicio = '12:00', intervalo_diurno_fim = '13:00',
  intervalo_noturno_inicio = '00:00', intervalo_noturno_fim = '01:00';

-- 2. Intervalo gravado no turno (passado nao muda quando a obra muda). Nulo = sem intervalo.
alter table public.turnos
  add column intervalo_inicio time,
  add column intervalo_fim time;

-- Turnos fechados ficam sem intervalo (HH igual ao de antes); abertos recebem o padrao da obra.
update public.turnos t set
  intervalo_inicio = case when t.periodo = 'diurno' then o.intervalo_diurno_inicio else o.intervalo_noturno_inicio end,
  intervalo_fim = case when t.periodo = 'diurno' then o.intervalo_diurno_fim else o.intervalo_noturno_fim end
from public.obras o
where o.id = t.obra_id and t.status <> 'fechado';

create or replace function public.tg_turno_intervalo_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.intervalo_inicio is null and new.intervalo_fim is null then
    select case when new.periodo = 'diurno' then o.intervalo_diurno_inicio else o.intervalo_noturno_inicio end,
           case when new.periodo = 'diurno' then o.intervalo_diurno_fim else o.intervalo_noturno_fim end
      into new.intervalo_inicio, new.intervalo_fim
      from public.obras o where o.id = new.obra_id;
  end if;
  return new;
end;
$$;
revoke all on function public.tg_turno_intervalo_padrao() from public;
revoke all on function public.tg_turno_intervalo_padrao() from anon, authenticated;

create trigger turnos_intervalo_padrao before insert on public.turnos
  for each row execute function public.tg_turno_intervalo_padrao();

-- 3. Ocorrencias do efetivo.
create table public.efetivo_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  -- Equipe que registrou (origem; no caso de saida/parado sobre emprestimo, a equipe destino).
  responsavel_id uuid references public.responsaveis(id) on delete set null,
  funcao text not null check (length(trim(funcao)) between 1 and 80),
  tipo text not null check (tipo in ('emprestimo','saida','parado')),
  quantidade integer not null check (quantidade between 1 and 999),
  hora_inicio time not null,
  hora_fim time,
  destino_responsavel_id uuid references public.responsaveis(id) on delete cascade,
  emprestimo_id uuid references public.efetivo_ocorrencias(id) on delete cascade,
  causa text check (causa in (
    'material','mao_de_obra','equipamento','projeto_informacao','clima',
    'atividade_predecessora','liberacao_area','seguranca','outro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint efetivo_ocorrencias_por_tipo check (
    (tipo = 'emprestimo' and destino_responsavel_id is not null and emprestimo_id is null and causa is null
       and destino_responsavel_id is distinct from responsavel_id)
    or (tipo = 'saida' and hora_fim is null and destino_responsavel_id is null and causa is null)
    or (tipo = 'parado' and hora_fim is not null and causa is not null and destino_responsavel_id is null)
  )
);
create index efetivo_ocorrencias_turno_idx on public.efetivo_ocorrencias (turno_id);
create index efetivo_ocorrencias_emprestimo_idx on public.efetivo_ocorrencias (emprestimo_id);
create index efetivo_ocorrencias_responsavel_idx on public.efetivo_ocorrencias (responsavel_id);
create index efetivo_ocorrencias_destino_idx on public.efetivo_ocorrencias (destino_responsavel_id);

create trigger efetivo_ocorrencias_updated_at before update on public.efetivo_ocorrencias
  for each row execute function public.tg_atualizar_updated_at();
create trigger efetivo_ocorrencias_bloquear_fechado before insert or update or delete on public.efetivo_ocorrencias
  for each row execute function public.tg_bloquear_turno_fechado();

-- Responsavel e destino da mesma obra do turno (estende o gatilho existente).
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
  elsif tg_table_name = 'efetivo_ocorrencias' then
    select t.obra_id into v_obra from public.turnos t where t.id = new.turno_id;
    v_ids := array[new.responsavel_id, new.destino_responsavel_id];
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

create trigger efetivo_ocorrencias_responsavel_obra
  before insert or update of responsavel_id, destino_responsavel_id on public.efetivo_ocorrencias
  for each row execute function public.tg_responsavel_mesma_obra();

-- Saida/parado sobre emprestimo: so a equipe destino daquele emprestimo, no mesmo turno e funcao.
create or replace function public.tg_ocorrencia_emprestimo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai public.efetivo_ocorrencias%rowtype;
begin
  if new.emprestimo_id is null then
    return new;
  end if;
  select * into v_pai from public.efetivo_ocorrencias where id = new.emprestimo_id;
  if not found
     or v_pai.turno_id <> new.turno_id
     or v_pai.tipo <> 'emprestimo'
     or v_pai.destino_responsavel_id is distinct from new.responsavel_id
     or v_pai.funcao <> new.funcao
     or new.tipo not in ('saida','parado') then
    raise exception 'ocorrencia_invalida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.tg_ocorrencia_emprestimo() from public;
revoke all on function public.tg_ocorrencia_emprestimo() from anon, authenticated;

create trigger efetivo_ocorrencias_emprestimo before insert or update on public.efetivo_ocorrencias
  for each row execute function public.tg_ocorrencia_emprestimo();

alter table public.efetivo_ocorrencias enable row level security;
revoke all on public.efetivo_ocorrencias from anon, authenticated;
grant select, insert, update, delete on public.efetivo_ocorrencias to authenticated;
grant all on public.efetivo_ocorrencias to service_role;

create policy efetivo_ocorrencias_all on public.efetivo_ocorrencias
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = efetivo_ocorrencias.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = efetivo_ocorrencias.turno_id and public.eh_membro(o.empresa_id)));

-- 4. Fotos: RDO oficial, check-in e semana passam a guardar intervalo e ocorrencias.
create or replace function public.ocorrencias_json(p_turno_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'responsavel_id', x.responsavel_id,
      'funcao', x.funcao, 'tipo', x.tipo, 'quantidade', x.quantidade,
      'hora_inicio', x.hora_inicio, 'hora_fim', x.hora_fim,
      'destino_responsavel_id', x.destino_responsavel_id, 'emprestimo_id', x.emprestimo_id,
      'causa', x.causa, 'created_at', x.created_at) order by x.created_at, x.id), '[]'::jsonb)
  from public.efetivo_ocorrencias x where x.turno_id = p_turno_id;
$$;
revoke all on function public.ocorrencias_json(uuid) from public;
revoke all on function public.ocorrencias_json(uuid) from anon, authenticated;
grant execute on function public.ocorrencias_json(uuid) to service_role;

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
        'observacao', a.observacao, 'origem_id', a.origem_id) order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'funcao', e.funcao,
        'quantidade', e.quantidade, 'responsavel_id', e.responsavel_id) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'ocorrencias', public.ocorrencias_json(t.id),
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
                     union select x.destino_responsavel_id from public.efetivo_ocorrencias x where x.turno_id = t.id)), '[]'::jsonb),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'programada', a.programacao_atividade_id is not null, 'responsavel_id', a.responsavel_id)
        order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade,
        'responsavel_id', e.responsavel_id) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'ocorrencias', public.ocorrencias_json(t.id))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_checkin(uuid) from public;
revoke all on function public.foto_checkin(uuid) from anon, authenticated;
grant execute on function public.foto_checkin(uuid) to service_role;

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
        'intervalo_inicio', t.intervalo_inicio, 'intervalo_fim', t.intervalo_fim,
        'efetivo', coalesce((select jsonb_agg(jsonb_build_object('funcao', e.funcao, 'quantidade', e.quantidade,
                                              'responsavel_id', e.responsavel_id)
                                              order by e.created_at, e.id)
                             from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
        'ocorrencias', public.ocorrencias_json(t.id),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'descricao', a.descricao,
                                              'unidade', a.unidade, 'qtd_planejada', a.qtd_planejada,
                                              'qtd_realizada', a.qtd_realizada) order by a.ordem, a.created_at)
                            from public.atividades a
                            where a.turno_id = t.id and a.programacao_atividade_id is null), '[]'::jsonb))
        order by t.data, t.periodo)
      from public.turnos t where t.obra_id = s.obra_id and t.data between s.inicio and s.inicio + 6), '[]'::jsonb))
  from public.semanas s where s.id = p_semana_id;
$$;
