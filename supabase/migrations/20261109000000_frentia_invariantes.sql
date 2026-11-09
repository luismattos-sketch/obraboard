-- Frentia: invariantes no banco (rodar uma vez no SQL Editor, depois de 20261108000000_frentia_schema.sql).
-- Erros de negocio sobem como P0001 com mensagem fixa; a camada lib/db traduz:
--   turno_fechado    -> "Turno fechado: reabra para editar" / "Este turno não está aberto para lançamentos."
--   causa_pendente   -> "Há atividades sem causa informada"
--   efetivo_conflito -> "O efetivo foi alterado por outra pessoa. Recarregue a página."

-- 1. Filhos (atividades, efetivo, clima) de turno fechado sao imutaveis.
create or replace function public.tg_bloquear_turno_fechado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Excecao: o ON DELETE SET NULL de origem_id (atividade de origem removida em outro turno)
  -- so zera o vinculo; nao e uma edicao do turno fechado.
  if tg_op = 'UPDATE' and tg_table_name = 'atividades' then
    if new.origem_id is null and old.origem_id is not null
       and (to_jsonb(new) - 'origem_id' - 'updated_at') = (to_jsonb(old) - 'origem_id' - 'updated_at') then
      return new;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    -- Em cascata (turno/obra apagados) o turno pai ja nao existe: nada a bloquear.
    if exists (select 1 from public.turnos t where t.id = old.turno_id and t.status = 'fechado') then
      raise exception 'turno_fechado' using errcode = 'P0001';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if exists (select 1 from public.turnos t where t.id = new.turno_id and t.status = 'fechado') then
      raise exception 'turno_fechado' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger atividades_bloquear_fechado before insert or update or delete on public.atividades
  for each row execute function public.tg_bloquear_turno_fechado();
create trigger efetivo_bloquear_fechado before insert or update or delete on public.efetivo
  for each row execute function public.tg_bloquear_turno_fechado();
create trigger clima_bloquear_fechado before insert or update or delete on public.clima
  for each row execute function public.tg_bloquear_turno_fechado();

-- 2. Turno fechado: dados do turno imutaveis (token_hash/updated_at liberados; reabrir fechado -> enviado liberado).
create or replace function public.tg_turno_fechado_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'fechado' and new.status = 'fechado' and (
       new.obra_id is distinct from old.obra_id
    or new.data is distinct from old.data
    or new.periodo is distinct from old.periodo
    or new.hora_inicio_prevista is distinct from old.hora_inicio_prevista
    or new.hora_fim_prevista is distinct from old.hora_fim_prevista
    or new.hora_inicio_real is distinct from old.hora_inicio_real
    or new.hora_fim_real is distinct from old.hora_fim_real
  ) then
    raise exception 'turno_fechado' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger turnos_fechado_imutavel before update on public.turnos
  for each row execute function public.tg_turno_fechado_imutavel();

-- 3. Enviar/fechar exige causa em toda atividade nao concluida (mesma regra de errosDeCausa).
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
        and (a.qtd_realizada is null or a.qtd_realizada < a.qtd_planejada)
        and (a.causa is null or (a.causa = 'outro' and coalesce(trim(a.observacao), '') = ''))
    ) then
      raise exception 'causa_pendente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger turnos_causa_pendente before update on public.turnos
  for each row execute function public.tg_turno_causa_pendente();

-- 4. Pendentes trazidos uma unica vez por turno.
create unique index atividades_turno_origem_uniq on public.atividades (turno_id, origem_id)
  where origem_id is not null;

-- 5. MVP: cada usuario pertence a exatamente uma empresa.
alter table public.membros add constraint membros_user_id_uniq unique (user_id);

-- 6. Redundante com unique (obra_id, data, periodo).
drop index if exists public.turnos_obra_id_idx;

-- 7. Substituicao atomica do efetivo com checagem otimista.
create or replace function public.substituir_efetivo(p_turno_id uuid, p_esperado jsonb, p_linhas jsonb)
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
   where e.turno_id = p_turno_id;

  select coalesce(jsonb_agg(jsonb_build_object('funcao', x ->> 'funcao', 'quantidade', (x ->> 'quantidade')::integer)
                            order by x ->> 'funcao', (x ->> 'quantidade')::integer), '[]'::jsonb)
    into v_esperado
    from jsonb_array_elements(coalesce(p_esperado, '[]'::jsonb)) as x;

  if v_atual is distinct from v_esperado then
    raise exception 'efetivo_conflito' using errcode = 'P0001';
  end if;

  delete from public.efetivo where turno_id = p_turno_id;
  insert into public.efetivo (turno_id, funcao, quantidade)
  select p_turno_id, l.x ->> 'funcao', (l.x ->> 'quantidade')::integer
    from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) with ordinality as l(x, n)
   order by l.n;
end;
$$;

revoke all on function public.substituir_efetivo(uuid, jsonb, jsonb) from public;
revoke all on function public.substituir_efetivo(uuid, jsonb, jsonb) from anon;
grant execute on function public.substituir_efetivo(uuid, jsonb, jsonb) to authenticated, service_role;
