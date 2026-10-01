create or replace function public.current_user_is_active()
returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
  AS $function$
declare
    v_active boolean;
begin
    select p.is_active into v_active
    from public.profiles p
    where p.id = auth.uid();

    return coalesce(v_active, false);
end;
$function$;

-- Se evalúa dentro de policies RLS (incluido rol anon): debe ser ejecutable
-- por todos para denegar limpio en vez de error de permisos.
grant execute on function "public"."current_user_is_active"() to public;
