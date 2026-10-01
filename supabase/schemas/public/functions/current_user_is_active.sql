create or replace function public.current_user_is_active()
returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
  AS $function$
    select coalesce((select p.is_active from public.profiles p where p.id = auth.uid()), false)
$function$;

-- Se evalúa dentro de policies RLS (incluido rol anon): debe ser ejecutable
-- por todos para denegar limpio en vez de error de permisos.
grant execute on function "public"."current_user_is_active"() to public;
