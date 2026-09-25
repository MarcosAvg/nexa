-- Reversión de la migración `person_baja_definitiva`.
--
-- El concepto "Baja definitiva" no existe como estado: la baja definitiva es
-- una ELIMINACIÓN. Por eso se restaura `update_person_status` (colapsa
-- `baja` → `inactive`) y `personnel_with_status` (muestra "Baja" para ambos).

create or replace function public.update_person_status(p_person_id uuid, p_status text)
 returns void
 language plpgsql
 security invoker
 set search_path to 'public', 'extensions'
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
           set status = 'inactive',
               revoked_at = now()
         where person_id = p_person_id and status = 'active';

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

create or replace view "public"."personnel_with_status" with (security_invoker=true) AS
WITH req AS (
    SELECT mtb.building_id,
           array_agg(t.id) AS ids,
           count(t.id) AS cnt
    FROM access_media_type_buildings mtb
    JOIN access_media_types t ON t.id = mtb.media_type_id AND t.active
    GROUP BY mtb.building_id
),
pm AS (
    SELECT p.id,
           p.status AS db_status,
           p.building_id,
           count(DISTINCT am.media_type_id) FILTER (
               WHERE am.media_type_id = ANY(coalesce(r.ids, '{}'::uuid[]))
                 AND am.status = 'active'
                 AND am.programming_status = 'done'
                 AND am.responsiva_status IN ('signed', 'legacy')
           ) AS req_ready,
           bool_or(am.id IS NOT NULL AND am.media_type_id = ANY(coalesce(r.ids, '{}'::uuid[]))) AS has_required_present,
           bool_or(am.id IS NOT NULL AND NOT (am.media_type_id = ANY(coalesce(r.ids, '{}'::uuid[])))
                   AND am.status = 'active'
                   AND am.programming_status = 'done'
                   AND am.responsiva_status IN ('signed', 'legacy')) AS has_other_ready,
           bool_or(am.id IS NOT NULL) AS has_any_card,
           coalesce(r.cnt, 0) AS req_cnt
    FROM personnel p
    LEFT JOIN req r ON r.building_id = p.building_id
    LEFT JOIN access_media am ON am.person_id = p.id
    GROUP BY p.id, p.status, p.building_id, r.cnt
)
SELECT p.id,
    p.first_name,
    p.last_name,
    p.employee_no,
    p.email,
    p.area,
    p."position",
    p.dependency_id,
    p.building_id,
    p.floor,
    p.schedule_id,
    p.entry_time,
    p.exit_time,
    p.status,
    p.photo_url,
    p.created_at,
    COALESCE(b.name, 'N/A'::text) AS building_name,
    COALESCE(d.name, 'N/A'::text) AS dependency_name,
    COALESCE(s.name, 'Sin Horario'::text) AS schedule_name,
    CASE
        WHEN pm.db_status = 'blocked' THEN 'Bloqueado/a'
        WHEN pm.db_status IN ('inactive', 'baja') THEN 'Baja'
        WHEN pm.req_cnt = 0 THEN
            CASE
                WHEN NOT coalesce(pm.has_any_card, false) THEN 'Sin Acceso'
                WHEN coalesce(pm.has_other_ready, false) THEN 'Media de otro edificio'
                ELSE 'Otro edificio en proceso'
            END
        WHEN pm.req_ready >= pm.req_cnt THEN 'Activo/a'
        WHEN pm.req_ready > 0 THEN 'Parcial'
        WHEN coalesce(pm.has_required_present, false) THEN 'En proceso'
        WHEN coalesce(pm.has_other_ready, false) THEN 'Media de otro edificio'
        WHEN coalesce(pm.has_any_card, false) THEN 'Otro edificio en proceso'
        ELSE 'Sin Acceso'
    END AS computed_status,
    p.updated_at
FROM public.personnel p
LEFT JOIN pm ON pm.id = p.id
LEFT JOIN public.buildings b ON b.id = p.building_id
LEFT JOIN public.dependencies d ON d.id = p.dependency_id
LEFT JOIN public.schedules s ON s.id = p.schedule_id;
