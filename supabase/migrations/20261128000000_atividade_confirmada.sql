-- Turno planejado: o planejador confirma cada atividade (com a equipe dela). O efetivo de cada responsavel
-- passa a ser a soma das equipes das atividades confirmadas dele (calculo no app: lib/db/atividades.ts).
alter table public.atividades
  add column equipe_confirmada boolean not null default false;
