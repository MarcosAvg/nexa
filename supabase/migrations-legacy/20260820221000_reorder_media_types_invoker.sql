-- Alinear reorder_media_types con el patrón real de reorder_catalog
-- (SECURITY INVOKER): el reordenamiento depende de las políticas RLS de
-- access_media_types (solo admins), evitando una función SECURITY DEFINER
-- ejecutable por cualquier usuario autenticado.

BEGIN;

create or replace function public.reorder_media_types(p_ids uuid[])
returns void
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare
    i integer;
    n integer;
begin
    n := array_length(p_ids, 1);
    if n is null or n = 0 then
        return;
    end if;
    for i in 1 .. n loop
        update public.access_media_types set sort_order = i where id = p_ids[i];
    end loop;
end;
$function$;

grant execute on function "public"."reorder_media_types"(uuid[]) to "authenticated", "postgres", "service_role";

revoke all on function "public"."reorder_media_types"(uuid[]) from public;

COMMIT;