-- Campo publico por QR Code.
-- O token identifica um unico turno publicado e nunca amplia acesso para
-- outras obras, turnos ou contas.

create or replace function public.campo_bigint_seguro(p_valor text)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case
    when trim(coalesce(p_valor, '')) ~ '^[0-9]+$'
      then trim(p_valor)::bigint
    else null
  end
$$;

create or replace function public.conta_esta_ativa(p_empresa_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.empresas e
    where e.id = p_empresa_id
      and e.access_status = 'active'
  )
$$;

create or replace function public.campo_empresa_token(p_token text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select op.empresa_id
  from public.turnos_operacao op
  join public.empresas e
    on e.id = op.empresa_id
   and e.access_status = 'active'
  where op.public_token::text = p_token
    and op.publicado_em is not null
    and lower(coalesce(op.status, '')) not in ('cancelado', 'cancelled')
  limit 1
$$;

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
    join public.empresas e
      on e.id = op.empresa_id
     and e.access_status = 'active'
    where op.public_token::text = public.campo_token()
      and op.publicado_em is not null
      and lower(coalesce(op.status, '')) not in ('cancelado', 'cancelled')
      and op.empresa_id = p_empresa_id
      and op.obra_id = p_obra_id
      and (
        p_turno_id is null
        or op.turno_id = p_turno_id
      )
      and (
        p_data_turno is null
        or op.data_turno = p_data_turno
      )
      and (
        p_turno is null
        or lower(trim(op.turno)) = lower(trim(p_turno))
      )
  )
$$;

create or replace function public.campo_status_token(p_token text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case
      when e.access_status <> 'active' then e.access_status
      when op.publicado_em is null then 'unpublished'
      when lower(coalesce(op.status, '')) in ('cancelado', 'cancelled') then 'cancelled'
      else 'active'
    end
    from public.turnos_operacao op
    join public.empresas e on e.id = op.empresa_id
    where op.public_token::text = p_token
    limit 1
  ), 'invalid')
$$;

create or replace function public.campo_contexto_token(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with operacao as (
    select op.*
    from public.turnos_operacao op
    join public.empresas e
      on e.id = op.empresa_id
     and e.access_status = 'active'
    where op.public_token::text = p_token
      and op.publicado_em is not null
      and lower(coalesce(op.status, '')) not in ('cancelado', 'cancelled')
    limit 1
  ),
  cadastro as (
    select cb.dados
    from operacao op
    left join lateral (
      select c.dados
      from public.cadastro_base c
      where c.empresa_id = op.empresa_id
      order by c.updated_at desc
      limit 1
    ) cb on true
  ),
  obra_json as (
    select item as dados
    from operacao op
    cross join cadastro c
    cross join lateral jsonb_array_elements(
      coalesce(c.dados->'obras', '[]'::jsonb)
    ) item
    where public.campo_bigint_seguro(item->>'id') = op.obra_id
    limit 1
  ),
  turno_json as (
    select item as dados
    from operacao op
    cross join cadastro c
    cross join lateral jsonb_array_elements(
      coalesce(
        c.dados->'dadosPorObra'->(op.obra_id::text)->'turnos',
        c.dados->'turnos',
        '[]'::jsonb
      )
    ) item
    where public.campo_bigint_seguro(item->>'id') = op.turno_id
    limit 1
  )
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'obra_id', op.obra_id,
      'turno_id', op.turno_id,
      'data_turno', op.data_turno,
      'turno', op.turno,
      'status', op.status,
      'publicado_em', op.publicado_em,
      'iniciado_em', op.iniciado_em,
      'encerrado_em', op.encerrado_em
    ),
    'obra', jsonb_build_object(
      'id', op.obra_id,
      'nome', coalesce(
        nullif(o.nome, ''),
        nullif(oj.dados->>'nome', ''),
        nullif(oj.dados->>'codigo', ''),
        'Obra sem nome'
      ),
      'codigo', coalesce(
        nullif(o.codigo, ''),
        oj.dados->>'codigo',
        ''
      ),
      'logo_url', coalesce(
        nullif(o.logo_url, ''),
        oj.dados->>'logoUrl',
        c.dados->>'logoUrl',
        ''
      )
    ),
    'turno', jsonb_build_object(
      'id', op.turno_id,
      'nome', coalesce(
        nullif(t.nome, ''),
        nullif(tj.dados->>'nome', ''),
        op.turno
      )
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
    ), (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', item->>'id',
          'nome', item->>'nome',
          'quantidade', item->>'quantidade',
          'carga_horaria', item->>'cargaHoraria'
        )
      ), '[]'::jsonb)
      from jsonb_array_elements(
        coalesce(
          c.dados->'dadosPorObra'->(op.obra_id::text)->'funcoesPrevistas',
          c.dados->'funcoesPrevistas',
          '[]'::jsonb
        )
      ) item
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
    ), (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', item->>'id',
          'nome', item->>'nome',
          'funcao', item->>'funcao',
          'nivel_acesso', item->>'nivelAcesso'
        )
      ), '[]'::jsonb)
      from jsonb_array_elements(
        coalesce(
          c.dados->'dadosPorObra'->(op.obra_id::text)->'usuarios',
          c.dados->'usuarios',
          '[]'::jsonb
        )
      ) item
    ), '[]'::jsonb)
  )
  from operacao op
  cross join cadastro c
  left join public.obras o
    on o.id = op.obra_id
   and o.empresa_id = op.empresa_id
  left join public.turnos t
    on t.id = op.turno_id
   and t.obra_id = op.obra_id
   and t.empresa_id = op.empresa_id
  left join obra_json oj on true
  left join turno_json tj on true
  limit 1
$$;

revoke all on function public.campo_empresa_token(text) from public;
revoke all on function public.campo_status_token(text) from public;
revoke all on function public.campo_contexto_token(text) from public;
grant execute on function public.campo_empresa_token(text) to anon, authenticated;
grant execute on function public.campo_status_token(text) to anon, authenticated;
grant execute on function public.campo_contexto_token(text) to anon, authenticated;

drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao"
on public.turnos_operacao for select to anon
using (
  public_token::text = public.campo_token()
  and publicado_em is not null
  and lower(coalesce(status, '')) not in ('cancelado', 'cancelled')
  and public.conta_esta_ativa(empresa_id)
);

drop policy if exists "Campo token atualiza operacao" on public.turnos_operacao;
create policy "Campo token atualiza operacao"
on public.turnos_operacao for update to anon
using (
  public_token::text = public.campo_token()
  and publicado_em is not null
  and lower(coalesce(status, '')) not in ('cancelado', 'cancelled')
  and public.conta_esta_ativa(empresa_id)
)
with check (
  public_token::text = public.campo_token()
  and publicado_em is not null
  and lower(coalesce(status, '')) not in ('cancelado', 'cancelled')
  and public.conta_esta_ativa(empresa_id)
);

drop policy if exists "Campo token obras" on public.obras;
create policy "Campo token obras"
on public.obras for select to anon
using (public.campo_token_valido(empresa_id, id, null, null, null));

drop policy if exists "Campo token turnos" on public.turnos;
create policy "Campo token turnos"
on public.turnos for select to anon
using (public.campo_token_valido(empresa_id, obra_id, id, null, nome));

drop policy if exists "Campo token funcoes" on public.funcoes_previstas;
create policy "Campo token funcoes"
on public.funcoes_previstas for select to anon
using (public.campo_token_valido(empresa_id, obra_id, null, null, null));

drop policy if exists "Campo token atividades" on public.atividades;
create policy "Campo token atividades"
on public.atividades for select to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
);

drop policy if exists "Campo token atualiza atividades" on public.atividades;
create policy "Campo token atualiza atividades"
on public.atividades for update to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
)
with check (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
);

drop policy if exists "Campo token mao obra" on public.mao_obra;
create policy "Campo token mao obra"
on public.mao_obra for all to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
)
with check (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
);

drop policy if exists "Campo token recursos atividades" on public.atividade_recursos;
create policy "Campo token recursos atividades"
on public.atividade_recursos for select to anon
using (
  exists (
    select 1
    from public.atividades a
    where a.id = atividade_id
      and public.campo_token_valido(
        a.empresa_id, a.obra_id, a.turno_id, a.data_turno, a.turno
      )
  )
);

drop policy if exists "Campo token restricoes" on public.restricoes_historico;
create policy "Campo token restricoes"
on public.restricoes_historico for all to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
)
with check (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
);

create or replace function public.preencher_empresa_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
begin
  if new.empresa_id is not null then
    return new;
  end if;

  if auth.uid() is not null then
    select empresa_id into v_empresa_id
    from public.empresa_usuarios
    where user_id = auth.uid()
    order by created_at
    limit 1;
  else
    v_empresa_id := public.campo_empresa_token(public.campo_token());
  end if;

  new.empresa_id := v_empresa_id;
  return new;
end;
$$;
