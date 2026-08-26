-- Fase 5: RPC de búsqueda de personas (reduce round-trips de las búsquedas con
-- nombre, que hoy hacen 2 viajes: person_ids + tabla principal). Usa unaccent.

BEGIN;

create or replace function public.search_personnel_ids(p_search text)
returns setof uuid
language plpgsql
stable
security invoker
set search_path = public, extensions
as $function$
begin
    return query
        select p.id
          from personnel p
         where unaccent(lower(coalesce(p.first_name, ''))) ilike '%' || unaccent(lower(p_search)) || '%'
            or unaccent(lower(coalesce(p.last_name, '')))  ilike '%' || unaccent(lower(p_search)) || '%';
end;
$function$;

COMMIT;
