-- Atividades legadas podem usar IDs operacionais que ainda nao foram
-- materializados nas tabelas obras/turnos. A atividade continua sendo a
-- referencia oficial da foto e as policies validam obra, turno e token.

alter table public.atividade_fotos
drop constraint if exists atividade_fotos_obra_id_fkey;

alter table public.atividade_fotos
drop constraint if exists atividade_fotos_turno_id_fkey;
