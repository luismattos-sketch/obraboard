-- Hotfix: remove qualquer policy anon/public criada pelo prototipo.
-- Mantem somente as policies publicas do Campo protegidas por token.

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (roles @> array['anon']::name[] or roles @> array['public']::name[])
      and policyname not like 'Campo token %'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end $$;

alter table public.empresas enable row level security;
alter table public.empresa_usuarios enable row level security;
alter table public.profiles enable row level security;
alter table public.cadastro_base enable row level security;
alter table public.obras enable row level security;
alter table public.turnos enable row level security;
alter table public.usuarios_operacionais enable row level security;
alter table public.disciplinas enable row level security;
alter table public.funcoes_previstas enable row level security;
alter table public.atividades enable row level security;
alter table public.mao_obra enable row level security;
alter table public.atividade_recursos enable row level security;
alter table public.recursos_disponiveis enable row level security;
alter table public.restricoes_historico enable row level security;
alter table public.turnos_operacao enable row level security;
alter table public.checkout_validacoes enable row level security;
alter table public.rdos enable row level security;

-- Sem token, nenhuma tabela operacional pode devolver linhas.
-- As policies "Campo token ..." permanecem válidas para o QR Code.
