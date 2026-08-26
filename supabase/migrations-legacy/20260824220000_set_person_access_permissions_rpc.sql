-- Prioridad 3 #12: transaccionalidad.
-- Reescribe los permisos de acceso de una persona de forma ATÓMICA (delete +
-- insert en una sola transacción), evitando estados a medias si un insert falla.

BEGIN;

create or replace function public.set_person_access_permissions(p_person_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare
    r jsonb;
    v_assignment_id uuid;
    v_resource_type text;
    v_building_id bigint;
    v_floor_id bigint;
    v_special_access_id bigint;
begin
    -- Borra los permisos de todas las asignaciones activas de la persona.
    delete from public.access_assignment_permissions p
    using public.access_assignments a
    where a.id = p.assignment_id
      and a.person_id = p_person_id
      and a.status = 'active';

    -- Inserta las filas nuevas (resueltas por el cliente).
    for r in select * from jsonb_array_elements(p_rows) loop
        v_assignment_id  := (r ->> 'assignment_id')::uuid;
        v_resource_type  := r ->> 'resource_type';
        v_building_id    := (r ->> 'building_id')::bigint;
        v_floor_id       := nullif(r ->> 'floor_id', '')::bigint;
        v_special_access_id := nullif(r ->> 'special_access_id', '')::bigint;
        if v_assignment_id is null then
            continue;
        end if;
        insert into public.access_assignment_permissions
          (assignment_id, resource_type, permission, building_id, floor_id, special_access_id)
        values
          (v_assignment_id, v_resource_type, 'allow', v_building_id, v_floor_id, v_special_access_id);
    end loop;
end;
$function$;

grant execute on function "public"."set_person_access_permissions"(uuid, jsonb) to "authenticated";

revoke all on function "public"."set_person_access_permissions"(uuid, jsonb) from public;

COMMIT;