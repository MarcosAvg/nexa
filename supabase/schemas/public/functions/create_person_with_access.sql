-- Alta atómica de persona + medios (crear o asignar existentes) + permisos.
-- Por cada elemento de p_media:
--   - si trae "id"  → ASIGNA la tarjeta existente del inventario (status 'available').
--   - si NO trae id → CREA la tarjeta nueva (valida folio único por medio).
create or replace function "public"."create_person_with_access"(p_person jsonb, p_media jsonb, p_permissions jsonb)
 returns uuid
 language plpgsql
 set search_path to 'public', 'extensions'
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
    v_id text;
    v_type_name text;
    v_person_name text;
    v_perf jsonb;
    v_idx integer;
    v_n integer;
    v_i integer;
    v_eno text;
    v_dupe boolean;
    v_existing_status text;
    v_constraint text;
    v_flow_id uuid;
begin
    if exists (
        select 1 from personnel
         where lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
             = lower(coalesce(p_person->>'first_name','') || ' ' || coalesce(p_person->>'last_name',''))
    ) then
        raise exception 'Ya existe una persona con ese nombre';
    end if;

    -- Pre-validación de número de empleado (único en personnel.employee_no).
    v_eno := nullif(btrim(coalesce(p_person->>'employee_no', '')), '');
    if v_eno is not null then
        select exists(select 1 from personnel where employee_no = v_eno) into v_dupe;
        if v_dupe then
            raise exception 'Ya existe una persona con el número de empleado %', v_eno;
        end if;
    end if;

    v_flow_id := gen_random_uuid();
    v_person_name := coalesce(p_person->>'first_name','') || ' ' || coalesce(p_person->>'last_name','');

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
        nullif(p_person->>'entry_time', '')::time,
        nullif(p_person->>'exit_time', '')::time,
        coalesce(p_person->>'status', 'active')
    )
    returning id into v_person_id;

    insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by, flow_id)
    values (
        'PERSONNEL', v_person_id::text, v_person_name, 'CREATE',
        jsonb_build_object('message', 'Alta de persona y accesos (RPC create_person_with_access)'),
        auth.uid(), v_flow_id
    );

    begin
        v_n := jsonb_array_length(p_media);
        for v_i in 0 .. v_n - 1 loop
            v_media_type := (p_media->v_i->>'media_type_id')::uuid;
            v_identifier := coalesce(p_media->v_i->>'identifier', '');
            v_status := coalesce(p_media->v_i->>'status', 'active');
            v_prog := coalesce(p_media->v_i->>'programming_status', 'pending');
            v_resp := coalesce(p_media->v_i->>'responsiva_status', 'unsigned');
            v_id := nullif(p_media->v_i->>'id', '');

            select name into v_type_name from access_media_types where id = v_media_type;

            if v_id is not null then
                -- Tarjeta existente: asignarla a la persona (solo si está libre/disponible).
                select status into v_existing_status from access_media where id = v_id::uuid and media_type_id = v_media_type;
                if v_existing_status is null then
                    raise exception 'La tarjeta del folio % no existe para ese medio', v_identifier;
                end if;
                if v_existing_status = 'available' then
                    update access_media
                       set person_id = v_person_id,
                           status = 'active',
                           programming_status = v_prog,
                           responsiva_status = v_resp
                     where id = v_id::uuid;
                    v_media_id := v_id::uuid;
                elsif v_existing_status = 'active' and exists (
                    select 1 from access_media where id = v_id::uuid and person_id = v_person_id
                ) then
                    -- Ya está asignada a esta persona (idempotente).
                    v_media_id := v_id::uuid;
                else
                    raise exception 'La tarjeta con folio % no está disponible para asignar', v_identifier;
                end if;
            else
                -- Crear nueva tarjeta con validación de folio único por medio.
                if v_identifier <> '' then
                    select exists(
                        select 1 from access_media
                         where media_type_id = v_media_type
                           and identifier = v_identifier
                    ) into v_dupe;
                    if v_dupe then
                        raise exception 'La tarjeta con folio % ya está registrada para ese medio', v_identifier;
                    end if;
                end if;

                insert into access_media (
                    media_type_id, identifier, status, person_id,
                    programming_status, responsiva_status
                )
                values (v_media_type, v_identifier, v_status, v_person_id, v_prog, v_resp)
                returning id into v_media_id;
            end if;

            insert into access_assignments (
                person_id, media_type_id, access_media_id, status
            )
            values (v_person_id, v_media_type, v_media_id, 'active')
            returning id into v_assignment_id;

            v_assignment_ids[(v_i + 1)] := v_assignment_id;

            insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by, flow_id)
            values (
                'CARD', v_media_id::text,
                coalesce(v_type_name, 'Tarjeta') || coalesce(' (Folio: ' || coalesce(v_identifier, '') || ')', ''),
                'CREATE',
                jsonb_build_object('message', 'Tarjeta ' || coalesce(v_identifier, '') || ' creada'),
                auth.uid(), v_flow_id
            );

            insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by, flow_id)
            values (
                'PERSON', v_person_id::text, v_person_name, 'ASSIGN_CARD',
                jsonb_build_object(
                    'message', 'Tarjeta ' || coalesce(v_identifier, '') || ' (' || coalesce(v_type_name, '') || ') asignada',
                    'related_card_id', v_media_id::text
                ),
                auth.uid(), v_flow_id
            );
        end loop;

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
                    nullif(v_perf->>'special_access_id', '')::bigint,
                    'allow'
                );
            end if;
        end loop;
    exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        raise exception 'No se pudo registrar: dato duplicado (%): %', v_constraint, sqlerrm;
    end;

    return v_person_id;
end;
$function$;

grant execute on function "public"."create_person_with_access"(jsonb, jsonb, jsonb) to "authenticated", "postgres", "service_role";
revoke all on function "public"."create_person_with_access"(jsonb, jsonb, jsonb) from public;
