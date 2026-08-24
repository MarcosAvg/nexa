-- Añade p.updated_at a la vista personnel_with_status para que el listado de
-- personal pueda detectar registros modificados por otros usuarios.
-- (updated_at se añade al final para no renombrar columnas con CREATE OR REPLACE.)
BEGIN;

create or replace view "public"."personnel_with_status" with (security_invoker=true) AS
WITH person_ready_cards AS (
    SELECT p_1.id,
        count(DISTINCT amt.name) FILTER (
            WHERE (amt.has_floors AND (am.status = 'active'::text)
              AND (am.programming_status = 'done'::text)
              AND (am.responsiva_status = ANY (ARRAY['signed'::text, 'legacy'::text])))
        ) AS core_ready_types,
        bool_or(amt.has_floors) AS has_core_cards,
        bool_or(((NOT amt.has_floors) AND (am.status = 'active'::text))) AS has_active_noncore
    FROM (public.personnel p_1
        LEFT JOIN public.access_media am ON ((am.person_id = p_1.id))
        LEFT JOIN public.access_media_types amt ON ((amt.id = am.media_type_id)))
    GROUP BY p_1.id
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
        WHEN ((p.status = 'active'::text) AND (prc.core_ready_types >= (SELECT public.core_types_required()))) THEN 'Activo/a'::text
        WHEN ((p.status = 'active'::text) AND (prc.core_ready_types > 0)) THEN 'Parcial'::text
        WHEN ((p.status = 'active'::text) AND (prc.core_ready_types = 0) AND (COALESCE(prc.has_core_cards, false) = false) AND (COALESCE(prc.has_active_noncore, false) = true)) THEN 'Activo/a'::text
        WHEN ((p.status = 'active'::text) AND (prc.core_ready_types = 0)) THEN 'Sin Acceso'::text
        WHEN (p.status = 'blocked'::text) THEN 'Bloqueado/a'::text
        ELSE 'Baja'::text
    END AS computed_status,
    p.updated_at
FROM ((((public.personnel p
    LEFT JOIN person_ready_cards prc ON ((prc.id = p.id)))
    LEFT JOIN public.buildings b ON ((b.id = p.building_id)))
    LEFT JOIN public.dependencies d ON ((d.id = p.dependency_id)))
    LEFT JOIN public.schedules s ON ((s.id = p.schedule_id)));

COMMIT;
