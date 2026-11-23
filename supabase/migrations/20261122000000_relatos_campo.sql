-- "Conte como foi o dia" (backlog 10.1+10.2). Spec: docs/superpowers/specs/2026-11-22-ia-texto-livre-design.md
-- Texto original que o responsável escreveu no link de campo, guardado antes de chamar a IA.
-- Escrita so pelo servidor (service_role, validando o token); o planejador so le.

create table public.relatos_campo (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  responsavel_id uuid not null references public.responsaveis(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 1000),
  tentativas int not null default 1 check (tentativas >= 1),
  lancado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index relatos_campo_turno_responsavel_idx on public.relatos_campo (turno_id, responsavel_id);
create index relatos_campo_responsavel_idx on public.relatos_campo (responsavel_id);

create trigger relatos_campo_bloquear_fechado before insert or update or delete on public.relatos_campo
  for each row execute function public.tg_bloquear_turno_fechado();
create trigger relatos_campo_responsavel_obra before insert or update on public.relatos_campo
  for each row execute function public.tg_responsavel_mesma_obra();

alter table public.relatos_campo enable row level security;
revoke all on public.relatos_campo from anon, authenticated;
grant select on public.relatos_campo to authenticated;
grant all on public.relatos_campo to service_role;
create policy relatos_campo_leitura on public.relatos_campo
  for select to authenticated
  using (exists (select 1 from public.turnos t join public.obras o on o.id = t.obra_id
                 where t.id = relatos_campo.turno_id and public.eh_membro(o.empresa_id)));
