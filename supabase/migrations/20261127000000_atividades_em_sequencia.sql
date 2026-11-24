-- Item 19: atividades em sequencia ("Continua de..."). O saldo de um turno passa para o proximo turno
-- da sequencia (mesma semana). Vinculo opcional; a regra da meta fica no app (lib/dominio/sequencia.ts).
alter table public.programacao_atividades
  add column continua_de uuid references public.programacao_atividades(id) on delete set null;
create index programacao_atividades_continua_de_idx on public.programacao_atividades (continua_de);

-- Vinculo so com atividade da mesma semana e sem apontar para si mesma.
create or replace function public.tg_programacao_continua_de()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.continua_de is null then
    return new;
  end if;
  if new.continua_de = new.id
     or not exists (select 1 from public.programacao_atividades pa
                    where pa.id = new.continua_de and pa.semana_id = new.semana_id) then
    raise exception 'sequencia_invalida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger programacao_continua_de before insert or update of continua_de, semana_id on public.programacao_atividades
  for each row execute function public.tg_programacao_continua_de();

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
    insert into public.programacao_atividades (semana_id, ordem, descricao, local, unidade, meta, dias, periodo, responsavel_id, continua_de)
    values (
      p_semana_id,
      coalesce((select max(pa.ordem) + 1 from public.programacao_atividades pa where pa.semana_id = p_semana_id), 0),
      p_dados->>'descricao', nullif(p_dados->>'local', ''), nullif(p_dados->>'unidade', ''),
      (p_dados->>'meta')::numeric, v_dias, coalesce(p_dados->>'periodo', 'diurno'), v_resp,
      nullif(p_dados->>'continua_de', '')::uuid)
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
        'responsavel_id', pa.responsavel_id, 'continua_de', pa.continua_de,
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

-- Origem da meta herdada no turno ("inclui 4 m do turno do dia (Luis)"); gravada pelo app ao trazer/reajustar.
alter table public.atividades
  add column meta_origem text check (meta_origem is null or char_length(meta_origem) <= 200);
