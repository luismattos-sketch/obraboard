-- Reparo pontual para o erro:
-- "Supabase bloqueou a operacao por RLS" ao iniciar/parar/continuar turno.
--
-- Causa: a politica anonima antiga validava turnos_operacao contra public.obras,
-- mas public.obras nao fica visivel para a chave publica em ambientes com RLS.
-- O painel ja carrega as atividades do turno, entao a politica publica deve
-- validar a operacao contra as atividades publicaveis da mesma obra/data/turno.

drop policy if exists "Operacao publica turnos por link" on public.turnos_operacao;

create policy "Operacao publica turnos por link"
on public.turnos_operacao for all to anon
using (
  exists (
    select 1 from public.atividades a
    where a.obra_id = turnos_operacao.obra_id
      and a.data_turno = turnos_operacao.data_turno
      and (
        turnos_operacao.turno_id is null
        or a.turno_id = turnos_operacao.turno_id
        or lower(trim(a.turno)) = lower(trim(turnos_operacao.turno))
      )
  )
)
with check (
  exists (
    select 1 from public.atividades a
    where a.obra_id = turnos_operacao.obra_id
      and a.data_turno = turnos_operacao.data_turno
      and (
        turnos_operacao.turno_id is null
        or a.turno_id = turnos_operacao.turno_id
        or lower(trim(a.turno)) = lower(trim(turnos_operacao.turno))
      )
  )
);
