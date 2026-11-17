-- Links de campo e da TV sempre visiveis para o planejador (backlog item 5).
-- Spec: docs/superpowers/specs/2026-11-16-links-campo-tv-design.md
-- O token em claro fica protegido pela RLS de membro (anon nao tem acesso). A busca das rotas
-- publicas (/t/[token] e /q/[codigo]) continua pelo hash. Links antigos ficam sem token (nao ha como recuperar).
alter table public.turnos add column token_campo text;
alter table public.obras add column quadro_token text;
