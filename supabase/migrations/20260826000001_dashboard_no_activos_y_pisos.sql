-- Dashboard: contador "No Activos" + todas las dependencias + personas por piso
-- Reemplaza get_dashboard_metrics para:
--   1. Exponer noActivos (complemento de operativos).
--   2. Mostrar TODAS las dependencias y TODOS los edificios (sin LIMIT).
--   3. Añadir buildingFloors (personas por piso según radicación: edificio + piso base).

create or replace function public.get_dashboard_metrics()
  returns json
  language plpgsql
  set search_path to 'public', 'extensions'
  AS $function$
DECLARE
    total_count integer;
    status_counts json;
    card_coverage json;
    top_dependencies json;
    top_buildings json;
    data_quality json;
    operativos_count integer;
    no_activos_count integer;
    building_floors json;
BEGIN
    SELECT COUNT(*) INTO total_count FROM personnel;

    WITH person_ready_cards AS (
        SELECT p.id, p.status as db_status,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.has_floors
                  AND am.status = 'active'
                  AND am.programming_status = 'done'
                  AND am.responsiva_status IN ('signed', 'legacy')
            ) as core_ready_types,
            BOOL_OR(t.has_floors) as has_core_cards,
            BOOL_OR((NOT t.has_floors) AND am.status = 'active') as has_active_noncore
        FROM personnel p
        LEFT JOIN access_media am ON am.person_id = p.id
        LEFT JOIN access_media_types t ON t.id = am.media_type_id
        GROUP BY p.id, p.status
    ),
    computed_statuses AS (
        SELECT
            CASE
                WHEN db_status = 'active' AND core_ready_types >= 2 THEN 'activo'
                WHEN db_status = 'active' AND core_ready_types = 1 THEN 'parcial'
                WHEN db_status = 'active' AND core_ready_types = 0
                     AND COALESCE(has_core_cards, false) = false
                     AND COALESCE(has_active_noncore, false) = true THEN 'activo'
                WHEN db_status = 'active' AND core_ready_types = 0 THEN 'inactivo'
                WHEN db_status = 'blocked' THEN 'bloqueado'
                ELSE 'baja'
            END as final_status
        FROM person_ready_cards
    )
    SELECT json_build_object(
        'activo', COUNT(*) FILTER (WHERE final_status = 'activo'),
        'parcial', COUNT(*) FILTER (WHERE final_status = 'parcial'),
        'inactivo', COUNT(*) FILTER (WHERE final_status = 'inactivo'),
        'bloqueado', COUNT(*) FILTER (WHERE final_status = 'bloqueado'),
        'baja', COUNT(*) FILTER (WHERE final_status = 'baja')
    ) INTO status_counts FROM computed_statuses;

    SELECT COUNT(*) INTO operativos_count
    FROM (
        SELECT p.id
        FROM personnel p
        JOIN access_media am ON am.person_id = p.id
        WHERE p.status = 'active'
          AND am.status = 'active'
          AND am.programming_status = 'done'
          AND am.responsiva_status IN ('signed', 'legacy')
        GROUP BY p.id
        HAVING COUNT(DISTINCT am.media_type_id) >= 1
    ) AS op;

    -- No activos = complemento de operativos (sin acceso listo, bloqueado, baja, etc.)
    no_activos_count := GREATEST(0, total_count - operativos_count);

    -- Cobertura por tipo de medio activo (genérico).
    SELECT COALESCE(json_agg(y ORDER BY y.sort_order), '[]'::json)
    INTO card_coverage
    FROM (
        SELECT t.id AS "mediaTypeId",
               t.name,
               t.sort_order,
               (SELECT COUNT(DISTINCT am2.person_id)
                  FROM access_media am2
                 WHERE am2.media_type_id = t.id
                   AND am2.status = 'active'
                   AND am2.person_id IS NOT NULL) AS con,
               GREATEST(0, operativos_count - (SELECT COUNT(DISTINCT am3.person_id)
                  FROM access_media am3
                 WHERE am3.media_type_id = t.id
                   AND am3.status = 'active'
                   AND am3.person_id IS NOT NULL)) AS sin
        FROM access_media_types t
        WHERE t.active
    ) y;

    -- Todas las dependencias (incluyendo sin personal).
    SELECT json_agg(t ORDER BY t.sort_order, t.name) INTO top_dependencies FROM (
        SELECT d.name, d.sort_order, COUNT(p.id) as total,
               COUNT(p.id) FILTER (WHERE p.status = 'active') as activos
        FROM dependencies d
        LEFT JOIN personnel p ON p.dependency_id = d.id
        GROUP BY d.name, d.sort_order
    ) t;

    -- Todos los edificios (incluyendo sin personal).
    SELECT json_agg(t ORDER BY t.sort_order, t.name) INTO top_buildings FROM (
        SELECT b.name, b.sort_order, COUNT(p.id) as total
        FROM buildings b
        LEFT JOIN personnel p ON p.building_id = b.id
        GROUP BY b.name, b.sort_order
    ) t;

    -- Personas por piso y edificio (según radicación: edificio + piso base).
    SELECT COALESCE(json_agg(x ORDER BY x.sort_order, x.name), '[]'::json)
    INTO building_floors
    FROM (
        SELECT b.id AS "buildingId",
               b.name,
               b.sort_order,
               (
                   SELECT COALESCE(json_agg(f ORDER BY f.sort_order, f.label), '[]'::json)
                   FROM (
                       SELECT fl.id, fl.label, fl.sort_order,
                              (SELECT COUNT(*) FROM personnel p
                                WHERE p.building_id = fl.building_id
                                  AND lower(coalesce(p.floor,'')) = lower(coalesce(fl.label,''))) AS people
                       FROM floors fl
                       WHERE fl.building_id = b.id
                   ) f
               ) AS floors
        FROM buildings b
    ) x;

    SELECT json_build_object(
        'sinEmail', COUNT(*) FILTER (WHERE email IS NULL OR email = ''),
        'sinSchedule', COUNT(*) FILTER (WHERE schedule_id IS NULL),
        'sinPosition', COUNT(*) FILTER (WHERE position IS NULL OR position = ''),
        'sinArea', COUNT(*) FILTER (WHERE area IS NULL OR area = ''),
        'total', total_count
    ) INTO data_quality FROM personnel;

    RETURN json_build_object(
        'totalPersonnel', total_count,
        'statusCounts', status_counts,
        'cardCoverage', card_coverage,
        'operativos', operativos_count,
        'noActivos', no_activos_count,
        'topDependencies', COALESCE(top_dependencies, '[]'::json),
        'topBuildings', COALESCE(top_buildings, '[]'::json),
        'buildingFloors', building_floors,
        'dataQuality', data_quality
    );
END;
$function$;

grant execute on function "public"."get_dashboard_metrics"() to "authenticated", "postgres", "service_role";
revoke all on function "public"."get_dashboard_metrics"() from public;
