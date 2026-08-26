-- Building-scoped special accesses.
--
-- 1. special_accesses becomes a per-building catalog (building_id NOT NULL).
-- 2. Historical floor/special-access permissions are re-scoped to Torre
--    Administrativa: currently all access assigned to personnel belongs to
--    Torre; other buildings only mark radicación (building + piso base).
-- 3. The personnel/card sync triggers scope access to Torre instead of the
--    person's base building, so no other building gets personnel assigned.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. special_accesses: per-building catalog
-- ---------------------------------------------------------------------------
alter table "public"."special_accesses"
  add column building_id bigint;

-- The three existing accesses belong to Torre Administrativa.
update "public"."special_accesses" set building_id = 1 where building_id is null;

alter table "public"."special_accesses"
  alter column building_id set not null;

alter table "public"."special_accesses"
  add constraint special_accesses_building_id_fkey
  foreign key (building_id) references public.buildings(id);

alter table "public"."special_accesses"
  drop constraint if exists special_accesses_name_key;

create unique index special_accesses_building_name
  on "public"."special_accesses" (building_id, name);

-- ---------------------------------------------------------------------------
-- 2. Re-scope historical permissions to Torre (no other building has
--    personnel assigned to its floors or special accesses)
-- ---------------------------------------------------------------------------
update "public"."access_assignment_permissions"
   set building_id = 1
 where resource_type in ('floor', 'special_access')
   and building_id is distinct from 1;

-- ---------------------------------------------------------------------------
-- 3. personnel trigger: sync access (floors + special accesses) to Torre
-- ---------------------------------------------------------------------------
create or replace function public.sync_personnel_access_to_assignments()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
    v_person_id       uuid;
    v_floors_p2000    text[];
    v_floors_kone     text[];
    v_special         text[];
    -- Por ahora todo el acceso asignado al personal es de Torre Administrativa.
    -- La radicación (building_id + floor) es solo de ubicación. Cuando se
    -- necesiten accesos a pisos de otros edificios se revisita esta función.
    v_access_building bigint := 1;
begin
    if TG_OP = 'DELETE' then
        return OLD; -- access_assignments cascade deletes permissions
    end if;

    v_person_id    := NEW.id;
    v_floors_p2000 := NEW.floors_p2000;
    v_floors_kone  := NEW.floors_kone;
    v_special      := NEW.special_accesses;

    -- Skip when nothing access-related changed.
    if TG_OP = 'UPDATE'
       and NEW.floors_p2000 is not distinct from OLD.floors_p2000
       and NEW.floors_kone  is not distinct from OLD.floors_kone
       and NEW.special_accesses is not distinct from OLD.special_accesses then
        return NEW;
    end if;

    -- Sin edificio de radicación => no hay acceso que sincronizar.
    if NEW.building_id is null then
        delete from "public"."access_assignment_permissions" p
        using "public"."access_assignments" aa
        where aa.id = p.assignment_id
          and aa.person_id = v_person_id
          and p.resource_type in ('floor', 'special_access');
        return NEW;
    end if;

    -- P2000 floors (Torre)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'floor'
      and p.building_id = v_access_building
      and aa.media_type_id = (select id from public.access_media_types where key = 'p2000')
      and p.resource_key <> all (select public.normalize_floor_label(x) from unnest(v_floors_p2000) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'floor', public.normalize_floor_label(f.label), v_access_building
    from "public"."access_assignments" aa
    join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'p2000'
    cross join lateral unnest(v_floors_p2000) as f(label)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(f.label) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    -- KONE floors (Torre)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'floor'
      and p.building_id = v_access_building
      and aa.media_type_id = (select id from public.access_media_types where key = 'kone')
      and p.resource_key <> all (select public.normalize_floor_label(x) from unnest(v_floors_kone) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'floor', public.normalize_floor_label(f.label), v_access_building
    from "public"."access_assignments" aa
    join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'kone'
    cross join lateral unnest(v_floors_kone) as f(label)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(f.label) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    -- Special accesses (one per active assignment, Torre)
    delete from "public"."access_assignment_permissions" p
    using "public"."access_assignments" aa
    where aa.id = p.assignment_id
      and aa.person_id = v_person_id
      and p.resource_type = 'special_access'
      and p.building_id = v_access_building
      and p.resource_key <> all (select x from unnest(v_special) as t(x));

    insert into "public"."access_assignment_permissions"
      (assignment_id, resource_type, resource_key, building_id)
    select aa.id, 'special_access', sa.access_name, v_access_building
    from "public"."access_assignments" aa
    cross join lateral unnest(v_special) as sa(access_name)
    where aa.person_id = v_person_id
      and aa.status = 'active'
      and btrim(sa.access_name) <> ''
    on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

    return NEW;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. card trigger: new/re-activated assignments inherit access scoped to Torre
-- ---------------------------------------------------------------------------
create or replace function public.sync_access_media_from_card()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
    v_media_type_id uuid;
    v_media_id uuid;
begin
    if TG_OP = 'DELETE' then
        delete from public.access_media where legacy_card_id = OLD.id;
        update public.access_assignments
           set revoked_at = coalesce(revoked_at, now()), status = 'revoked'
         where legacy_card_id = OLD.id and status = 'active';
        return OLD;
    end if;

    select id into v_media_type_id
      from public.access_media_types
     where legacy_key = NEW.type;

    if v_media_type_id is null then
        return NEW;
    end if;

    if TG_OP = 'INSERT' then
        insert into public.access_media
          (media_type_id, identifier, status, person_id, programming_status, responsiva_status, legacy_card_id, metadata)
        values
          (v_media_type_id, NEW.folio, coalesce(NEW.status, 'available'), NEW.person_id,
           coalesce(NEW.programming_status, 'pending'), coalesce(NEW.responsiva_status, 'unsigned'),
           NEW.id, jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio))
        on conflict (legacy_card_id) do update
          set media_type_id = excluded.media_type_id,
              identifier = excluded.identifier,
              status = excluded.status,
              person_id = excluded.person_id,
              programming_status = excluded.programming_status,
              responsiva_status = excluded.responsiva_status,
              metadata = excluded.metadata,
              updated_at = now();
    else
        select id into v_media_id from public.access_media where legacy_card_id = NEW.id;
        if v_media_id is null then
            insert into public.access_media
              (media_type_id, identifier, status, person_id, programming_status, responsiva_status, legacy_card_id, metadata)
            values
              (v_media_type_id, NEW.folio, coalesce(NEW.status, 'available'), NEW.person_id,
               coalesce(NEW.programming_status, 'pending'), coalesce(NEW.responsiva_status, 'unsigned'),
               NEW.id, jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio));
        else
            update public.access_media
               set media_type_id = v_media_type_id,
                   identifier = NEW.folio,
                   status = coalesce(NEW.status, 'available'),
                   person_id = NEW.person_id,
                   programming_status = coalesce(NEW.programming_status, 'pending'),
                   responsiva_status = coalesce(NEW.responsiva_status, 'unsigned'),
                   metadata = jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio),
                   updated_at = now()
             where id = v_media_id;
        end if;
    end if;

    if NEW.person_id is not null then
        insert into public.access_assignments (person_id, media_type_id, legacy_card_id, assigned_at)
        values (NEW.person_id, v_media_type_id, NEW.id, coalesce(NEW.updated_at, now()))
        on conflict (legacy_card_id) where legacy_card_id is not null do update
          set person_id = excluded.person_id,
              media_type_id = excluded.media_type_id,
              revoked_at = null,
              status = 'active';

        -- Inherit base-building floors + special accesses on the assignment
        -- (scoped to Torre Administrativa, building 1)
        insert into public.access_assignment_permissions
          (assignment_id, resource_type, resource_key, building_id)
        select aa.id, 'floor', public.normalize_floor_label(f.label), 1
        from public.access_assignments aa
        join public.personnel p on p.id = aa.person_id
        join public.access_media_types t on t.id = aa.media_type_id
        cross join lateral unnest(
            case when t.key = 'p2000' then coalesce(p.floors_p2000, '{}'::text[])
                 when t.key = 'kone'  then coalesce(p.floors_kone, '{}'::text[])
                 else '{}'::text[] end
        ) as f(label)
        where aa.legacy_card_id = NEW.id
          and p.building_id is not null
          and btrim(f.label) <> ''
        on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;

        insert into public.access_assignment_permissions
          (assignment_id, resource_type, resource_key, building_id)
        select aa.id, 'special_access', sa.access_name, 1
        from public.access_assignments aa
        join public.personnel p on p.id = aa.person_id
        cross join lateral unnest(coalesce(p.special_accesses, '{}'::text[])) as sa(access_name)
        where aa.legacy_card_id = NEW.id
          and p.building_id is not null
          and btrim(sa.access_name) <> ''
        on conflict (assignment_id, resource_type, resource_key, building_id) do nothing;
    else
        update public.access_assignments
           set revoked_at = coalesce(revoked_at, now()), status = 'revoked'
         where legacy_card_id = NEW.id and status = 'active';
    end if;

    return NEW;
end;
$function$;

COMMIT;