-- Item 10: quem alterou por último (atividade e efetivo).
-- atividades: lancado_por_id (responsável) já existe; lancado_em marca a hora. lancado_em preenchido
-- com lancado_por_id nulo = alterado pelo planejador.
alter table public.atividades add column if not exists lancado_em timestamptz;

-- efetivo: linhas são recriadas a cada salvamento (created_at = hora); marca se foi o planejador.
alter table public.efetivo add column if not exists lancado_pelo_planejador boolean not null default false;

drop function if exists public.substituir_efetivo(uuid, uuid, jsonb, jsonb);

create or replace function public.substituir_efetivo(
  p_turno_id uuid, p_responsavel_id uuid, p_esperado jsonb, p_linhas jsonb, p_pelo_planejador boolean default false)
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
  insert into public.efetivo (turno_id, funcao, quantidade, responsavel_id, lancado_pelo_planejador)
  select p_turno_id, l.x ->> 'funcao', (l.x ->> 'quantidade')::integer, p_responsavel_id, coalesce(p_pelo_planejador, false)
    from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) with ordinality as l(x, n)
   order by l.n;
end;
$$;
revoke all on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb, boolean) from public;
revoke all on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb, boolean) from anon;
grant execute on function public.substituir_efetivo(uuid, uuid, jsonb, jsonb, boolean) to authenticated, service_role;
