-- Corrige o QR publico depois da inclusao do status administrativo.
-- A policy nao pode consultar empresas diretamente como anon, pois o RLS da
-- propria tabela empresas torna o subselect sempre falso.

create or replace function public.conta_esta_ativa(p_empresa_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.empresas
    where id = p_empresa_id
      and access_status = 'active'
  )
$$;

revoke all on function public.conta_esta_ativa(uuid) from public;
grant execute on function public.conta_esta_ativa(uuid) to anon, authenticated;

drop policy if exists "Campo token turnos operacao" on public.turnos_operacao;
create policy "Campo token turnos operacao"
on public.turnos_operacao for select to anon
using (
  public_token::text = public.campo_token()
  and status in ('publicado', 'em_andamento', 'pausado')
  and public.conta_esta_ativa(empresa_id)
);

drop policy if exists "Campo token atualiza operacao" on public.turnos_operacao;
create policy "Campo token atualiza operacao"
on public.turnos_operacao for update to anon
using (
  public_token::text = public.campo_token()
  and public.conta_esta_ativa(empresa_id)
)
with check (
  public_token::text = public.campo_token()
  and public.conta_esta_ativa(empresa_id)
);
