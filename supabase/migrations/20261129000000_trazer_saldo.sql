-- Item 1.6: atividade nao concluida volta para a programacao seguinte. A atividade trazida guarda a origem
-- (atividade da semana anterior da mesma obra) e o saldo no momento em que foi trazida. A regra do saldo
-- fica no app (lib/dominio/trazerSaldo.ts).
alter table public.programacao_atividades
  add column trazida_de uuid references public.programacao_atividades(id) on delete set null,
  add column saldo_trazido numeric check (saldo_trazido is null or saldo_trazido >= 0);
create unique index programacao_atividades_trazida_uniq
  on public.programacao_atividades (semana_id, trazida_de) where trazida_de is not null;

-- Origem so da semana imediatamente anterior (segunda - 7 dias) da mesma obra.
create or replace function public.tg_programacao_trazida_de()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trazida_de is null then
    return new;
  end if;
  if not exists (
    select 1
      from public.programacao_atividades pa
      join public.semanas so on so.id = pa.semana_id
      join public.semanas sn on sn.id = new.semana_id
     where pa.id = new.trazida_de and so.obra_id = sn.obra_id and so.inicio = sn.inicio - 7
  ) then
    raise exception 'trazida_invalida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger programacao_trazida_de before insert or update of trazida_de, semana_id on public.programacao_atividades
  for each row execute function public.tg_programacao_trazida_de();

-- Trava da semana: igual a de 20261111000000, com uma excecao na semana programada ("Atualizar meta"):
-- atividade trazida pode trocar so meta e saldo_trazido (meta = saldo_trazido) enquanto nao entrou em turno.
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
      if tg_op = 'UPDATE'
         and old.trazida_de is not null
         and new.meta = new.saldo_trazido
         and (to_jsonb(new) - 'causa' - 'updated_at' - 'meta' - 'saldo_trazido')
             = (to_jsonb(old) - 'causa' - 'updated_at' - 'meta' - 'saldo_trazido')
         and (new.meta is distinct from old.meta or new.saldo_trazido is distinct from old.saldo_trazido) then
        if exists (select 1 from public.atividades a where a.programacao_atividade_id = old.id) then
          raise exception 'meta_trazida_travada' using errcode = 'P0001';
        end if;
      elsif tg_op = 'DELETE'
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

-- Inclusao grava trazida_de/saldo_trazido; edicao nao mexe neles (igual ao continua_de).
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
    insert into public.programacao_atividades
      (semana_id, ordem, descricao, local, unidade, meta, dias, periodo, responsavel_id, continua_de, trazida_de, saldo_trazido)
    values (
      p_semana_id,
      coalesce((select max(pa.ordem) + 1 from public.programacao_atividades pa where pa.semana_id = p_semana_id), 0),
      p_dados->>'descricao', nullif(p_dados->>'local', ''), nullif(p_dados->>'unidade', ''),
      (p_dados->>'meta')::numeric, v_dias, coalesce(p_dados->>'periodo', 'diurno'), v_resp,
      nullif(p_dados->>'continua_de', '')::uuid,
      nullif(p_dados->>'trazida_de', '')::uuid,
      nullif(p_dados->>'saldo_trazido', '')::numeric)
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
