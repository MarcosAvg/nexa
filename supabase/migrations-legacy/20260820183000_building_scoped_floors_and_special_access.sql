-- Building-scoped floors + special accesses in the new access model.
--
-- 1. floors become a per-building catalog (building_id + label)
-- 2. access_assignment_permissions gain a building dimension, so a person
--    based in one building can be granted access to floors of other buildings
-- 3. historical floor permissions are canonicalized and scoped to the
--    person's base building
-- 4. personnel.special_accesses migrate into access_assignment_permissions
-- 5. triggers keep the new model in sync with legacy writes

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: canonicalize floor labels (legacy had Sotano/SOTANO/Planta baja/PB…)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_floor_label(p_label text)
returns text
language sql
immutable
set search_path to 'public', 'extensions'
as $function$
select case
    when lower(btrim(p_label)) in ('sotano', 'sótano') then 'Sótano'
    when lower(btrim(p_label)) in ('planta baja')      then 'Planta Baja'
    when lower(btrim(p_label)) = 'pb'                  then 'Planta Baja'
    else btrim(p_label)
end;
$function$;

-- ---------------------------------------------------------------------------
-- 1. access_assignment_permissions: building dimension
-- ---------------------------------------------------------------------------
-- Drop the old unique index first so canonicalization cannot collide on it.
drop index if exists public.idx_access_assignment_permissions_unique;

alter table "public"."access_assignment_permissions"
  add column building_id bigint references public.buildings(id);

-- Canonicalize floor keys + scope historical permissions to the person's base
-- building (verified: every personnel row has building_id).
update "public"."access_assignment_permissions" p
   set resource_key = public.normalize_floor_label(p.resource_key),
       building_id  = per.building_id
  from "public"."access_assignments" aa
  join "public"."personnel" per on per.id = aa.person_id
 where aa.id = p.assignment_id
   and p.resource_type = 'floor';

-- Deduplicate rows that collapsed after canonicalization (keep lowest id).
delete from "public"."access_assignment_permissions" p
 using "public"."access_assignment_permissions" q
 where p.id > q.id
   and p.assignment_id = q.assignment_id
   and p.resource_type = q.resource_type
   and p.resource_key = q.resource_key
   and p.building_id is not distinct from q.building_id;

-- Floor permissions must always reference a building.
alter table "public"."access_assignment_permissions"
  add constraint access_assignment_permissions_floor_building_check
  check (resource_type <> 'floor' or building_id is not null);

-- New unique index including the building dimension.
create unique index idx_access_assignment_permissions_unique
  on "public"."access_assignment_permissions" (assignment_id, resource_type, resource_key, building_id);

create index idx_access_assignment_permissions_building
  on "public"."access_assignment_permissions" (building_id);

-- ---------------------------------------------------------------------------
-- 2. floors: per-building catalog
-- ---------------------------------------------------------------------------
alter table "public"."floors"
  add column building_id bigint references public.buildings(id);

alter table "public"."floors"
  drop constraint if exists floors_label_key;

create unique index idx_floors_building_label
  on "public"."floors" (building_id, label);

-- Seed a clean per-building catalog from each building's own floor list plus
-- any personnel floors belonging to people based in that building.
insert into "public"."floors" ("building_id", "label", "sort_order")
select distinct b.id, public.normalize_floor_label(x.label),
    case
        when lower(public.normalize_floor_label(x.label)) in ('sótano', 'sotano') then -2
        when lower(public.normalize_floor_label(x.label)) = 'planta baja'         then -1
        when public.normalize_floor_label(x.label) ~ '^[0-9]+$'                   then public.normalize_floor_label(x.label)::int
        else 0
    end as sort_order
from "public"."buildings" b
cross join lateral (
    select f.label
    from unnest(b.floors) as f(label)
    where btrim(f.label) <> ''
    union
    select pfl.label
    from "public"."personnel" p
    cross join lateral unnest(array_cat(coalesce(p.floors_p2000, '{}'::text[]), coalesce(p.floors_kone, '{}'::text[]))) as pfl(label)
    where p.building_id = b.id and btrim(pfl.label) <> ''
) x
where x.label is not null and btrim(x.label) <> ''
on conflict ("building_id", "label") do nothing;

-- Remove global-only rows left over from the pre-building model.
delete from "public"."floors" where building_id is null;

-- ---------------------------------------------------------------------------
-- 3. migrate special accesses into the permission model
--    (resource_type='special_access', scoped to the person's base building)
-- ---------------------------------------------------------------------------
insert into "public"."access_assignment_permissions"
  ("assignment_id", "resource_type", "resource_key", "building_id")
select aa.id, 'special_access', sa.access_name, per.building_id
from "public"."personnel" per
join "public"."access_assignments" aa on aa.person_id = per.id
cross join lateral unnest(coalesce(per.special_accesses, '{}'::text[])) as sa(access_name)
where btrim(sa.access_name) <> ''
on conflict ("assignment_id", "resource_type", "resource_key", "building_id") do nothing;

-- ---------------------------------------------------------------------------
-- 4. personnel trigger: keep base-building permissions in sync with legacy
--    floors_p2000/floors_kone/special_accesses columns (covers imports and
--    direct writes that bypass the app). Never touches other buildings.
-- ---------------------------------------------------------------------------
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

drop trigger if exists trigger_sync_personnel_access on public.personnel;

create trigger trigger_sync_personnel_access
  after insert or update or delete on public.personnel
  for each row
  execute function public.sync_personnel_access_to_assignments();

-- ---------------------------------------------------------------------------
-- 5. extend the card sync trigger so newly (re)activated assignments inherit
--    the person's base-building floors and special accesses
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
        insert into public.access_assignment_permissions
          (assignment_id, resource_type, resource_key, building_id)
        select aa.id, 'floor', public.normalize_floor_label(f.label), p.building_id
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
        select aa.id, 'special_access', sa.access_name, p.building_id
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

grant execute on function public.sync_access_media_from_card() to postgres, service_role;
revoke all on function public.sync_access_media_from_card() from public;
revoke execute on function public.sync_access_media_from_card() from authenticated;
revoke execute on function public.sync_access_media_from_card() from anon;

-- ---------------------------------------------------------------------------
-- 6. buildings trigger: keep the per-building floors catalog in sync with
--    buildings.floors, while preserving catalog rows still in use by
--    permissions (e.g. personnel-only floors like "13.14")
-- ---------------------------------------------------------------------------
create or replace function public.sync_building_floors_to_catalog()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
    if TG_OP = 'DELETE' then
        delete from public.floors where building_id = OLD.id;
        return OLD;
    end if;

    delete from public.floors f
     where f.building_id = NEW.id
       and f.label <> all (select public.normalize_floor_label(x) from unnest(NEW.floors) as t(x))
       and not exists (
            select 1 from public.access_assignment_permissions p
            where p.resource_type = 'floor'
              and p.building_id = NEW.id
              and p.resource_key = f.label
       );

    insert into public.floors (building_id, label, sort_order)
    select NEW.id, public.normalize_floor_label(f.label),
           case
             when lower(public.normalize_floor_label(f.label)) in ('sótano', 'sotano') then -2
             when lower(public.normalize_floor_label(f.label)) = 'planta baja'         then -1
             when public.normalize_floor_label(f.label) ~ '^[0-9]+$'                   then public.normalize_floor_label(f.label)::int
             else 0
           end
    from unnest(NEW.floors) as f(label)
    where btrim(f.label) <> ''
    on conflict (building_id, label) do update
      set sort_order = excluded.sort_order;

    return NEW;
end;
$function$;

grant execute on function public.sync_building_floors_to_catalog() to postgres, service_role;
revoke all on function public.sync_building_floors_to_catalog() from public;
revoke execute on function public.sync_building_floors_to_catalog() from authenticated;
revoke execute on function public.sync_building_floors_to_catalog() from anon;

drop trigger if exists trigger_sync_building_floors on public.buildings;

create trigger trigger_sync_building_floors
  after insert or update or delete on public.buildings
  for each row
  execute function public.sync_building_floors_to_catalog();

COMMIT;
