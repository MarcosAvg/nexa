-- Estado por edificio de radicación: máquina de 8 estados.
-- Regla: conjunto de medios requeridos del edificio (access_media_type_buildings ∩ activos);
-- listo = active + programming done + responsiva signed|legacy.

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

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."personnel_with_status" to "authenticated", "postgres", "service_role";
