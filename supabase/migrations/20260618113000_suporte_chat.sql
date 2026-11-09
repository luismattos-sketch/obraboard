create table if not exists public.suporte_threads (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assunto text not null default 'Suporte Frentia',
  status text not null default 'aberto',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suporte_threads_status_check check (status in ('aberto', 'respondido', 'encerrado'))
);

create unique index if not exists suporte_threads_empresa_user_idx
on public.suporte_threads (empresa_id, user_id);

create index if not exists suporte_threads_last_message_idx
on public.suporte_threads (last_message_at desc);

create table if not exists public.suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.suporte_threads(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  autor_tipo text not null,
  autor_nome text not null,
  mensagem text not null,
  created_at timestamptz not null default now(),
  constraint suporte_mensagens_autor_tipo_check check (autor_tipo in ('cliente', 'superadmin'))
);

create index if not exists suporte_mensagens_thread_created_idx
on public.suporte_mensagens (thread_id, created_at);

alter table public.suporte_threads enable row level security;
alter table public.suporte_mensagens enable row level security;

drop policy if exists "Suporte threads propria conta" on public.suporte_threads;
create policy "Suporte threads propria conta"
on public.suporte_threads for select to authenticated
using (
  public.is_app_admin()
  or user_id = auth.uid()
  or empresa_id in (select public.usuario_empresa_ids())
);

drop policy if exists "Suporte mensagens propria conta" on public.suporte_mensagens;
create policy "Suporte mensagens propria conta"
on public.suporte_mensagens for select to authenticated
using (
  public.is_app_admin()
  or user_id = auth.uid()
  or empresa_id in (select public.usuario_empresa_ids())
);

create or replace function public.suporte_nome_usuario_atual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    nullif(p.name, ''),
    nullif(au.raw_user_meta_data->>'nome', ''),
    nullif(au.raw_user_meta_data->>'name', ''),
    split_part(coalesce(au.email, ''), '@', 1),
    'Usuario'
  )
  from auth.users au
  left join public.profiles p on p.id = au.id
  where au.id = auth.uid()
$$;

create or replace function public.suporte_obter_ou_criar_thread()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_thread public.suporte_threads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select empresa_id
    into v_empresa_id
    from public.empresa_usuarios
   where user_id = auth.uid()
   order by created_at
   limit 1;

  if v_empresa_id is null then
    raise exception 'Conta do usuario nao encontrada.';
  end if;

  insert into public.suporte_threads (empresa_id, user_id)
  values (v_empresa_id, auth.uid())
  on conflict (empresa_id, user_id) do update set
    updated_at = now()
  returning * into v_thread;

  return jsonb_build_object(
    'id', v_thread.id,
    'empresaId', v_thread.empresa_id,
    'userId', v_thread.user_id,
    'assunto', v_thread.assunto,
    'status', v_thread.status,
    'lastMessageAt', v_thread.last_message_at,
    'createdAt', v_thread.created_at
  );
end;
$$;

create or replace function public.suporte_listar_threads_admin()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select case
    when not public.is_app_admin() then '[]'::jsonb
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'empresaId', t.empresa_id,
          'userId', t.user_id,
          'assunto', t.assunto,
          'status', t.status,
          'lastMessageAt', t.last_message_at,
          'createdAt', t.created_at,
          'clienteNome', coalesce(nullif(p.name, ''), nullif(au.raw_user_meta_data->>'nome', ''), nullif(au.raw_user_meta_data->>'name', ''), split_part(coalesce(au.email, ''), '@', 1), 'Usuario'),
          'clienteEmail', coalesce(p.email, au.email, ''),
          'empresaNome', coalesce(nullif(e.nome, ''), 'Conta Frentia'),
          'ultimaMensagem', coalesce((
            select m.mensagem
            from public.suporte_mensagens m
            where m.thread_id = t.id
            order by m.created_at desc
            limit 1
          ), '')
        )
        order by t.last_message_at desc
      )
      from public.suporte_threads t
      join public.empresas e on e.id = t.empresa_id
      left join public.profiles p on p.id = t.user_id
      left join auth.users au on au.id = t.user_id
    ), '[]'::jsonb)
  end
$$;

create or replace function public.suporte_listar_mensagens(p_thread_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'threadId', m.thread_id,
        'autorTipo', m.autor_tipo,
        'autorNome', m.autor_nome,
        'mensagem', m.mensagem,
        'createdAt', m.created_at
      )
      order by m.created_at
    )
    from public.suporte_mensagens m
    join public.suporte_threads t on t.id = m.thread_id
    where m.thread_id = p_thread_id
      and (
        public.is_app_admin()
        or t.user_id = auth.uid()
        or t.empresa_id in (select public.usuario_empresa_ids())
      )
  ), '[]'::jsonb)
$$;

create or replace function public.suporte_enviar_mensagem(
  p_thread_id uuid,
  p_mensagem text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.suporte_threads%rowtype;
  v_mensagem text := nullif(trim(p_mensagem), '');
  v_admin boolean := public.is_app_admin();
  v_autor_tipo text;
  v_autor_nome text;
  v_linha public.suporte_mensagens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if v_mensagem is null then
    raise exception 'Mensagem vazia.';
  end if;

  if p_thread_id is null then
    select empresa_id
      into v_thread.empresa_id
      from public.empresa_usuarios
     where user_id = auth.uid()
     order by created_at
     limit 1;

    if v_thread.empresa_id is null then
      raise exception 'Conta do usuario nao encontrada.';
    end if;

    insert into public.suporte_threads (empresa_id, user_id)
    values (v_thread.empresa_id, auth.uid())
    on conflict (empresa_id, user_id) do update set
      updated_at = now()
    returning * into v_thread;
  else
    select *
      into v_thread
      from public.suporte_threads
     where id = p_thread_id
       and (
         v_admin
         or user_id = auth.uid()
         or empresa_id in (select public.usuario_empresa_ids())
       );
  end if;

  if v_thread.id is null then
    raise exception 'Conversa de suporte nao encontrada.';
  end if;

  v_autor_tipo := case when v_admin then 'superadmin' else 'cliente' end;
  v_autor_nome := case when v_admin then 'Luis do Frentia' else public.suporte_nome_usuario_atual() end;

  insert into public.suporte_mensagens (
    thread_id,
    empresa_id,
    user_id,
    autor_tipo,
    autor_nome,
    mensagem
  )
  values (
    v_thread.id,
    v_thread.empresa_id,
    auth.uid(),
    v_autor_tipo,
    v_autor_nome,
    v_mensagem
  )
  returning * into v_linha;

  update public.suporte_threads
     set status = case when v_admin then 'respondido' else 'aberto' end,
         last_message_at = v_linha.created_at,
         updated_at = now()
   where id = v_thread.id;

  return jsonb_build_object(
    'id', v_linha.id,
    'threadId', v_linha.thread_id,
    'autorTipo', v_linha.autor_tipo,
    'autorNome', v_linha.autor_nome,
    'mensagem', v_linha.mensagem,
    'createdAt', v_linha.created_at
  );
end;
$$;

revoke all on function public.suporte_nome_usuario_atual() from public;
revoke all on function public.suporte_obter_ou_criar_thread() from public;
revoke all on function public.suporte_listar_threads_admin() from public;
revoke all on function public.suporte_listar_mensagens(uuid) from public;
revoke all on function public.suporte_enviar_mensagem(uuid, text) from public;

grant execute on function public.suporte_nome_usuario_atual() to authenticated;
grant execute on function public.suporte_obter_ou_criar_thread() to authenticated;
grant execute on function public.suporte_listar_threads_admin() to authenticated;
grant execute on function public.suporte_listar_mensagens(uuid) to authenticated;
grant execute on function public.suporte_enviar_mensagem(uuid, text) to authenticated;
