create table if not exists public.empresa_convites_acesso (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  email text not null,
  nome text not null default '',
  funcao text not null default '',
  nivel_acesso text not null default 'Usuario',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  accepted_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_convites_acesso_nivel_check
    check (nivel_acesso in ('Planejador', 'Usuario', 'Visitante'))
);

create unique index if not exists empresa_convites_acesso_empresa_email_idx
on public.empresa_convites_acesso (empresa_id, lower(email));

alter table public.empresa_convites_acesso enable row level security;

drop policy if exists "Convites por empresa vinculada" on public.empresa_convites_acesso;
create policy "Convites por empresa vinculada"
on public.empresa_convites_acesso for select to authenticated
using (empresa_id in (select public.usuario_empresa_ids()));

create or replace function public.obter_papel_acesso_atual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select eu.papel
    from public.empresa_usuarios eu
    where eu.user_id = auth.uid()
    order by eu.created_at
    limit 1
  ), 'none')
$$;

revoke all on function public.obter_papel_acesso_atual() from public;
grant execute on function public.obter_papel_acesso_atual() to authenticated;

create or replace function public.obter_administrador_conta_atual()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'id', e.owner_id,
      'email', coalesce(p.email, au.email, ''),
      'nome', coalesce(nullif(p.name, ''), nullif(au.raw_user_meta_data->>'name', ''), nullif(au.raw_user_meta_data->>'nome', ''), split_part(coalesce(au.email, ''), '@', 1), 'Administrador'),
      'funcao', coalesce(nullif(au.raw_user_meta_data->>'funcao', ''), 'Administrador')
    )
    from public.empresa_usuarios eu
    join public.empresas e on e.id = eu.empresa_id
    left join public.profiles p on p.id = e.owner_id
    left join auth.users au on au.id = e.owner_id
    where eu.user_id = auth.uid()
    order by eu.created_at
    limit 1
  ), '{}'::jsonb)
$$;

revoke all on function public.obter_administrador_conta_atual() from public;
grant execute on function public.obter_administrador_conta_atual() to authenticated;

create or replace function public.obter_convite_acesso_email(p_email text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'email', c.email,
      'nome', c.nome,
      'funcao', c.funcao,
      'nivelAcesso', c.nivel_acesso,
      'empresaId', c.empresa_id
    )
    from public.empresa_convites_acesso c
    join public.empresas e on e.id = c.empresa_id
    where lower(c.email) = lower(trim(p_email))
      and c.active = true
      and e.access_status = 'active'
    order by c.updated_at desc
    limit 1
  ), '{}'::jsonb)
$$;

revoke all on function public.obter_convite_acesso_email(text) from public;
grant execute on function public.obter_convite_acesso_email(text) to anon, authenticated;

create or replace function public.papel_por_nivel_acesso(p_nivel text)
returns text
language sql
immutable
as $$
  select case
    when p_nivel = 'Planejador' then 'planejador'
    when p_nivel = 'Visitante' then 'visitante'
    else 'usuario'
  end
$$;

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
  v_emails text[] := array[]::text[];
  v_convite record;
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
      v_emails := array_append(v_emails, v_email);

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

  for v_convite in
    update public.empresa_convites_acesso
    set active = false,
        updated_at = now()
    where empresa_id = v_empresa_id
      and active = true
      and not (lower(email) = any(v_emails))
    returning accepted_user_id
  loop
    if v_convite.accepted_user_id is not null then
      delete from public.empresa_usuarios
      where empresa_id = v_empresa_id
        and user_id = v_convite.accepted_user_id
        and papel <> 'owner';
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

create or replace function public.garantir_conta_usuario()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_empresa_id uuid;
  v_primeira_conta boolean;
  v_convite public.empresa_convites_acesso%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.profiles(id, email)
  values (v_user.id, coalesce(v_user.email, ''))
  on conflict (id) do update set email = excluded.email;

  select empresa_id into v_empresa_id
  from public.empresa_usuarios
  where user_id = v_user.id
  order by created_at
  limit 1;

  if v_empresa_id is null then
    select * into v_convite
    from public.empresa_convites_acesso
    where lower(email) = lower(coalesce(v_user.email, ''))
      and active = true
    order by updated_at desc
    limit 1;

    if v_convite.id is not null then
      v_empresa_id := v_convite.empresa_id;

      insert into public.empresa_usuarios(empresa_id, user_id, papel)
      values (
        v_empresa_id,
        v_user.id,
        public.papel_por_nivel_acesso(v_convite.nivel_acesso)
      )
      on conflict (empresa_id, user_id) do update
      set papel = excluded.papel;

      update public.empresa_convites_acesso
      set accepted_user_id = v_user.id,
          accepted_at = coalesce(accepted_at, now()),
          updated_at = now()
      where id = v_convite.id;
    else
      select not exists(select 1 from public.empresa_usuarios)
        into v_primeira_conta;

      insert into public.empresas(
        nome,
        owner_id,
        plan,
        subscription_status,
        access_status,
        trial_started_at,
        trial_ends_at
      )
      values (
        coalesce(nullif(split_part(v_user.email, '@', 1), ''), 'Minha conta'),
        v_user.id,
        'trial',
        'trialing',
        'active',
        now(),
        now() + interval '30 days'
      )
      returning id into v_empresa_id;

      insert into public.empresa_usuarios(empresa_id, user_id, papel)
      values (v_empresa_id, v_user.id, 'owner');

      if v_primeira_conta then
        update public.cadastro_base
        set id = v_empresa_id::text || ':default',
            empresa_id = v_empresa_id
        where id = 'default' and empresa_id is null;

        update public.obras set empresa_id = v_empresa_id where empresa_id is null;
        update public.turnos set empresa_id = v_empresa_id where empresa_id is null;
        update public.usuarios_operacionais set empresa_id = v_empresa_id where empresa_id is null;
        update public.disciplinas set empresa_id = v_empresa_id where empresa_id is null;
        update public.funcoes_previstas set empresa_id = v_empresa_id where empresa_id is null;
        update public.atividades set empresa_id = v_empresa_id where empresa_id is null;
        update public.mao_obra set empresa_id = v_empresa_id where empresa_id is null;
        update public.atividade_recursos set empresa_id = v_empresa_id where empresa_id is null;
        update public.recursos_disponiveis set empresa_id = v_empresa_id where empresa_id is null;
        update public.restricoes_historico set empresa_id = v_empresa_id where empresa_id is null;
        update public.turnos_operacao set empresa_id = v_empresa_id where empresa_id is null;
        update public.checkout_validacoes set empresa_id = v_empresa_id where empresa_id is null;
        update public.rdos set empresa_id = v_empresa_id where empresa_id is null;
      end if;
    end if;
  end if;

  return v_empresa_id;
end;
$$;

revoke all on function public.garantir_conta_usuario() from public;
grant execute on function public.garantir_conta_usuario() to authenticated;

create or replace function public.criar_conta_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_primeira_conta boolean;
  v_convite public.empresa_convites_acesso%rowtype;
begin
  insert into public.profiles(id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  select * into v_convite
  from public.empresa_convites_acesso
  where lower(email) = lower(coalesce(new.email, ''))
    and active = true
  order by updated_at desc
  limit 1;

  if v_convite.id is not null then
    insert into public.empresa_usuarios(empresa_id, user_id, papel)
    values (
      v_convite.empresa_id,
      new.id,
      public.papel_por_nivel_acesso(v_convite.nivel_acesso)
    )
    on conflict (empresa_id, user_id) do update
    set papel = excluded.papel;

    update public.empresa_convites_acesso
    set accepted_user_id = new.id,
        accepted_at = coalesce(accepted_at, now()),
        updated_at = now()
    where id = v_convite.id;

    return new;
  end if;

  select not exists(select 1 from public.empresa_usuarios)
    into v_primeira_conta;

  insert into public.empresas(
    nome,
    owner_id,
    plan,
    subscription_status,
    access_status,
    trial_started_at,
    trial_ends_at
  )
  values (
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Minha conta'),
    new.id,
    'trial',
    'trialing',
    'active',
    now(),
    now() + interval '30 days'
  )
  returning id into v_empresa_id;

  insert into public.empresa_usuarios(empresa_id, user_id, papel)
  values (v_empresa_id, new.id, 'owner');

  if v_primeira_conta then
    update public.cadastro_base
    set id = v_empresa_id::text || ':default',
        empresa_id = v_empresa_id
    where id = 'default' and empresa_id is null;

    update public.obras set empresa_id = v_empresa_id where empresa_id is null;
    update public.turnos set empresa_id = v_empresa_id where empresa_id is null;
    update public.usuarios_operacionais set empresa_id = v_empresa_id where empresa_id is null;
    update public.disciplinas set empresa_id = v_empresa_id where empresa_id is null;
    update public.funcoes_previstas set empresa_id = v_empresa_id where empresa_id is null;
    update public.atividades set empresa_id = v_empresa_id where empresa_id is null;
    update public.mao_obra set empresa_id = v_empresa_id where empresa_id is null;
    update public.atividade_recursos set empresa_id = v_empresa_id where empresa_id is null;
    update public.recursos_disponiveis set empresa_id = v_empresa_id where empresa_id is null;
    update public.restricoes_historico set empresa_id = v_empresa_id where empresa_id is null;
    update public.turnos_operacao set empresa_id = v_empresa_id where empresa_id is null;
    update public.checkout_validacoes set empresa_id = v_empresa_id where empresa_id is null;
    update public.rdos set empresa_id = v_empresa_id where empresa_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists criar_conta_apos_signup on auth.users;
create trigger criar_conta_apos_signup
  after insert on auth.users
  for each row execute function public.criar_conta_novo_usuario();
