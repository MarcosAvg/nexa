create or replace function public.core_types_required()
  returns integer
  language sql
  stable
  set search_path to 'public'
  AS $function$
    SELECT COALESCE(
      (SELECT CASE
         WHEN btrim(value::text, '"') ~ '^[0-9]+$' THEN btrim(value::text, '"')::integer
         ELSE NULL
       END
       FROM public.app_settings WHERE key = 'coreTypesRequired'),
      2
    );
$function$;

grant execute on function "public"."core_types_required"() to "authenticated", "postgres", "service_role";
revoke all on function "public"."core_types_required"() from public;
revoke execute on function "public"."core_types_required"() from anon;