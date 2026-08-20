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
            INNER JOIN cards c ON c.person_id = p.id
            WHERE p.status = 'active'
              AND c.status = 'active'
              AND c.programming_status = 'done'
              AND c.responsiva_status IN ('signed', 'legacy')
        ),
        'koneStock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'KONE'
              AND status = 'available'
              AND person_id IS NULL
        ),
        'p2000Stock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'P2000'
              AND status = 'available'
              AND person_id IS NULL
        ),
        'accessproStock', (
            SELECT COUNT(*)
            FROM cards
            WHERE type = 'AccessPRO'
              AND status = 'available'
              AND person_id IS NULL
        )
    );
$function$;

grant execute on function "public"."get_dashboard_stats"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_dashboard_stats"() from public;
