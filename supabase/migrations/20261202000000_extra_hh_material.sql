-- Item 4.2: HH (pessoas x horas) e material do servico extra, separados do escopo.
alter table public.atividades
  add column extra_pessoas integer check (extra_pessoas is null or extra_pessoas between 1 and 500),
  add column extra_horas numeric check (extra_horas is null or (extra_horas > 0 and extra_horas <= 24)),
  add column materiais jsonb not null default '[]'::jsonb check (jsonb_typeof(materiais) = 'array' and jsonb_array_length(materiais) <= 20);

alter table public.atividades add constraint atividades_hh_extra_par
  check ((extra_pessoas is null) = (extra_horas is null));

alter table public.atividades add constraint atividades_hh_material_so_extra
  check ((extra_pessoas is null and materiais = '[]'::jsonb) or tipo is not distinct from 'extra');
