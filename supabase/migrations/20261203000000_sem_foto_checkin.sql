-- Quadro único (2026-11-26): o check-in deixa de ser "fotografado" ao liberar o turno.
-- A tabela checkin_fotos e a função foto_checkin ficam (dados antigos preservados); só o gatilho sai.
drop trigger if exists turnos_emitir_checkin on public.turnos;
