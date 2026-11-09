drop policy if exists "Suporte threads propria conta" on public.suporte_threads;
create policy "Suporte threads propria conta"
on public.suporte_threads for select to authenticated
using (
  public.is_app_admin()
  or user_id = auth.uid()
);

drop policy if exists "Suporte mensagens propria conta" on public.suporte_mensagens;
create policy "Suporte mensagens propria conta"
on public.suporte_mensagens for select to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.suporte_threads t
    where t.id = suporte_mensagens.thread_id
      and t.user_id = auth.uid()
  )
);

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

revoke all on function public.suporte_listar_mensagens(uuid) from public;
revoke all on function public.suporte_enviar_mensagem(uuid, text) from public;

grant execute on function public.suporte_listar_mensagens(uuid) to authenticated;
grant execute on function public.suporte_enviar_mensagem(uuid, text) to authenticated;
