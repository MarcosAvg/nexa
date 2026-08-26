-- Crea/limpia automáticamente los tickets de Programación y Firma Responsiva
-- al cambiar el estado de una tarjeta (access_media).
drop trigger if exists trg_access_media_ticket_effects on public.access_media;
create trigger trg_access_media_ticket_effects
after insert or update of person_id, programming_status, responsiva_status
on public.access_media
for each row
execute function handle_access_media_ticket_effects();
