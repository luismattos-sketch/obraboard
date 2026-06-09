-- Painel administrativo global do SaaS.
-- Execute no SQL Editor e depois habilite o hook Before User Created:
-- Authentication > Hooks > Before User Created > Postgres function
-- public.hook_bloquear_email_banido

create extension if not exists pgcrypto;

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
  drop constraint if exists empresas_access_status_check,
  add constraint empresas_access_status_check
    check (access_status in (
      'active', 'suspended', 'cancelled', 'banned',
      'deleted_pending', 'deleted'
    ));

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

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.empresas'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) like 'FOREIGN KEY (owner_id)%';

  if v_constraint is not null then
    execute format('alter table public.empresas drop constraint %I', v_constraint);
  end if;

  alter table public.empresas
    add constraint empresas_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.banned_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text,
  banned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid,
  target_account_id uuid,
  action text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into public.app_admins(email, role, is_active)
values ('luismattos@gmail.com', 'owner', true)
on conflict (email) do update
set role = excluded.role,
    is_active = true;

update public.app_admins a
set user_id = u.id
from auth.users u
where lower(u.email) = lower(a.email)
  and a.user_id is distinct from u.id;

create or replace function public.is_app_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = p_user_id
      and is_active = true
  )
$$;

revoke all on function public.is_app_admin(uuid) from public;
grant execute on function public.is_app_admin(uuid) to authenticated, service_role;

create or replace function public.usuario_empresa_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select eu.empresa_id
  from public.empresa_usuarios eu
  join public.empresas e on e.id = eu.empresa_id
  where eu.user_id = auth.uid()
    and e.access_status = 'active'
    and not exists (
      select 1
      from public.profiles p
      join public.banned_emails b on lower(b.email) = lower(p.email)
      where p.id = auth.uid()
        and b.is_active = true
    )
$$;

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
      select e.access_status
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

create or replace function public.vincular_app_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_admins
  set user_id = new.id
  where lower(email) = lower(new.email)
    and user_id is null;
  return new;
end;
$$;

drop trigger if exists vincular_app_admin_apos_signup on auth.users;
create trigger vincular_app_admin_apos_signup
  after insert on auth.users
  for each row execute function public.vincular_app_admin();

create or replace function public.hook_bloquear_email_banido(event jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(event->'user'->>'email');

  if exists (
    select 1 from public.banned_emails
    where lower(email) = v_email and is_active = true
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Este e-mail nao esta autorizado a acessar o aplicativo.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select on public.banned_emails to supabase_auth_admin;
grant execute on function public.hook_bloquear_email_banido(jsonb)
  to supabase_auth_admin;
revoke execute on function public.hook_bloquear_email_banido(jsonb)
  from authenticated, anon, public;

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
    from public.turnos_operacao t
    join public.empresas e on e.id = t.empresa_id
    where t.public_token::text = public.campo_token()
      and t.empresa_id = p_empresa_id
      and e.access_status = 'active'
      and t.obra_id = p_obra_id
      and (p_turno_id is null or t.turno_id = p_turno_id)
      and (p_data_turno is null or t.data_turno = p_data_turno)
      and (p_turno is null or lower(trim(t.turno)) = lower(trim(p_turno)))
      and t.status in ('publicado', 'em_andamento', 'pausado')
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
    select e.access_status
    from public.turnos_operacao t
    join public.empresas e on e.id = t.empresa_id
    where t.public_token::text = p_token
    limit 1
  ), 'invalid')
$$;

revoke all on function public.campo_status_token(text) from public;
grant execute on function public.campo_status_token(text) to anon, authenticated;

drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao"
on public.turnos_operacao for select to anon
using (
  public_token::text = public.campo_token()
  and status in ('publicado', 'em_andamento', 'pausado')
  and exists (
    select 1 from public.empresas e
    where e.id = turnos_operacao.empresa_id
      and e.access_status = 'active'
  )
);

drop policy if exists "Campo token atualiza operacao" on public.turnos_operacao;
create policy "Campo token atualiza operacao"
on public.turnos_operacao for update to anon
using (
  public_token::text = public.campo_token()
  and exists (
    select 1 from public.empresas e
    where e.id = turnos_operacao.empresa_id
      and e.access_status = 'active'
  )
)
with check (
  public_token::text = public.campo_token()
  and exists (
    select 1 from public.empresas e
    where e.id = turnos_operacao.empresa_id
      and e.access_status = 'active'
  )
);

create or replace function public.admin_registrar_auditoria(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_target_account_id uuid,
  p_action text,
  p_reason text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_app_admin(p_admin_user_id) then
    raise exception 'admin required';
  end if;

  insert into public.admin_audit_logs(
    admin_user_id, target_user_id, target_account_id,
    action, reason, metadata
  )
  values (
    p_admin_user_id, p_target_user_id, p_target_account_id,
    p_action, p_reason, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_alterar_conta(
  p_admin_user_id uuid,
  p_account_id uuid,
  p_target_user_id uuid,
  p_access_status text default null,
  p_plan text default null,
  p_subscription_status text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metadata jsonb;
begin
  if not public.is_app_admin(p_admin_user_id) then
    raise exception 'admin required';
  end if;

  if p_target_user_id = p_admin_user_id and p_access_status is distinct from 'active' then
    raise exception 'owner account cannot be blocked';
  end if;

  update public.empresas
  set access_status = coalesce(p_access_status, access_status),
      plan = coalesce(p_plan, plan),
      subscription_status = coalesce(p_subscription_status, subscription_status),
      manual_block_reason = case
        when p_access_status = 'active' then null
        when p_access_status is not null then p_reason
        else manual_block_reason
      end,
      updated_at = now()
  where id = p_account_id;

  if not found then
    raise exception 'account not found';
  end if;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'access_status', p_access_status,
    'plan', p_plan,
    'subscription_status', p_subscription_status
  ));

  perform public.admin_registrar_auditoria(
    p_admin_user_id, p_target_user_id, p_account_id,
    case
      when p_access_status is not null then 'access_status_changed'
      when p_plan is not null then 'plan_changed'
      else 'subscription_status_changed'
    end,
    p_reason,
    v_metadata
  );
end;
$$;

create or replace function public.admin_banir_email(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_account_id uuid,
  p_email text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(p_admin_user_id) then
    raise exception 'admin required';
  end if;

  if lower(p_email) = 'luismattos@gmail.com' then
    raise exception 'owner email cannot be banned';
  end if;

  insert into public.banned_emails(email, reason, banned_by, is_active, updated_at)
  values (lower(p_email), p_reason, p_admin_user_id, true, now())
  on conflict (email) do update
  set reason = excluded.reason,
      banned_by = excluded.banned_by,
      is_active = true,
      updated_at = now();

  update public.empresas
  set access_status = 'banned',
      manual_block_reason = p_reason,
      updated_at = now()
  where id = p_account_id;

  perform public.admin_registrar_auditoria(
    p_admin_user_id, p_target_user_id, p_account_id,
    'email_banned', p_reason, jsonb_build_object('email', lower(p_email))
  );
end;
$$;

create or replace function public.admin_remover_banimento(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_account_id uuid,
  p_email text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(p_admin_user_id) then
    raise exception 'admin required';
  end if;

  update public.banned_emails
  set is_active = false,
      updated_at = now()
  where lower(email) = lower(p_email);

  perform public.admin_registrar_auditoria(
    p_admin_user_id, p_target_user_id, p_account_id,
    'email_unbanned', p_reason, jsonb_build_object('email', lower(p_email))
  );
end;
$$;

revoke all on function public.admin_registrar_auditoria(uuid,uuid,uuid,text,text,jsonb) from public;
revoke all on function public.admin_alterar_conta(uuid,uuid,uuid,text,text,text,text) from public;
revoke all on function public.admin_banir_email(uuid,uuid,uuid,text,text) from public;
revoke all on function public.admin_remover_banimento(uuid,uuid,uuid,text,text) from public;
grant execute on function public.admin_registrar_auditoria(uuid,uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.admin_alterar_conta(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.admin_banir_email(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.admin_remover_banimento(uuid,uuid,uuid,text,text) to service_role;

alter table public.app_admins enable row level security;
alter table public.banned_emails enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admin consulta administradores" on public.app_admins;
create policy "Admin consulta administradores"
on public.app_admins for select to authenticated
using (public.is_app_admin());

drop policy if exists "Admin gerencia emails banidos" on public.banned_emails;
create policy "Admin gerencia emails banidos"
on public.banned_emails for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "Admin consulta auditoria" on public.admin_audit_logs;
create policy "Admin consulta auditoria"
on public.admin_audit_logs for select to authenticated
using (public.is_app_admin());
