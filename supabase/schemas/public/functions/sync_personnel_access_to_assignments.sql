create or replace function public.sync_personnel_access_to_assignments()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
    v_person_id    uuid;
    v_building_id  bigint;
    v_floors_p2000 text[];
    v_floors_kone  text[];
    v_special      text[];
begin
    if TG_OP = 'DELETE' then
        return OLD; -- access_assignments cascade deletes permissions
    end if;

    v_person_id    := NEW.id;
    v_building_id  := NEW.building_id;
    v_floors_p2000 := NEW.floors_p2000;
    v_floors_kone  := NEW.floors_kone;
    v_special      := NEW.special_accesses;

    -- Skip when nothing access-related changed.
    if TG_OP = 'UPDATE'
       and NEW.floors_p2000 is not distinct from OLD.floors_p2000
       and NEW.floors_kone  is not distinct from OLD.floors_kone
       and NEW.special_accesses is not distinct from OLD.special_accesses
       and NEW.building_id is not distinct from OLD.building_id then
        return NEW;
    end if;

    if v_building_id is null then
        delete from "public"."access_assignment_permissions" p
        using "public"."access_assignments" aa
        where aa.id = p.assignment_id
          and aa.person_id = v_person_id
          and p.resource_type in ('floor', 'special_access');
        return NEW;
    end if;

    -- P2000 floors (base building)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'floor'
      and p.building_id = v_building_id
      and aa.media_type_id = (select id from public.access_media_types where key = 'p2000')
      and p.resource_key <> all (select public.normalize_floor_label(x) from unnest(v_floors_p2000) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'floor', public.normalize_floor_label(f.label), v_building_id
    from "public"."access_assignments" aa
    join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'p2000'
    cross join lateral unnest(v_floors_p2000) as f(label)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(f.label) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    -- KONE floors (base building)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'floor'
      and p.building_id = v_building_id
      and aa.media_type_id = (select id from public.access_media_types where key = 'kone')
      and p.resource_key <> all (select public.normalize_floor_label(x) from unnest(v_floors_kone) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'floor', public.normalize_floor_label(f.label), v_building_id
    from "public"."access_assignments" aa
    join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'kone'
    cross join lateral unnest(v_floors_kone) as f(label)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(f.label) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    -- Special accesses (one per active assignment, scoped to base building)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'special_access'
      and p.building_id = v_building_id
      and p.resource_key <> all (select x from unnest(v_special) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'special_access', sa.access_name, v_building_id
    from "public"."access_assignments" aa
    cross join lateral unnest(v_special) as sa(access_name)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(sa.access_name) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    return NEW;
end;
$function$;

grant execute on function public.sync_personnel_access_to_assignments() to postgres, service_role;

revoke all on function public.sync_personnel_access_to_assignments() from public;

revoke execute on function public.sync_personnel_access_to_assignments() from authenticated;

revoke execute on function public.sync_personnel_access_to_assignments() from anon;