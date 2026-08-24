-- T8 y T9 (limpieza de tickets):
-- - Normaliza el estado de access_assignments a 'revoked' (semantica unica) en update_person_status.
-- - Backfill de tickets legados 'Reporte de Fallo' -> 'Reporte de Falla'.

BEGIN;

create or replace function public.update_person_status(p_person_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $function$
declare
    v_name text;
begin
    if p_status not in ('active','blocked','inactive','baja') then
        raise exception 'Estado inválido: %', p_status;
    end if;

    select coalesce(first_name || ' ' || last_name, 'Personal') into v_name
      from personnel
     where id = p_person_id;

    if p_status in ('inactive','baja') then
        update access_media
           set person_id = null,
               status = 'available',
               programming_status = 'pending',
               responsiva_status = 'unsigned'
         where person_id = p_person_id and status <> 'inactive';

        update access_assignments
           set status = 'revoked',
               revoked_at = now()
         where person_id = p_person_id and status <> 'revoked';

        delete from tickets
         where person_id = p_person_id and status = 'pending';

        update personnel set status = 'inactive' where id = p_person_id;
    else
        update personnel set status = p_status where id = p_person_id;
    end if;

    insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by)
    values (
        'PERSONNEL',
        p_person_id::text,
        v_name,
        'UPDATE_STATUS',
        jsonb_build_object('message', 'Estado actualizado a ' || p_status),
        auth.uid()
    );
end;
$function$;

update public.tickets
   set type = 'Reporte de Falla'
 where type = 'Reporte de Fallo';

COMMIT;
