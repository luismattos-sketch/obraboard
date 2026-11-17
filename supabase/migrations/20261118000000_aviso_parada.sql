-- Aviso de parada e "Terminei minha parte" (backlog item 6). Spec: docs/superpowers/specs/2026-11-16-aviso-parada-design.md
-- Parada = ocorrencia 'parado' do item 4, agora podendo ficar aberta (hora_fim nula), com observacao,
-- equipe aguardada e foto (bucket privado 'paradas', acesso so pelo servidor).

-- 1. Parada aberta, observacao, equipe aguardada, foto e hora do aviso.
alter table public.efetivo_ocorrencias
  add column observacao text check (observacao is null or length(observacao) <= 500),
  add column aguardando_responsavel_id uuid references public.responsaveis(id) on delete set null,
  add column foto_path text,
  add column avisado_em timestamptz not null default now();

alter table public.efetivo_ocorrencias drop constraint efetivo_ocorrencias_por_tipo;
alter table public.efetivo_ocorrencias add constraint efetivo_ocorrencias_por_tipo check (
  (tipo = 'emprestimo' and destino_responsavel_id is not null and emprestimo_id is null and causa is null
     and destino_responsavel_id is distinct from responsavel_id)
  or (tipo = 'saida' and hora_fim is null and destino_responsavel_id is null and causa is null)
  or (tipo = 'parado' and causa is not null and destino_responsavel_id is null)
);
alter table public.efetivo_ocorrencias add constraint efetivo_ocorrencias_extras_so_parado check (
  tipo = 'parado' or (observacao is null and aguardando_responsavel_id is null and foto_path is null)
);
alter table public.efetivo_ocorrencias add constraint efetivo_ocorrencias_aguardando_causa check (
  aguardando_responsavel_id is null or causa = 'atividade_predecessora'
);
create index efetivo_ocorrencias_aguardando_idx on public.efetivo_ocorrencias (aguardando_responsavel_id);

-- Responsavel, destino e equipe aguardada da mesma obra do turno.
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

drop trigger efetivo_ocorrencias_responsavel_obra on public.efetivo_ocorrencias;
create trigger efetivo_ocorrencias_responsavel_obra
  before insert or update of responsavel_id, destino_responsavel_id, aguardando_responsavel_id on public.efetivo_ocorrencias
  for each row execute function public.tg_responsavel_mesma_obra();

-- 2. "Terminei minha parte" por equipe e turno.
create table public.turno_equipes_terminadas (
  turno_id uuid not null references public.turnos(id) on delete cascade,
  responsavel_id uuid not null references public.responsaveis(id) on delete cascade,
  terminou_em time not null,
  created_at timestamptz not null default now(),
  primary key (turno_id, responsavel_id)
);
create index turno_equipes_terminadas_responsavel_idx on public.turno_equipes_terminadas (responsavel_id);
create trigger turno_equipes_terminadas_bloquear_fechado before insert or update or delete on public.turno_equipes_terminadas
  for each row execute function public.tg_bloquear_turno_fechado();
create trigger turno_equipes_terminadas_responsavel_obra before insert or update on public.turno_equipes_terminadas
  for each row execute function public.tg_responsavel_mesma_obra();

alter table public.turno_equipes_terminadas enable row level security;
revoke all on public.turno_equipes_terminadas from anon, authenticated;
grant select, insert, update, delete on public.turno_equipes_terminadas to authenticated;
grant all on public.turno_equipes_terminadas to service_role;
create policy turno_equipes_terminadas_all on public.turno_equipes_terminadas
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = turno_equipes_terminadas.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = turno_equipes_terminadas.turno_id and public.eh_membro(o.empresa_id)));

-- 3. WhatsApp do planejador (so digitos, com DDI).
alter table public.obras
  add column whatsapp_planejador text check (whatsapp_planejador is null or whatsapp_planejador ~ '^[0-9]{10,15}$');

-- 4. Fotos das paradas: bucket privado; sem policies para anon/authenticated (so service_role, pelo servidor).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paradas', 'paradas', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- 5. Fotos oficiais (RDO, check-in, semana) passam a guardar os novos campos e as equipes que terminaram.
create or replace function public.terminados_json(p_turno_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('responsavel_id', x.responsavel_id, 'terminou_em', x.terminou_em)
                            order by x.terminou_em, x.responsavel_id), '[]'::jsonb)
  from public.turno_equipes_terminadas x where x.turno_id = p_turno_id;
$$;
revoke all on function public.terminados_json(uuid) from public;
revoke all on function public.terminados_json(uuid) from anon, authenticated;
grant execute on function public.terminados_json(uuid) to service_role;

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
      'causa', x.causa, 'observacao', x.observacao,
      'aguardando_responsavel_id', x.aguardando_responsavel_id, 'foto_path', x.foto_path, 'avisado_em', x.avisado_em,
      'created_at', x.created_at) order by x.created_at, x.id), '[]'::jsonb)
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
        'programada', a.programacao_atividade_id is not null, 'responsavel_id', a.responsavel_id)
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
    'terminados', public.terminados_json(t.id),
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
