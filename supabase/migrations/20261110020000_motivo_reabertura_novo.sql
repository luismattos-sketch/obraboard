-- Historico de RDO H2 (ajuste): cada reabertura exige um motivo NOVO.
-- motivo_reabertura nao e limpo ao fechar (a foto do RDO seguinte o le); sem esta regra, uma 2a
-- reabertura que nao informasse motivo herdaria o da reabertura anterior.
create or replace function public.tg_exigir_motivo_reabertura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'fechado' and new.status <> 'fechado' then
    if char_length(coalesce(btrim(new.motivo_reabertura), '')) not between 3 and 500 then
      raise exception 'motivo_obrigatorio' using errcode = 'P0001';
    end if;
    if old.motivo_reabertura is not null
       and btrim(new.motivo_reabertura) = btrim(old.motivo_reabertura) then
      raise exception 'motivo_repetido' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
