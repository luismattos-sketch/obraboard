create or replace function public.salvar_cadastro_base_atual(p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_papel text;
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
