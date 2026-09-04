create or replace function public.get_dashboard_stats()
  returns json
  language sql
  stable
  set search_path to 'public', 'extensions'
  AS $function$
    SELECT json_build_object(
        'activePersonnel', (
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
                GROUP BY p.id, p.status, r.cnt
            ),
            cs AS (
                SELECT
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
                FROM pm
            )
            SELECT COUNT(*) FROM cs WHERE final_status IN ('activo', 'parcial', 'media_otro_edificio')
        ),
        'stock', (
            SELECT COALESCE(json_agg(x ORDER BY x."sortOrder"), '[]'::json)
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
            ) x
        )
    );
$function$;

grant execute on function "public"."get_dashboard_stats"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_dashboard_stats"() from public;
