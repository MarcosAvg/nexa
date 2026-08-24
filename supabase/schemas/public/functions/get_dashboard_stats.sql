create or replace function public.get_dashboard_stats()
  returns json
  language sql
  stable
  set search_path to 'public', 'extensions'
  AS $function$
    SELECT json_build_object(
        'activePersonnel', (
            SELECT COUNT(DISTINCT p.id)
            FROM personnel p
            INNER JOIN access_media am ON am.person_id = p.id
            WHERE p.status = 'active'
              AND am.status = 'active'
              AND am.programming_status = 'done'
              AND am.responsiva_status IN ('signed', 'legacy')
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