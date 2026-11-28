-- Item 4.1: quem do cliente pediu o servico extra (nome e funcao, texto livre, opcional).
alter table public.atividades
  add column solicitado_por text check (solicitado_por is null or char_length(solicitado_por) between 1 and 100);

alter table public.atividades add constraint atividades_solicitado_so_extra
  check (solicitado_por is null or tipo is not distinct from 'extra');
