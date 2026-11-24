-- Item 15: especialidade opcional do responsável (ex.: Elétrica, Andaime).
alter table public.responsaveis add column if not exists especialidade text
  check (especialidade is null or char_length(especialidade) <= 40);
