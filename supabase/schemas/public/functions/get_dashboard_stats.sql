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
            INNER JOIN access_media_types t ON t.id = am.media_type_id
            WHERE p.status = 'active'
              AND am.status = 'active'
              AND am.programming_status = 'done'
              AND am.responsiva_status IN ('signed', 'legacy')
        ),
        'koneStock', (
            SELECT COUNT(*)
            FROM access_media am
            INNER JOIN access_media_types t ON t.id = am.media_type_id
            WHERE t.key = 'kone'
              AND am.status = 'available'
              AND am.person_id IS NULL
        ),
        'p2000Stock', (
            SELECT COUNT(*)
            FROM access_media am
            INNER JOIN access_media_types t ON t.id = am.media_type_id
            WHERE t.key = 'p2000'
              AND am.status = 'available'
              AND am.person_id IS NULL
        ),
        'accessproStock', (
            SELECT COUNT(*)
            FROM access_media am
            INNER JOIN access_media_types t ON t.id = am.media_type_id
            WHERE t.key = 'accesspro'
              AND am.status = 'available'
              AND am.person_id IS NULL
        )
    );
$function$;

grant execute on function "public"."get_dashboard_stats"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_dashboard_stats"() from public;
