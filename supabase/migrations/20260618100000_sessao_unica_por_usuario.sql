create table if not exists public.usuario_sessoes_ativas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.usuario_sessoes_ativas enable row level security;

create or replace function public.registrar_sessao_ativa(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if nullif(trim(p_session_id), '') is null then
    return true;
  end if;

  insert into public.usuario_sessoes_ativas (
    user_id,
    session_id,
    updated_at,
    last_seen_at
  )
  values (
    auth.uid(),
    trim(p_session_id),
    now(),
    now()
  )
  on conflict (user_id) do update set
    session_id = excluded.session_id,
    updated_at = now(),
    last_seen_at = now();

  return true;
end;
$$;

revoke all on function public.registrar_sessao_ativa(text) from public;
grant execute on function public.registrar_sessao_ativa(text) to authenticated;

create or replace function public.validar_sessao_ativa(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if nullif(trim(p_session_id), '') is null then
    return true;
  end if;

  select session_id
    into v_session_id
    from public.usuario_sessoes_ativas
   where user_id = auth.uid()
   for update;

  if v_session_id is null then
    insert into public.usuario_sessoes_ativas (
      user_id,
      session_id,
      updated_at,
      last_seen_at
    )
    values (
      auth.uid(),
      trim(p_session_id),
      now(),
      now()
    )
    on conflict (user_id) do nothing;

    return true;
  end if;

  if v_session_id = trim(p_session_id) then
    update public.usuario_sessoes_ativas
       set last_seen_at = now()
     where user_id = auth.uid();

    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.validar_sessao_ativa(text) from public;
grant execute on function public.validar_sessao_ativa(text) to authenticated;
