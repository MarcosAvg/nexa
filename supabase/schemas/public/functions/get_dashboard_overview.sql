-- Dashboard: una sola RPC con todo el panel (stats + métricas).
-- Reemplaza a get_dashboard_stats + get_dashboard_metrics para evitar duplicar
-- el cálculo de la máquina de estados y reducir a un solo round-trip.
-- `activePersonnel` coincide con `operativos` (activo + parcial + media_otro_edificio).

create or replace function public.get_dashboard_overview()
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
    stock json;
BEGIN
    SELECT COUNT(*) INTO total_count FROM personnel;

    CREATE TEMP TABLE tmp_person_status ON COMMIT DROP AS
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
    SELECT id,
        building_id,
        CASE
            WHEN db_status = 'blocked' THEN 'bloqueado'
            WHEN db_status IN ('inactive', 'baja') THEN 'baja'
            WHEN req_cnt = 0 THEN
                CASE
                    WHEN NOT coalesce(has_any_card, false) THEN 'sin_acceso'
                    WHEN coalesce(has_other_ready, false) THEN 'media_otro_edificio'
                    ELSE 'media_otro_edificio_pendiente'
                END
            WHEN req_ready >= req_cnt THEN 'activo'
            WHEN req_ready > 0 THEN 'parcial'
            WHEN coalesce(has_required_present, false) THEN 'en_proceso'
            WHEN coalesce(has_other_ready, false) THEN 'media_otro_edificio'
            WHEN coalesce(has_any_card, false) THEN 'media_otro_edificio_pendiente'
            ELSE 'sin_acceso'
        END AS final_status
    FROM pm;

    SELECT COUNT(*) INTO operativos_count
    FROM tmp_person_status
    WHERE final_status IN ('activo', 'parcial', 'media_otro_edificio');

    SELECT json_build_object(
        'activo', COUNT(*) FILTER (WHERE final_status = 'activo'),
        'parcial', COUNT(*) FILTER (WHERE final_status = 'parcial'),
        'en_proceso', COUNT(*) FILTER (WHERE final_status = 'en_proceso'),
        'media_otro_edificio', COUNT(*) FILTER (WHERE final_status = 'media_otro_edificio'),
        'media_otro_edificio_pendiente', COUNT(*) FILTER (WHERE final_status = 'media_otro_edificio_pendiente'),
        'sin_acceso', COUNT(*) FILTER (WHERE final_status = 'sin_acceso'),
        'bloqueado', COUNT(*) FILTER (WHERE final_status = 'bloqueado'),
        'baja', COUNT(*) FILTER (WHERE final_status = 'baja')
    ) INTO status_counts FROM tmp_person_status;

    no_activos_count := GREATEST(0, total_count - operativos_count);

    SELECT COALESCE(json_agg(z ORDER BY z.sort_order, z.name), '[]'::json)
    INTO card_coverage
    FROM (
        WITH mb AS (
            SELECT mtb.media_type_id, mtb.building_id, b.name
            FROM access_media_type_buildings mtb
            JOIN buildings b ON b.id = mtb.building_id
        ),
        elig AS (
            SELECT s.building_id, count(*) AS total
            FROM tmp_person_status s
            WHERE s.final_status IN ('activo', 'parcial', 'media_otro_edificio')
            GROUP BY s.building_id
        ),
        cons AS (
            SELECT am.media_type_id, s.building_id, count(DISTINCT am.person_id) AS con
            FROM access_media am
            JOIN tmp_person_status s
              ON s.id = am.person_id
             AND s.final_status IN ('activo', 'parcial', 'media_otro_edificio')
            WHERE am.status = 'active'
            GROUP BY am.media_type_id, s.building_id
        )
        SELECT t.id AS "mediaTypeId",
               t.name,
               t.sort_order,
               COALESCE(json_agg(DISTINCT mb.name) FILTER (WHERE mb.name IS NOT NULL), '[]'::json) AS buildings,
               COALESCE(SUM(elig.total), 0) AS total,
               COALESCE(SUM(cons.con), 0) AS con
        FROM access_media_types t
        LEFT JOIN mb ON mb.media_type_id = t.id
        LEFT JOIN elig ON elig.building_id = mb.building_id
        LEFT JOIN cons ON cons.media_type_id = t.id AND cons.building_id = mb.building_id
        WHERE t.active
        GROUP BY t.id, t.name, t.sort_order
    ) z;

    DROP TABLE IF EXISTS tmp_person_status;

    SELECT json_agg(t ORDER BY t.sort_order, t.name) INTO top_dependencies FROM (
        SELECT d.name, d.sort_order, COUNT(p.id) as total,
               COUNT(p.id) FILTER (WHERE p.status = 'active') as activos
        FROM dependencies d
        LEFT JOIN personnel p ON p.dependency_id = d.id
        GROUP BY d.name, d.sort_order
    ) t;

    SELECT json_agg(t ORDER BY t.sort_order, t.name) INTO top_buildings FROM (
        SELECT b.name, b.sort_order, COUNT(p.id) as total
        FROM buildings b
        LEFT JOIN personnel p ON p.building_id = b.id
        GROUP BY b.name, b.sort_order
    ) t;

    SELECT COALESCE(json_agg(x ORDER BY x.sort_order, x.name), '[]'::json)
    INTO building_floors
    FROM (
        SELECT b.id AS "buildingId",
               b.name,
               b.sort_order,
               COALESCE((
                   SELECT json_agg(f ORDER BY f.sort_order, f.label)
                   FROM (
                       SELECT fl.id, fl.label, fl.sort_order, COALESCE(pc.people, 0) AS people
                       FROM floors fl
                       LEFT JOIN (
                           SELECT building_id,
                                  lower(coalesce(floor, '')) AS fkey,
                                  count(*) AS people
                           FROM personnel
                           WHERE building_id IS NOT NULL
                           GROUP BY building_id, lower(coalesce(floor, ''))
                       ) pc ON pc.building_id = fl.building_id
                            AND pc.fkey = lower(coalesce(fl.label, ''))
                       WHERE fl.building_id = b.id
                   ) f
               ), '[]'::json) AS floors
        FROM buildings b
    ) x;

    SELECT json_build_object(
        'sinEmail', COUNT(*) FILTER (WHERE email IS NULL OR email = ''),
        'sinSchedule', COUNT(*) FILTER (WHERE schedule_id IS NULL),
        'sinPosition', COUNT(*) FILTER (WHERE position IS NULL OR position = ''),
        'sinArea', COUNT(*) FILTER (WHERE area IS NULL OR area = ''),
        'total', total_count
    ) INTO data_quality FROM personnel;

    SELECT COALESCE(json_agg(s ORDER BY s."sortOrder"), '[]'::json)
    INTO stock
    FROM (
        SELECT t.id AS "mediaTypeId",
               t.name,
               t.sort_order AS "sortOrder",
               COUNT(am.id) AS stock
        FROM access_media_types t
        LEFT JOIN access_media am
          ON am.media_type_id = t.id
         AND am.status = 'available'
         AND am.person_id IS NULL
        WHERE t.active
        GROUP BY t.id, t.name, t.sort_order
    ) s;

    RETURN json_build_object(
        'activePersonnel', operativos_count,
        'stock', stock,
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

grant execute on function "public"."get_dashboard_overview"() to "authenticated", "postgres", "service_role";
revoke all on function "public"."get_dashboard_overview"() from public;
