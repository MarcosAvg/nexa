-- Fase 4 (RPC transaccional): update_person_status.
-- Sustituye la secuencia del cliente (personnel + access_media + tickets) por un
-- RPC atómico. Al dar de BAJA/inactive revoca las asignaciones activas y libera
-- las tarjetas (el cliente no lo hacía), garantizando integridad de permisos.

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
        -- Liberar tarjetas activas de la persona (sin marcar la persona como tarjeta inactiva)
        update access_media
           set person_id = null,
               status = 'available',
               programming_status = 'pending',
               responsiva_status = 'unsigned'
         where person_id = p_person_id and status <> 'inactive';

        -- Revocar asignaciones activas
        update access_assignments
           set status = 'inactive',
               revoked_at = now()
         where person_id = p_person_id and status = 'active';

        -- Limpiar tickets pendientes
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

COMMIT;
