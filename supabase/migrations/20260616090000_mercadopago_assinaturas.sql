alter table public.empresas
  add column if not exists access_status text not null default 'active',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_provider text,
  add column if not exists subscription_customer_id text,
  add column if not exists subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists manual_block_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.empresas
  drop constraint if exists empresas_plan_check,
  add constraint empresas_plan_check
    check (plan in ('free', 'trial', 'basic', 'premium', 'enterprise'));

alter table public.empresas
  drop constraint if exists empresas_subscription_status_check,
  add constraint empresas_subscription_status_check
    check (subscription_status in (
      'inactive', 'trialing', 'active', 'past_due', 'cancelled'
    ));

alter table public.empresas
  drop constraint if exists empresas_access_status_check,
  add constraint empresas_access_status_check
    check (access_status in (
      'active', 'suspended', 'cancelled', 'banned',
      'deleted_pending', 'deleted'
    ));

update public.empresas
set plan = coalesce(nullif(plan, ''), 'trial'),
    subscription_status = 'trialing',
    trial_started_at = coalesce(trial_started_at, created_at, now()),
    trial_ends_at = coalesce(trial_ends_at, now() + interval '30 days'),
    access_status = 'active',
    updated_at = now()
where access_status = 'active'
  and coalesce(subscription_status, 'inactive') = 'inactive';

create or replace function public.obter_status_acesso_atual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      join public.banned_emails b on lower(b.email) = lower(p.email)
      where p.id = auth.uid() and b.is_active = true
    ) then 'banned'
    else coalesce((
      select case
        when e.access_status <> 'active' then e.access_status
        when e.subscription_status = 'active' then 'active'
        when e.subscription_status = 'trialing'
          and coalesce(e.trial_ends_at, now()) >= now() then 'active'
        when e.subscription_status in ('past_due', 'cancelled') then e.access_status
        else 'suspended'
      end
      from public.empresa_usuarios eu
      join public.empresas e on e.id = eu.empresa_id
      where eu.user_id = auth.uid()
      order by eu.created_at
      limit 1
    ), 'deleted')
  end
$$;

revoke all on function public.obter_status_acesso_atual() from public;
grant execute on function public.obter_status_acesso_atual() to authenticated;

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
begin
  insert into public.profiles(id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

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
