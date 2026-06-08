-- Contas individuais, isolamento SaaS e Campo publico por token.
-- Execute depois dos scripts antigos. Este arquivo remove as policies anonimas
-- permissivas que existiam no prototipo.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text,
  created_at timestamptz not null default now()
);

alter table public.empresas
  add column if not exists owner_id uuid references auth.users(id),
  add column if not exists plan text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive';

alter table public.cadastro_base
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

alter table public.turnos_operacao
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists turnos_operacao_public_token_idx
  on public.turnos_operacao(public_token);
create index if not exists cadastro_base_empresa_idx
  on public.cadastro_base(empresa_id);

create or replace function public.usuario_empresa_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select empresa_id
  from public.empresa_usuarios
  where user_id = auth.uid()
$$;

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

    insert into public.empresas(nome, owner_id)
    values (coalesce(nullif(split_part(v_user.email, '@', 1), ''), 'Minha conta'), v_user.id)
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

  insert into public.empresas(nome, owner_id)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'Minha conta'), new.id)
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

create or replace function public.campo_token()
returns text
language sql
stable
as $$
  select nullif((
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
    ->> 'x-campo-token'
  ), '')
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
    from public.turnos_operacao t
    where t.public_token::text = public.campo_token()
      and t.empresa_id = p_empresa_id
      and t.obra_id = p_obra_id
      and (p_turno_id is null or t.turno_id = p_turno_id)
      and (p_data_turno is null or t.data_turno = p_data_turno)
      and (p_turno is null or lower(trim(t.turno)) = lower(trim(p_turno)))
      and t.status in ('publicado', 'em_andamento', 'pausado')
  )
$$;

revoke all on function public.campo_token_valido(uuid,bigint,bigint,date,text) from public;
grant execute on function public.campo_token_valido(uuid,bigint,bigint,date,text) to anon, authenticated;

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
    select empresa_id into v_empresa_id
    from public.turnos_operacao
    where public_token::text = public.campo_token()
      and status in ('publicado', 'em_andamento', 'pausado')
    limit 1;
  end if;

  new.empresa_id := v_empresa_id;
  return new;
end;
$$;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'obras','turnos','usuarios_operacionais','disciplinas','funcoes_previstas',
    'atividades','mao_obra','atividade_recursos','recursos_disponiveis',
    'restricoes_historico','turnos_operacao','checkout_validacoes','rdos',
    'cadastro_base'
  ]
  loop
    execute format('drop trigger if exists preencher_empresa_id_automatico on public.%I', v_tabela);
    execute format(
      'create trigger preencher_empresa_id_automatico before insert on public.%I
       for each row execute function public.preencher_empresa_id()', v_tabela
    );
  end loop;
end $$;

-- Remove integralmente o acesso publico do prototipo.
drop policy if exists "Permitir leitura publica de atividades" on public.atividades;
drop policy if exists "Permitir criacao publica de atividades" on public.atividades;
drop policy if exists "Permitir edicao publica de atividades" on public.atividades;
drop policy if exists "Permitir exclusao publica de atividades" on public.atividades;
drop policy if exists "Permitir leitura publica de recursos de atividades" on public.atividade_recursos;
drop policy if exists "Permitir criacao publica de recursos de atividades" on public.atividade_recursos;
drop policy if exists "Permitir edicao publica de recursos de atividades" on public.atividade_recursos;
drop policy if exists "Permitir exclusao publica de recursos de atividades" on public.atividade_recursos;
drop policy if exists "Permitir leitura publica de recursos disponiveis" on public.recursos_disponiveis;
drop policy if exists "Permitir criacao publica de recursos disponiveis" on public.recursos_disponiveis;
drop policy if exists "Permitir edicao publica de recursos disponiveis" on public.recursos_disponiveis;
drop policy if exists "Permitir exclusao publica de recursos disponiveis" on public.recursos_disponiveis;
drop policy if exists "Permitir leitura publica de cadastro base" on public.cadastro_base;
drop policy if exists "Permitir criacao publica de cadastro base" on public.cadastro_base;
drop policy if exists "Permitir edicao publica de cadastro base" on public.cadastro_base;
drop policy if exists "Permitir leitura publica de mao de obra" on public.mao_obra;
drop policy if exists "Permitir criacao publica de mao de obra" on public.mao_obra;
drop policy if exists "Permitir edicao publica de mao de obra" on public.mao_obra;
drop policy if exists "Permitir exclusao publica de mao de obra" on public.mao_obra;
drop policy if exists "Campo publico restricoes por link" on public.restricoes_historico;
drop policy if exists "Operacao publica turnos por link" on public.turnos_operacao;

alter table public.profiles enable row level security;
alter table public.cadastro_base enable row level security;

drop policy if exists "Perfil proprio" on public.profiles;
create policy "Perfil proprio" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Cadastro por empresa" on public.cadastro_base;
create policy "Cadastro por empresa" on public.cadastro_base
  for all to authenticated
  using (empresa_id in (select public.usuario_empresa_ids()))
  with check (empresa_id in (select public.usuario_empresa_ids()));

-- Policies anonimas minimas do Campo. O token precisa coincidir com a linha.
drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao" on public.turnos_operacao
  for select to anon using (
    public_token::text = public.campo_token()
    and status in ('publicado', 'em_andamento', 'pausado')
  );

drop policy if exists "Campo token atualiza operacao" on public.turnos_operacao;
create policy "Campo token atualiza operacao" on public.turnos_operacao
  for update to anon
  using (public_token::text = public.campo_token())
  with check (public_token::text = public.campo_token());

drop policy if exists "Campo token obras" on public.obras;
create policy "Campo token obras" on public.obras for select to anon using (
  public.campo_token_valido(empresa_id, id, null, null, null)
);

drop policy if exists "Campo token turnos" on public.turnos;
create policy "Campo token turnos" on public.turnos for select to anon using (
  public.campo_token_valido(empresa_id, obra_id, id, null, nome)
);

drop policy if exists "Campo token funcoes" on public.funcoes_previstas;
create policy "Campo token funcoes" on public.funcoes_previstas for select to anon using (
  public.campo_token_valido(empresa_id, obra_id, null, null, null)
);

drop policy if exists "Campo token atividades" on public.atividades;
create policy "Campo token atividades" on public.atividades
  for select to anon using (
    public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno)
  );
drop policy if exists "Campo token atualiza atividades" on public.atividades;
create policy "Campo token atualiza atividades" on public.atividades
  for update to anon
  using (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno))
  with check (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno));

drop policy if exists "Campo token mao obra" on public.mao_obra;
create policy "Campo token mao obra" on public.mao_obra
  for all to anon
  using (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno))
  with check (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno));

drop policy if exists "Campo token recursos atividades" on public.atividade_recursos;
create policy "Campo token recursos atividades" on public.atividade_recursos
  for select to anon using (
    exists (
      select 1 from public.atividades a
      where a.id = atividade_id
        and public.campo_token_valido(a.empresa_id, a.obra_id, a.turno_id, a.data_turno, a.turno)
    )
  );

drop policy if exists "Campo token restricoes" on public.restricoes_historico;
create policy "Campo token restricoes" on public.restricoes_historico
  for all to anon
  using (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno))
  with check (public.campo_token_valido(empresa_id, obra_id, turno_id, data_turno, turno));

-- Prepara profiles de usuarios existentes. A empresa e criada no primeiro
-- login por garantir_conta_usuario(), quando auth.uid() esta disponivel.
do $$
declare
  v_user record;
begin
  for v_user in select id, email from auth.users
  loop
    insert into public.profiles(id, email)
    values (v_user.id, coalesce(v_user.email, ''))
    on conflict (id) do update set email = excluded.email;
  end loop;
end $$;
