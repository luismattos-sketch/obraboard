-- Clima automatico: cidade da obra + clima do turno (Open-Meteo) gravado no enviar/fechar.

alter table public.obras
  add column local_nome text,
  add column latitude double precision,
  add column longitude double precision,
  add constraint obras_latitude_faixa check (latitude is null or latitude between -90 and 90),
  add constraint obras_longitude_faixa check (longitude is null or longitude between -180 and 180),
  add constraint obras_coordenadas_juntas check ((latitude is null) = (longitude is null));

create table public.clima_turno (
  turno_id uuid primary key references public.turnos(id) on delete cascade,
  temp_media numeric,
  temp_max numeric,
  temp_min numeric,
  chuva_mm numeric,
  choveu boolean,
  leituras jsonb not null,
  buscado_em timestamptz not null default now()
);

alter table public.clima_turno enable row level security;
revoke all on public.clima_turno from anon, authenticated;
grant select, insert, update, delete on public.clima_turno to authenticated;
grant all on public.clima_turno to service_role;

create policy clima_turno_all on public.clima_turno
  for all to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = clima_turno.turno_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                      where t.id = clima_turno.turno_id and public.eh_membro(o.empresa_id)));

create trigger clima_turno_bloquear_fechado before insert or update or delete on public.clima_turno
  for each row execute function public.tg_bloquear_turno_fechado();

-- Retrato do RDO: obra com local_nome; sai 'clima' (manual), entra 'clima_turno'.
create or replace function public.foto_rdo(p_turno_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'obra', (select jsonb_build_object('id', o.id, 'empresa_id', o.empresa_id, 'nome', o.nome,
                                       'cliente', o.cliente, 'endereco', o.endereco, 'local_nome', o.local_nome)
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
    'clima_turno', (select jsonb_build_object('temp_media', c.temp_media, 'temp_max', c.temp_max,
        'temp_min', c.temp_min, 'chuva_mm', c.chuva_mm, 'choveu', c.choveu, 'leituras', c.leituras)
      from public.clima_turno c where c.turno_id = t.id))
  from public.turnos t where t.id = p_turno_id;
$$;
