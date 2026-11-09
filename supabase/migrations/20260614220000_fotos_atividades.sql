-- Registro fotografico das atividades do Campo e exibicao no RDO.

create table if not exists public.atividade_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  obra_id bigint not null references public.obras(id) on delete cascade,
  turno_id bigint references public.turnos(id) on delete set null,
  atividade_id bigint not null references public.atividades(id) on delete cascade,
  data_turno date not null,
  turno text not null,
  tipo text not null check (tipo in ('inicio', 'durante', 'fim')),
  storage_path text not null unique,
  nome_arquivo text,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists atividade_fotos_atividade_idx
on public.atividade_fotos (atividade_id, created_at);

create index if not exists atividade_fotos_turno_idx
on public.atividade_fotos (obra_id, turno_id, data_turno, turno);

alter table public.atividade_fotos enable row level security;

drop trigger if exists preencher_empresa_id_automatico on public.atividade_fotos;
create trigger preencher_empresa_id_automatico
before insert on public.atividade_fotos
for each row execute function public.preencher_empresa_id();

drop policy if exists "SaaS fotos atividades por empresa" on public.atividade_fotos;
create policy "SaaS fotos atividades por empresa"
on public.atividade_fotos for all to authenticated
using (empresa_id in (select public.usuario_empresa_ids()))
with check (empresa_id in (select public.usuario_empresa_ids()));

drop policy if exists "Campo token fotos atividades" on public.atividade_fotos;
create policy "Campo token fotos atividades"
on public.atividade_fotos for all to anon
using (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
)
with check (
  public.campo_token_valido(
    empresa_id, obra_id, turno_id, data_turno, turno
  )
  and exists (
    select 1
    from public.atividades a
    where a.id = atividade_id
      and a.empresa_id = atividade_fotos.empresa_id
      and a.obra_id = atividade_fotos.obra_id
      and (atividade_fotos.turno_id is null or a.turno_id = atividade_fotos.turno_id)
      and a.data_turno = atividade_fotos.data_turno
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atividade-fotos',
  'atividade-fotos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SaaS arquivos fotos atividades" on storage.objects;
create policy "SaaS arquivos fotos atividades"
on storage.objects for all to authenticated
using (
  bucket_id = 'atividade-fotos'
  and exists (
    select 1
    from public.atividade_fotos f
    where f.storage_path = name
      and f.empresa_id in (select public.usuario_empresa_ids())
  )
)
with check (
  bucket_id = 'atividade-fotos'
  and exists (
    select 1
    from public.atividade_fotos f
    where f.storage_path = name
      and f.empresa_id in (select public.usuario_empresa_ids())
  )
);

drop policy if exists "Campo token arquivos fotos atividades" on storage.objects;
create policy "Campo token arquivos fotos atividades"
on storage.objects for all to anon
using (
  bucket_id = 'atividade-fotos'
  and exists (
    select 1
    from public.atividade_fotos f
    where f.storage_path = name
      and public.campo_token_valido(
        f.empresa_id, f.obra_id, f.turno_id, f.data_turno, f.turno
      )
  )
)
with check (
  bucket_id = 'atividade-fotos'
  and exists (
    select 1
    from public.atividade_fotos f
    where f.storage_path = name
      and public.campo_token_valido(
        f.empresa_id, f.obra_id, f.turno_id, f.data_turno, f.turno
      )
  )
);
