-- Historico de RDO H1: versoes oficiais imutaveis, emitidas ao fechar o turno.
-- A foto (formato 1) congela os dados de entrada do RDO; o app so le.

create table public.rdo_versoes (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  numero integer not null check (numero > 0),
  emitido_em timestamptz not null,
  retroativa boolean not null default false,
  formato integer not null default 1,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  unique (turno_id, numero)
);
create index rdo_versoes_obra_emitido_idx on public.rdo_versoes (obra_id, emitido_em desc);

-- Foto dos dados de entrada do RDO (sem token_hash).
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
      'enviado_em', t.enviado_em, 'fechado_em', t.fechado_em),
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

-- Emissao: roda depois das travas "before" e na mesma transacao do fechamento.
create or replace function public.tg_emitir_rdo_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rdo_versoes (turno_id, obra_id, numero, emitido_em, dados)
  values (
    new.id,
    new.obra_id,
    coalesce((select max(v.numero) from public.rdo_versoes v where v.turno_id = new.id), 0) + 1,
    coalesce(new.fechado_em, now()),
    public.foto_rdo(new.id)
  );
  return null;
end;
$$;
revoke all on function public.tg_emitir_rdo_versao() from public;
revoke all on function public.tg_emitir_rdo_versao() from anon, authenticated;

create trigger turnos_emitir_rdo after update of status on public.turnos
  for each row
  when (old.status is distinct from 'fechado' and new.status = 'fechado')
  execute function public.tg_emitir_rdo_versao();

-- RLS: somente leitura para membros da empresa da obra.
alter table public.rdo_versoes enable row level security;
revoke all on public.rdo_versoes from anon, authenticated;
grant select on public.rdo_versoes to authenticated;
grant all on public.rdo_versoes to service_role;

create policy rdo_versoes_select on public.rdo_versoes
  for select to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = rdo_versoes.obra_id and public.eh_membro(o.empresa_id)));

-- Retroativas: v1 para turnos ja fechados antes desta migration.
insert into public.rdo_versoes (turno_id, obra_id, numero, emitido_em, retroativa, dados)
select t.id, t.obra_id, 1, coalesce(t.fechado_em, t.updated_at), true, public.foto_rdo(t.id)
from public.turnos t
where t.status = 'fechado'
  and not exists (select 1 from public.rdo_versoes v where v.turno_id = t.id);
