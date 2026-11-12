-- Programacao semanal (ajuste da revisao): no rascunho reaberto, mudar dias/periodo de uma atividade
-- programada nao pode deixar de fora turnos que ja a executaram (a ligacao ficaria incoerente:
-- realizado contaria na meta e previsto x real cairia em outros dias).
create or replace function public.tg_programacao_dias_com_execucao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.atividades a
      join public.turnos t on t.id = a.turno_id
      join public.semanas s on s.id = new.semana_id
     where a.programacao_atividade_id = new.id
       and not ((t.data - s.inicio)::smallint = any (new.dias) and t.periodo = new.periodo)
  ) then
    raise exception 'programacao_incompativel' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists programacao_atividades_dias_com_execucao on public.programacao_atividades;
create trigger programacao_atividades_dias_com_execucao
  before update of dias, periodo on public.programacao_atividades
  for each row execute function public.tg_programacao_dias_com_execucao();
