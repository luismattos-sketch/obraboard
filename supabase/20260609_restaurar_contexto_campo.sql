-- Restaura o cadastro seguro usado pela tela Campo a partir do token do QR Code.
-- A funcao retorna somente dados operacionais publicos e nunca expoe e-mail.

update public.turnos_operacao
set status = 'publicado',
    updated_at = now()
where public_token is not null
  and publicado_em is not null
  and encerrado_em is null
  and status not in ('publicado', 'em_andamento', 'pausado');

create temporary table if not exists campo_vinculos_obras
on commit drop
as
select distinct on (obra_id)
  obra_id,
  empresa_id
from public.turnos_operacao
where obra_id is not null
  and empresa_id is not null
order by obra_id, updated_at desc nulls last, created_at desc nulls last;

update public.obras o
set empresa_id = v.empresa_id
from campo_vinculos_obras v
where o.id = v.obra_id
  and o.empresa_id is distinct from v.empresa_id;

update public.turnos t
set empresa_id = v.empresa_id
from campo_vinculos_obras v
where t.obra_id = v.obra_id
  and t.empresa_id is distinct from v.empresa_id;

update public.funcoes_previstas f
set empresa_id = v.empresa_id
from campo_vinculos_obras v
where f.obra_id = v.obra_id
  and f.empresa_id is distinct from v.empresa_id;

update public.usuarios_operacionais u
set empresa_id = v.empresa_id
from campo_vinculos_obras v
where u.obra_id = v.obra_id
  and u.empresa_id is distinct from v.empresa_id;

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
  order by op.updated_at desc
  limit 1
$$;

revoke all on function public.campo_empresa_token(text) from public;
grant execute on function public.campo_empresa_token(text) to anon, authenticated;

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
  with token_base as (
    select
      op.empresa_id,
      op.obra_id,
      op.turno_id,
      op.turno
    from public.turnos_operacao op
    where op.public_token::text = public.campo_token()
    order by op.updated_at desc
    limit 1
  ),
  contexto as (
    select
      tb.empresa_id,
      coalesce(
        public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
        tb.obra_id
      ) as obra_id,
      coalesce(
        public.campo_bigint_seguro(
          cb.dados->'turnoAtivoIdPorObra'->>(
            coalesce(
              public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
              tb.obra_id
            )::text
          )
        ),
        tb.turno_id
      ) as turno_id,
      coalesce(
        nullif(
          cb.dados->'turnoAtivoPorObra'->>(
            coalesce(
              public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
              tb.obra_id
            )::text
          ),
          ''
        ),
        tb.turno
      ) as turno
    from token_base tb
    left join lateral (
      select c.dados
      from public.cadastro_base c
      where c.empresa_id = tb.empresa_id
      order by c.updated_at desc
      limit 1
    ) cb on true
  )
  select exists (
    select 1
    from contexto c
    join public.empresas e
      on e.id = c.empresa_id
     and e.access_status = 'active'
    where c.empresa_id = p_empresa_id
      and c.obra_id = p_obra_id
      and (
        p_turno_id is null
        or c.turno_id is null
        or c.turno_id = p_turno_id
      )
      and (
        p_turno is null
        or c.turno is null
        or lower(trim(c.turno)) = lower(trim(p_turno))
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
  with token_base as (
    select
      op.empresa_id,
      op.obra_id as token_obra_id,
      op.turno_id as token_turno_id,
      op.turno as token_turno
    from public.turnos_operacao op
    join public.empresas e
      on e.id = op.empresa_id
     and e.access_status = 'active'
    where op.public_token::text = p_token
    order by op.updated_at desc
    limit 1
  ),
  selecao as (
    select
      tb.empresa_id,
      cb.dados,
      coalesce(
        public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
        tb.token_obra_id
      ) as obra_id,
      coalesce(
        public.campo_bigint_seguro(
          cb.dados->'turnoAtivoIdPorObra'->>(
            coalesce(
              public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
              tb.token_obra_id
            )::text
          )
        ),
        tb.token_turno_id
      ) as turno_id,
      coalesce(
        nullif(
          cb.dados->'turnoAtivoPorObra'->>(
            coalesce(
              public.campo_bigint_seguro(cb.dados->>'obraAtivaId'),
              tb.token_obra_id
            )::text
          ),
          ''
        ),
        tb.token_turno
      ) as turno
    from token_base tb
    left join lateral (
      select c.dados
      from public.cadastro_base c
      where c.empresa_id = tb.empresa_id
      order by c.updated_at desc
      limit 1
    ) cb on true
  ),
  contexto as (
    select
      s.empresa_id,
      s.dados,
      s.obra_id,
      coalesce(op.turno_id, a.turno_id, s.turno_id) as turno_id,
      coalesce(nullif(s.turno, ''), op.turno, a.turno, t.nome) as turno,
      coalesce(op.data_turno, a.data_turno) as data_turno,
      coalesce(op.status, 'planejado') as status
    from selecao s
    left join lateral (
      select linha.*
      from public.turnos_operacao linha
      where linha.empresa_id = s.empresa_id
        and linha.obra_id = s.obra_id
        and (
          s.turno_id is null
          or linha.turno_id = s.turno_id
          or lower(trim(linha.turno)) = lower(trim(s.turno))
        )
      order by linha.data_turno desc, linha.updated_at desc
      limit 1
    ) op on true
    left join lateral (
      select linha.turno_id, linha.turno, linha.data_turno
      from public.atividades linha
      where linha.empresa_id = s.empresa_id
        and linha.obra_id = s.obra_id
        and (
          s.turno_id is null
          or linha.turno_id = s.turno_id
          or lower(trim(linha.turno)) = lower(trim(s.turno))
        )
      order by linha.data_turno desc, linha.id desc
      limit 1
    ) a on true
    left join public.turnos t
      on t.id = s.turno_id
     and t.obra_id = s.obra_id
  )
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'obra_id', c.obra_id,
      'turno_id', c.turno_id,
      'data_turno', c.data_turno,
      'turno', c.turno,
      'status', c.status
    ),
    'obra', jsonb_build_object(
      'id', c.obra_id,
      'nome', coalesce(
        nullif(o.nome, ''),
        nullif(obra_cadastro.dados->>'nome', ''),
        nullif(obra_cadastro.dados->>'codigo', ''),
        'Obra sem nome'
      ),
      'codigo', coalesce(
        nullif(o.codigo, ''),
        obra_cadastro.dados->>'codigo',
        ''
      ),
      'logo_url', coalesce(
        nullif(o.logo_url, ''),
        obra_cadastro.dados->>'logoUrl',
        c.dados->>'logoUrl',
        ''
      )
    ),
    'turno', jsonb_build_object(
      'id', c.turno_id,
      'nome', coalesce(
        nullif(t.nome, ''),
        nullif(turno_cadastro.dados->>'nome', ''),
        c.turno
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
      where f.empresa_id = c.empresa_id
        and f.obra_id = c.obra_id
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
          c.dados->'dadosPorObra'->(c.obra_id::text)->'funcoesPrevistas',
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
      where u.empresa_id = c.empresa_id
        and u.obra_id = c.obra_id
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
          c.dados->'dadosPorObra'->(c.obra_id::text)->'usuarios',
          c.dados->'usuarios',
          '[]'::jsonb
        )
      ) item
    ), '[]'::jsonb)
  )
  from contexto c
  left join public.obras o
    on o.id = c.obra_id
   and o.empresa_id = c.empresa_id
  left join public.turnos t
    on t.id = c.turno_id
   and t.obra_id = c.obra_id
   and t.empresa_id = c.empresa_id
  left join lateral (
    select item as dados
    from jsonb_array_elements(
      coalesce(c.dados->'obras', '[]'::jsonb)
    ) item
    where public.campo_bigint_seguro(item->>'id') = c.obra_id
    limit 1
  ) obra_cadastro on true
  left join lateral (
    select item as dados
    from jsonb_array_elements(
      coalesce(
        c.dados->'dadosPorObra'->(c.obra_id::text)->'turnos',
        c.dados->'turnos',
        '[]'::jsonb
      )
    ) item
    where public.campo_bigint_seguro(item->>'id') = c.turno_id
    limit 1
  ) turno_cadastro on true
  where c.obra_id is not null
  limit 1
$$;

revoke all on function public.campo_contexto_token(text) from public;
grant execute on function public.campo_contexto_token(text) to anon, authenticated;

drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao"
on public.turnos_operacao for select to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
);

drop policy if exists "Campo token atualiza operacao" on public.turnos_operacao;
create policy "Campo token atualiza operacao"
on public.turnos_operacao for update to anon
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
