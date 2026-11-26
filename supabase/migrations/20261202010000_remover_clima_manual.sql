-- Clima automatico no ar: o clima manual (manha/tarde/noite) sai do app.
-- foto_rdo ja nao le public.clima (20261202000000). As fotos antigas guardam o clima manual no jsonb.
drop table public.clima;

-- O ramo 'clima' do gatilho de responsavel deixa de existir.
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
    v_ids := array[new.responsavel_id, new.lancado_por_id, new.criada_por_id];
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
