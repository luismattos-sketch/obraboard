-- Item 1.6 (ajuste da revisao): apagar a atividade de origem (semana anterior reaberta) faz o
-- "on delete set null" atualizar a atividade trazida; com a semana seguinte programada ou encerrada,
-- a trava recusava isso. Agora a trava aceita esse UPDATE, que so zera trazida_de e nao muda mais nada.
--
-- Risco aceito (decisao de 2026-11-24): a excecao do "Atualizar meta" na semana programada confere
-- meta = saldo_trazido, mas os dois valores vem do app (o saldo e calculado no servidor do app, nao no
-- banco). Um membro da empresa poderia mudar a meta de uma atividade trazida sem reabrir a semana; esse
-- mesmo membro pode reabrir a semana, entao o efeito e so pular o motivo da reabertura.
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
    -- Origem apagada: o "on delete set null" so zera trazida_de (qualquer status da semana).
    if tg_op = 'UPDATE'
       and old.trazida_de is not null and new.trazida_de is null
       and (to_jsonb(new) - 'trazida_de' - 'updated_at') = (to_jsonb(old) - 'trazida_de' - 'updated_at') then
      return new;
    end if;
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
