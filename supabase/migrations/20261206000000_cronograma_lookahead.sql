-- Item 5.1: lookahead. Cronograma da contratada (importado de CSV/Excel, reconhecido pelo codigo)
-- ou itens manuais. A atividade da semana guarda de qual item veio.

create table public.cronograma_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  origem text not null check (origem in ('importado','manual')),
  codigo text,
  descricao text not null check (char_length(descricao) between 1 and 500),
  inicio date not null,
  fim date not null,
  local text,
  unidade text,
  quantidade numeric check (quantidade is null or quantidade > 0),
  removido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim >= inicio),
  check ((origem = 'importado') = (codigo is not null)),
  check (origem = 'importado' or removido_em is null)
);

create unique index cronograma_itens_codigo_uniq
  on public.cronograma_itens (obra_id, codigo) where origem = 'importado';
create index cronograma_itens_obra_idx on public.cronograma_itens (obra_id, inicio);

create table public.cronograma_importacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  arquivo_nome text not null,
  mapeamento jsonb not null,
  novos integer not null,
  atualizados integer not null,
  removidos integer not null,
  created_at timestamptz not null default now()
);
create index cronograma_importacoes_obra_idx on public.cronograma_importacoes (obra_id, created_at desc);

alter table public.programacao_atividades
  add column cronograma_item_id uuid references public.cronograma_itens(id) on delete set null;

alter table public.cronograma_itens enable row level security;
alter table public.cronograma_importacoes enable row level security;
revoke all on public.cronograma_itens, public.cronograma_importacoes from anon, authenticated;
grant select, insert, update, delete on public.cronograma_itens, public.cronograma_importacoes to authenticated;
grant all on public.cronograma_itens, public.cronograma_importacoes to service_role;

create policy cronograma_itens_all on public.cronograma_itens
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = cronograma_itens.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = cronograma_itens.obra_id and public.eh_membro(o.empresa_id)));

create policy cronograma_importacoes_all on public.cronograma_importacoes
  for all to authenticated
  using (exists (select 1 from public.obras o
                 where o.id = cronograma_importacoes.obra_id and public.eh_membro(o.empresa_id)))
  with check (exists (select 1 from public.obras o
                      where o.id = cronograma_importacoes.obra_id and public.eh_membro(o.empresa_id)));

-- Importacao numa transacao so: upsert pelo codigo, marca os ausentes como removidos,
-- nao toca itens manuais, grava o historico. security invoker: RLS vale.
create or replace function public.importar_cronograma(
  p_obra uuid, p_arquivo text, p_mapeamento jsonb, p_linhas jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_novos int := 0;
  v_atualizados int := 0;
  v_removidos int := 0;
  l jsonb;
  v_id uuid;
  v_n int;
begin
  if not exists (select 1 from obras o where o.id = p_obra and eh_membro(o.empresa_id)) then
    raise exception 'obra não encontrada';
  end if;

  for l in select * from jsonb_array_elements(p_linhas) loop
    select id into v_id from cronograma_itens
      where obra_id = p_obra and origem = 'importado' and codigo = l->>'codigo';
    if v_id is null then
      insert into cronograma_itens (obra_id, origem, codigo, descricao, inicio, fim, local, unidade, quantidade)
      values (p_obra, 'importado', l->>'codigo', l->>'descricao', (l->>'inicio')::date, (l->>'fim')::date,
              nullif(l->>'local',''), nullif(l->>'unidade',''), (l->>'quantidade')::numeric);
      v_novos := v_novos + 1;
    else
      update cronograma_itens set
        descricao = l->>'descricao', inicio = (l->>'inicio')::date, fim = (l->>'fim')::date,
        local = nullif(l->>'local',''), unidade = nullif(l->>'unidade',''),
        quantidade = (l->>'quantidade')::numeric, removido_em = null, updated_at = now()
      where id = v_id and (
        descricao is distinct from l->>'descricao' or inicio is distinct from (l->>'inicio')::date
        or fim is distinct from (l->>'fim')::date or local is distinct from nullif(l->>'local','')
        or unidade is distinct from nullif(l->>'unidade','')
        or quantidade is distinct from (l->>'quantidade')::numeric or removido_em is not null);
      get diagnostics v_n = row_count;
      if v_n > 0 then v_atualizados := v_atualizados + 1; end if;
    end if;
  end loop;

  update cronograma_itens set removido_em = now(), updated_at = now()
  where obra_id = p_obra and origem = 'importado' and removido_em is null
    and codigo not in (select e->>'codigo' from jsonb_array_elements(p_linhas) e);
  get diagnostics v_removidos = row_count;

  insert into cronograma_importacoes (obra_id, arquivo_nome, mapeamento, novos, atualizados, removidos)
  values (p_obra, p_arquivo, p_mapeamento, v_novos, v_atualizados, v_removidos);

  return jsonb_build_object('novos', v_novos, 'atualizados', v_atualizados, 'removidos', v_removidos);
end;
$$;

revoke all on function public.importar_cronograma(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.importar_cronograma(uuid, text, jsonb, jsonb) to authenticated;
