-- Búsqueda de personal insensible a acentos.
--
-- 1) `search_personnel_fuzzy` ahora también busca por número de empleado
--    cuando se usa un solo término.
-- 2) La vista `personnel_with_status` expone `search_text`
--    (lower+unaccent de nombres + número de empleado) para que la lista
--    paginada pueda filtrar sin acentos desde PostgREST.
--
-- Los filtros de la app normalizan el término con `normalizeSearch()`
-- (NFD + sin diacríticos + lower), equivalente a `lower(unaccent(...))`.

BEGIN;

create or replace function public.search_personnel_fuzzy (
  p_last_name  text,
  p_first_name text,
  p_limit      integer default 20
)
  returns SETOF public.personnel
  language plpgsql
  set search_path to 'public', 'extensions'
  AS $function$
DECLARE
  search_term_1 text;
  search_term_2 text;
BEGIN
  -- Normalizar términos: quitar acentos, pasar a minúsculas y limpiar espacios
  search_term_1 := lower(unaccent(trim(regexp_replace(p_last_name, '\s+', ' ', 'g'))));
  search_term_2 := lower(unaccent(trim(regexp_replace(p_first_name, '\s+', ' ', 'g'))));
  RETURN QUERY
  SELECT p.*
  FROM personnel p
  WHERE p.status != 'inactive'
    AND (
      -- Opción 1: Apellido match term1 Y Nombre match term2 (o parcial)
      (
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_1 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_2 || '%')
        OR
        (lower(unaccent(p.last_name)) ILIKE '%' || search_term_2 || '%' AND lower(unaccent(p.first_name)) ILIKE '%' || search_term_1 || '%')
      )
      OR
      -- Opción 2: Si un término está vacío, buscar el otro en ambos campos
      -- (incluye también el número de empleado).
      (
        (search_term_1 = '' AND (
          lower(unaccent(p.last_name)) ILIKE '%' || search_term_2 || '%'
          OR lower(unaccent(p.first_name)) ILIKE '%' || search_term_2 || '%'
          OR lower(unaccent(coalesce(p.employee_no, ''))) ILIKE '%' || search_term_2 || '%'
        ))
        OR
        (search_term_2 = '' AND (
          lower(unaccent(p.last_name)) ILIKE '%' || search_term_1 || '%'
          OR lower(unaccent(p.first_name)) ILIKE '%' || search_term_1 || '%'
          OR lower(unaccent(coalesce(p.employee_no, ''))) ILIKE '%' || search_term_1 || '%'
        ))
      )
    )
  ORDER BY
    similarity(lower(unaccent(p.last_name || ' ' || p.first_name)), search_term_1 || ' ' || search_term_2) DESC,
    p.last_name ASC
  LIMIT p_limit;
END;
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
    p.updated_at,
    lower(unaccent(
        coalesce(p.first_name, '') || ' ' ||
        coalesce(p.last_name, '') || ' ' ||
        coalesce(p.employee_no, '')
    )) AS search_text
FROM public.personnel p
LEFT JOIN pm ON pm.id = p.id
LEFT JOIN public.buildings b ON b.id = p.building_id
LEFT JOIN public.dependencies d ON d.id = p.dependency_id
LEFT JOIN public.schedules s ON s.id = p.schedule_id;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."personnel_with_status" to "authenticated", "postgres", "service_role";

COMMIT;
