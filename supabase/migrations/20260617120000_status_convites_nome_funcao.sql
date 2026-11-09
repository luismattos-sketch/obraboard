create or replace function public.listar_status_convites_acesso()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'email', c.email,
    'nome', c.nome,
    'funcao', c.funcao,
    'nivelAcesso', c.nivel_acesso,
    'ativo', c.accepted_user_id is not null
  ) order by c.email), '[]'::jsonb)
  from public.empresa_convites_acesso c
  where c.active = true
    and c.nivel_acesso in ('Planejador', 'Visitante')
    and c.empresa_id in (select public.usuario_empresa_ids())
$$;

revoke all on function public.listar_status_convites_acesso() from public;
grant execute on function public.listar_status_convites_acesso() to authenticated;
