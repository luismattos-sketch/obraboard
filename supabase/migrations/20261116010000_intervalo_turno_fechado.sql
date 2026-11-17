-- Turno fechado: o intervalo de refeicao (que entra no HH) tambem fica imutavel no banco.
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
    or new.intervalo_inicio is distinct from old.intervalo_inicio
    or new.intervalo_fim is distinct from old.intervalo_fim
  ) then
    raise exception 'turno_fechado' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
