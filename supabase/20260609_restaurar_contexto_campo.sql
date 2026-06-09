-- Restaura o cadastro seguro usado pela tela Campo a partir do token do QR Code.
-- A funcao retorna somente dados operacionais publicos e nunca expoe e-mail.

update public.turnos_operacao
set status = 'publicado',
    updated_at = now()
where public_token is not null
  and publicado_em is not null
  and encerrado_em is null
  and status not in ('publicado', 'em_andamento', 'pausado');

create or replace function public.campo_token_valido(
  p_empresa_id uuid,
  p_obra_id bigint,
  p_turno_id bigint,
  p_data_turno date,
  p_turno text
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.turnos_operacao op
    join public.empresas e on e.id = op.empresa_id
    where op.public_token::text = public.campo_token()
      and op.empresa_id = p_empresa_id
      and e.access_status = 'active'
      and op.obra_id = p_obra_id
      and (
        p_turno_id is null
        or op.turno_id = p_turno_id
        or (
          op.turno_id is null
          and p_turno is not null
          and lower(trim(op.turno)) = lower(trim(p_turno))
        )
      )
      and (p_data_turno is null or op.data_turno = p_data_turno)
      and (
        p_turno is null
        or lower(trim(op.turno)) = lower(trim(p_turno))
      )
      and (
        op.status in ('publicado', 'em_andamento', 'pausado')
        or (
          op.publicado_em is not null
          and op.encerrado_em is null
        )
      )
  )
$$;

create or replace function public.campo_contexto_token(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'obra_id', op.obra_id,
      'turno_id', coalesce(t.id, op.turno_id),
      'data_turno', op.data_turno,
      'turno', op.turno,
      'status', op.status
    ),
    'obra', jsonb_build_object(
      'id', o.id,
      'nome', o.nome,
      'codigo', o.codigo,
      'logo_url', o.logo_url
    ),
    'turno', jsonb_build_object(
      'id', coalesce(t.id, op.turno_id),
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
  left join lateral (
    select tr.id, tr.nome
    from public.turnos tr
    where tr.obra_id = op.obra_id
      and tr.empresa_id = op.empresa_id
      and (
        tr.id = op.turno_id
        or (
          op.turno_id is null
          and lower(trim(tr.nome)) = lower(trim(op.turno))
        )
      )
    order by (tr.id = op.turno_id) desc
    limit 1
  ) t on true
  where op.public_token::text = p_token
    and (
      op.status in ('publicado', 'em_andamento', 'pausado')
      or (
        op.publicado_em is not null
        and op.encerrado_em is null
      )
    )
  limit 1
$$;

revoke all on function public.campo_contexto_token(text) from public;
grant execute on function public.campo_contexto_token(text) to anon, authenticated;

drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao"
on public.turnos_operacao for select to anon
using (
  public_token::text = public.campo_token()
  and (
    status in ('publicado', 'em_andamento', 'pausado')
    or (
      publicado_em is not null
      and encerrado_em is null
    )
  )
  and public.conta_esta_ativa(empresa_id)
);
