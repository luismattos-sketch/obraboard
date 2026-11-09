insert into public.catalogo_hh
  (disciplina, atividade, indice_hh, unidade)
values
  ('Mecânica', 'Montagem de tubulação de 2 polegadas', 0.8500, 'm'),
  ('Mecânica', 'Montagem de tubulação de 4 polegadas', 1.2500, 'm'),
  ('Mecânica', 'Montagem de estrutura metálica', 0.1200, 'kg'),
  ('Elétrica', 'Lançamento de cabo elétrico', 0.0800, 'm'),
  ('Elétrica', 'Instalação de luminária industrial', 1.5000, 'un'),
  ('Civil', 'Execução de forma de madeira', 0.7500, 'm²')
on conflict do nothing;
