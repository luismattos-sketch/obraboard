-- Historico de RDO H2: linha do tempo de marcos do turno e motivo obrigatorio ao reabrir.

alter table public.turnos add column motivo_reabertura text;

create table public.turno_eventos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  tipo text not null check (tipo in ('criado','liberado','novo_link','enviado','fechado','reaberto')),
  em timestamptz not null default now(),
  ator_tipo text not null check (ator_tipo in ('planejador','encarregado')),
  ator_nome text,
  versao integer,
  motivo text
);
create index turno_eventos_turno_em_idx on public.turno_eventos (turno_id, em);

-- RLS: somente leitura para membros da empresa da obra.
alter table public.turno_eventos enable row level security;
revoke all on public.turno_eventos from anon, authenticated;
grant select on public.turno_eventos to authenticated;
grant all on public.turno_eventos to service_role;

create policy turno_eventos_select on public.turno_eventos
  for select to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = turno_eventos.obra_id and public.eh_membro(o.empresa_id)));

-- Reabrir (sair de fechado) exige motivo de 3 a 500 caracteres.
create or replace function public.tg_exigir_motivo_reabertura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'fechado' and new.status <> 'fechado'
     and char_length(coalesce(btrim(new.motivo_reabertura), '')) not between 3 and 500 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger turnos_exigir_motivo before update of status on public.turnos
  for each row execute function public.tg_exigir_motivo_reabertura();

-- Registro dos marcos. Nome do gatilho de update ordena depois de turnos_emitir_rdo (a versao ja existe).
create or replace function public.tg_registrar_evento_turno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_ator_tipo text := 'planejador';
  v_ator_nome text;
  v_versao integer;
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'criado';
  elsif old.status = 'planejado' and new.status = 'em_campo' then
    v_tipo := 'liberado';
  elsif old.status = 'em_campo' and new.status = 'enviado' then
    v_tipo := 'enviado';
    v_ator_tipo := 'encarregado';
  elsif old.status <> 'fechado' and new.status = 'fechado' then
    v_tipo := 'fechado';
    select max(v.numero) into v_versao from public.rdo_versoes v where v.turno_id = new.id;
  elsif old.status = 'fechado' and new.status <> 'fechado' then
    v_tipo := 'reaberto';
    v_motivo := btrim(new.motivo_reabertura);
  elsif old.status = new.status and new.token_hash is distinct from old.token_hash and new.token_hash is not null then
    v_tipo := 'novo_link';
  else
    return null;
  end if;

  if v_ator_tipo = 'planejador' then
    select coalesce(nullif(btrim(u.raw_user_meta_data->>'nome'), ''), u.email)
      into v_ator_nome
      from auth.users u where u.id = auth.uid();
  end if;

  insert into public.turno_eventos (turno_id, obra_id, tipo, ator_tipo, ator_nome, versao, motivo)
  values (new.id, new.obra_id, v_tipo, v_ator_tipo, v_ator_nome, v_versao, v_motivo);
  return null;
end;
$$;
revoke all on function public.tg_registrar_evento_turno() from public;
revoke all on function public.tg_registrar_evento_turno() from anon, authenticated;

create trigger turnos_registrar_evento_criado after insert on public.turnos
  for each row execute function public.tg_registrar_evento_turno();
create trigger turnos_registrar_evento after update of status, token_hash on public.turnos
  for each row execute function public.tg_registrar_evento_turno();

-- Foto do RDO passa a levar o motivo da ultima reabertura (formato 1, campo opcional).
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
      'enviado_em', t.enviado_em, 'fechado_em', t.fechado_em,
      'motivo_reabertura', t.motivo_reabertura),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'observacao', a.observacao, 'origem_id', a.origem_id) order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'funcao', e.funcao,
        'quantidade', e.quantidade) order by e.created_at, e.id)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'clima', coalesce((select jsonb_agg(jsonb_build_object('periodo', c.periodo, 'condicao', c.condicao,
        'impediu', c.impediu) order by c.periodo)
      from public.clima c where c.turno_id = t.id), '[]'::jsonb))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_rdo(uuid) from public;
revoke all on function public.foto_rdo(uuid) from anon, authenticated;
grant execute on function public.foto_rdo(uuid) to service_role;
