-- Restaura o cadastro seguro usado pela tela Campo a partir do token do QR Code.
-- A funcao retorna somente dados operacionais publicos e nunca expoe e-mail.

create or replace function public.campo_contexto_token(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'obra', jsonb_build_object(
      'id', o.id,
      'nome', o.nome,
      'codigo', o.codigo,
      'logo_url', o.logo_url
    ),
    'turno', jsonb_build_object(
      'id', t.id,
      'nome', coalesce(nullif(t.nome, ''), op.turno)
    ),
    'funcoes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'nome', f.nome,
          'quantidade', f.quantidade,
          'carga_horaria', f.carga_horaria
        )
        order by f.nome
      )
      from public.funcoes_previstas f
      where f.empresa_id = op.empresa_id
        and f.obra_id = op.obra_id
    ), '[]'::jsonb),
    'usuarios', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'nome', u.nome,
          'funcao', u.funcao,
          'nivel_acesso', u.nivel_acesso
        )
        order by u.nome
      )
      from public.usuarios_operacionais u
      where u.empresa_id = op.empresa_id
        and u.obra_id = op.obra_id
    ), '[]'::jsonb)
  )
  from public.turnos_operacao op
  join public.empresas e
    on e.id = op.empresa_id
   and e.access_status = 'active'
  join public.obras o
    on o.id = op.obra_id
   and o.empresa_id = op.empresa_id
  join public.turnos t
    on t.id = op.turno_id
   and t.obra_id = op.obra_id
   and t.empresa_id = op.empresa_id
  where op.public_token::text = p_token
    and op.status in ('publicado', 'em_andamento', 'pausado')
  limit 1
$$;

revoke all on function public.campo_contexto_token(text) from public;
grant execute on function public.campo_contexto_token(text) to anon, authenticated;
