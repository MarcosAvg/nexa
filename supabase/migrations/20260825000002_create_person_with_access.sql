-- T4: Alta de persona atómica. Inserta persona + access_media + access_assignments
-- + access_assignment_permissions en UNA transacción (si algo falla, no queda nada
-- a medias). El plan de permisos llega resuelto por el cliente (Opción A) usando
-- `assignment_index` = posición de la tarjeta en p_media (0-based).

BEGIN;

create or replace function public.create_person_with_access(
    p_person jsonb,
    p_media jsonb,
    p_permissions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $function$
declare
    v_person_id uuid;
    v_media_id uuid;
    v_assignment_id uuid;
    v_assignment_ids uuid[];
    v_media_type uuid;
    v_identifier text;
    v_status text;
    v_prog text;
    v_resp text;
    v_perf jsonb;
    v_idx integer;
    v_n integer;
    v_i integer;
begin
    -- 1) Validar duplicado por nombre (mismo criterio que personnelService.save).
    if exists (
        select 1 from personnel
         where lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
             = lower(coalesce(p_person->>'first_name','') || ' ' || coalesce(p_person->>'last_name',''))
    ) then
        raise exception 'Ya existe una persona con ese nombre';
    end if;

    -- 2) Insertar persona.
    insert into personnel (
        first_name, last_name, employee_no, dependency_id, building_id, floor,
        email, area, position, schedule_id, entry_time, exit_time, status
    )
    values (
        p_person->>'first_name', p_person->>'last_name',
        nullif(p_person->>'employee_no', ''),
        nullif(p_person->>'dependency_id', '')::bigint,
        nullif(p_person->>'building_id', '')::bigint,
        p_person->>'floor',
        nullif(p_person->>'email', ''),
        p_person->>'area', p_person->>'position',
        nullif(p_person->>'schedule_id', '')::bigint,
        nullif(p_person->>'entry_time', ''),
        nullif(p_person->>'exit_time', ''),
        coalesce(p_person->>'status', 'active')
    )
    returning id into v_person_id;

    -- 3) Insertar tarjetas + asignaciones (una por medio) en el orden de p_media.
    v_n := jsonb_array_length(p_media);
    for v_i in 0 .. v_n - 1 loop
        v_media_type := (p_media->v_i->>'media_type_id')::uuid;
        v_identifier := coalesce(p_media->v_i->>'identifier', '');
        v_status := coalesce(p_media->v_i->>'status', 'active');
        v_prog := coalesce(p_media->v_i->>'programming_status', 'pending');
        v_resp := coalesce(p_media->v_i->>'responsiva_status', 'unsigned');

        insert into access_media (
            media_type_id, identifier, status, person_id,
            programming_status, responsiva_status
        )
        values (v_media_type, v_identifier, v_status, v_person_id, v_prog, v_resp)
        returning id into v_media_id;

        insert into access_assignments (
            person_id, media_type_id, access_media_id, status
        )
        values (v_person_id, v_media_type, v_media_id, 'active')
        returning id into v_assignment_id;

        -- Array Postgres es 1-based; guardamos en la posición v_i+1.
        v_assignment_ids[(v_i + 1)] := v_assignment_id;
    end loop;

    -- 4) Insertar permisos, resolviendo assignment_id por índice.
    v_n := jsonb_array_length(p_permissions);
    for v_i in 0 .. v_n - 1 loop
        v_perf := p_permissions->v_i;
        v_idx := coalesce((v_perf->>'assignment_index')::integer, -1);
        if v_idx >= 0 and v_idx + 1 <= cardinality(v_assignment_ids) and v_assignment_ids[v_idx + 1] is not null then
            insert into access_assignment_permissions (
                assignment_id, resource_type, building_id, floor_id, special_access_id, permission
            )
            values (
                v_assignment_ids[v_idx + 1],
                v_perf->>'resource_type',
                nullif(v_perf->>'building_id', '')::bigint,
                nullif(v_perf->>'floor_id', '')::bigint,
                nullif(v_perf->>'special_access_id', '')::integer,
                'allow'
            );
        end if;
    end loop;

    -- 5) Auditoría dentro de la transacción.
    insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by)
    values (
        'PERSONNEL', v_person_id::text,
        coalesce(p_person->>'first_name','') || ' ' || coalesce(p_person->>'last_name',''),
        'CREATE',
        jsonb_build_object('message', 'Alta de persona y accesos (RPC create_person_with_access)'),
        auth.uid()
    );

    return v_person_id;
end;
$function$;

COMMIT;
