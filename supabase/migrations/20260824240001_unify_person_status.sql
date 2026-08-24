-- Fase 1: Estado de persona único.
-- get_dashboard_metrics usaba un umbral hardcodeado (>= 2) en lugar de
-- core_types_required(), lo que hacía que el dashboard discrepara del listado
-- (personnel_with_status) y del Excel cuando el umbral se cambia en Configuración.
-- Se alinea a core_types_required() y se conservan las claves de salida que
-- consume la UI (activo/parcial/inactivo/bloqueado/baja).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $function$
DECLARE
    core_required integer;
    total_count integer;
    status_counts json;
    card_coverage json;
    top_dependencies json;
    top_buildings json;
    data_quality json;
    operativos_count integer;
    con_p2000_count integer;
    con_kone_count integer;
BEGIN
    SELECT public.core_types_required() INTO core_required;

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
                WHEN db_status = 'active' AND core_ready_types >= core_required THEN 'activo'
                WHEN db_status = 'active' AND core_ready_types > 0 THEN 'parcial'
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
        JOIN access_media_types t ON t.id = am.media_type_id
        WHERE p.status = 'active'
          AND am.status = 'active'
          AND am.programming_status = 'done'
          AND am.responsiva_status IN ('signed', 'legacy')
        GROUP BY p.id
        HAVING COUNT(DISTINCT t.id) >= 1
    ) AS op;

    SELECT COUNT(DISTINCT am.person_id) INTO con_p2000_count
    FROM access_media am
    INNER JOIN access_media_types t ON t.id = am.media_type_id
    WHERE t.key = 'p2000' AND am.status = 'active' AND am.person_id IS NOT NULL;

    SELECT COUNT(DISTINCT am.person_id) INTO con_kone_count
    FROM access_media am
    INNER JOIN access_media_types t ON t.id = am.media_type_id
    WHERE t.key = 'kone' AND am.status = 'active' AND am.person_id IS NOT NULL;

    SELECT json_build_object(
        'operativos', operativos_count,
        'conP2000', con_p2000_count,
        'sinP2000', GREATEST(0, operativos_count - con_p2000_count),
        'conKone', con_kone_count,
        'sinKone', GREATEST(0, operativos_count - con_kone_count)
    ) INTO card_coverage;

    SELECT json_agg(t) INTO top_dependencies FROM (
        SELECT d.name, COUNT(p.id) as total, COUNT(p.id) FILTER (WHERE p.status = 'active') as activos
        FROM dependencies d
        LEFT JOIN personnel p ON p.dependency_id = d.id
        GROUP BY d.name
        ORDER BY total DESC
        LIMIT 10
    ) t;

    SELECT json_agg(t) INTO top_buildings FROM (
        SELECT b.name, COUNT(p.id) as total
        FROM buildings b
        LEFT JOIN personnel p ON p.building_id = b.id
        GROUP BY b.name
        ORDER BY total DESC
        LIMIT 6
    ) t;

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
        'topDependencies', COALESCE(top_dependencies, '[]'::json),
        'topBuildings', COALESCE(top_buildings, '[]'::json),
        'dataQuality', data_quality
    );
END;
$function$;

COMMIT;
