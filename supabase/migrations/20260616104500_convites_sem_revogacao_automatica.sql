create or replace function public.sincronizar_convites_usuarios(p_usuarios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_papel text;
  v_item jsonb;
  v_email text;
  v_nivel text;
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

  for v_item in select * from jsonb_array_elements(coalesce(p_usuarios, '[]'::jsonb))
  loop
    v_email := lower(trim(coalesce(v_item->>'email', '')));
    v_nivel := coalesce(v_item->>'nivelAcesso', 'Usuario');

    if v_email <> '' and v_nivel in ('Planejador', 'Usuario', 'Visitante') then
      insert into public.empresa_convites_acesso(
        empresa_id,
        email,
        nome,
        funcao,
        nivel_acesso,
        active,
        created_by,
        updated_at
      )
      values (
        v_empresa_id,
        v_email,
        coalesce(v_item->>'nome', ''),
        coalesce(v_item->>'funcao', ''),
        v_nivel,
        true,
        auth.uid(),
        now()
      )
      on conflict (empresa_id, lower(email)) do update
      set nome = excluded.nome,
          funcao = excluded.funcao,
          nivel_acesso = excluded.nivel_acesso,
          active = true,
          updated_at = now();
    end if;
  end loop;

  update public.empresa_usuarios eu
  set papel = public.papel_por_nivel_acesso(c.nivel_acesso)
  from public.empresa_convites_acesso c
  where c.empresa_id = eu.empresa_id
    and c.accepted_user_id = eu.user_id
    and c.empresa_id = v_empresa_id
    and c.active = true
    and eu.papel <> 'owner';
end;
$$;

revoke all on function public.sincronizar_convites_usuarios(jsonb) from public;
grant execute on function public.sincronizar_convites_usuarios(jsonb) to authenticated;
