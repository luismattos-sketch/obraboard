create or replace function public.salvar_cadastro_base_atual(p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_papel text;
  v_plan text;
  v_limite_frentes int;
  v_limite_planejadores int;
  v_limite_visitantes int;
  v_frentes_ativas int;
  v_planejadores int;
  v_visitantes int;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select eu.empresa_id, eu.papel
    into v_empresa_id, v_papel
  from public.empresa_usuarios eu
  where eu.user_id = auth.uid()
  order by eu.created_at
  limit 1;

  if v_empresa_id is null or v_papel not in ('owner', 'planejador') then
    raise exception 'permission denied';
  end if;

  select coalesce(e.plan, 'free')
    into v_plan
  from public.empresas e
  where e.id = v_empresa_id;

  v_limite_frentes := case
    when v_plan in ('free', 'trial', 'basic') then 1
    when v_plan = 'premium' then 3
    else null
  end;
  v_limite_planejadores := v_limite_frentes;
  v_limite_visitantes := v_limite_frentes;

  if v_limite_frentes is not null then
    select count(*)
      into v_frentes_ativas
    from jsonb_array_elements(coalesce(p_dados->'obras', '[]'::jsonb)) obra
    where coalesce(obra->>'situacao', '') <> 'Pausada';

    if v_frentes_ativas > v_limite_frentes then
      raise exception 'Limite do plano atingido: % frente(s) ativa(s).', v_limite_frentes;
    end if;
  end if;

  if v_limite_planejadores is not null then
    select count(distinct lower(coalesce(usuario->>'email', usuario->>'id')))
      into v_planejadores
    from jsonb_array_elements(coalesce(p_dados->'usuarios', '[]'::jsonb)) usuario
    where usuario->>'nivelAcesso' = 'Planejador';

    if v_planejadores > v_limite_planejadores then
      raise exception 'Limite do plano atingido: % planejador(es).', v_limite_planejadores;
    end if;
  end if;

  if v_limite_visitantes is not null then
    select count(distinct lower(coalesce(usuario->>'email', usuario->>'id')))
      into v_visitantes
    from jsonb_array_elements(coalesce(p_dados->'usuarios', '[]'::jsonb)) usuario
    where usuario->>'nivelAcesso' = 'Visitante';

    if v_visitantes > v_limite_visitantes then
      raise exception 'Limite do plano atingido: % visitante(s).', v_limite_visitantes;
    end if;
  end if;

  insert into public.cadastro_base(id, empresa_id, dados, updated_at)
  values (v_empresa_id::text || ':default', v_empresa_id, p_dados, now())
  on conflict (id) do update
  set empresa_id = excluded.empresa_id,
      dados = excluded.dados,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.salvar_cadastro_base_atual(jsonb) from public;
grant execute on function public.salvar_cadastro_base_atual(jsonb) to authenticated;
