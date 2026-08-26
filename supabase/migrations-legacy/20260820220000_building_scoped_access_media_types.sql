-- Building-scoped access media types.
--
-- access_media_types becomes a per-building catalog (which access media each
-- building operates). Historical data stays put: the three existing types are
-- re-scoped to the buildings that own their card systems and their media
-- instances remain untouched (1:1 with the legacy cards table during the
-- transition).
--
--   Torre Administrativa (1): P2000 + KONE   (holds all assigned floors/cards)
--   Pabellón Ciudadano   (2): P2000          (new-schema catalog, no legacy data)
--   Biblioteca Central   (3): AccessPRO
--   Palacio de Gobierno  (4): none
--
-- Pabellón's P2000 is created with legacy_key = NULL so legacy_key stays
-- globally unique and the cards sync trigger / responsiva lookups keep
-- resolving legacy cards to Torre (P2000/KONE) and Biblioteca (AccessPRO)
-- without changes.

BEGIN;

alter table "public"."access_media_types"
  add column building_id bigint;

update "public"."access_media_types"
   set building_id = case "key"
       when 'p2000' then 1
       when 'kone' then 1
       when 'accesspro' then 3
       else 1
   end
 where building_id is null;

alter table "public"."access_media_types"
  alter column building_id set not null;

alter table "public"."access_media_types"
  add constraint access_media_types_building_id_fkey
  foreign key (building_id) references public.buildings(id);

alter table "public"."access_media_types"
  drop constraint if exists access_media_types_key_key;

create unique index access_media_types_building_key
  on "public"."access_media_types" (building_id, "key");

-- Normalize per-building ordering.
update "public"."access_media_types"
   set sort_order = case "key" when 'p2000' then 1 when 'kone' then 2 else 1 end
 where "key" in ('p2000', 'kone');

update "public"."access_media_types" set sort_order = 1 where "key" = 'accesspro';

-- Pabellón Ciudadano operates a P2000 system with no legacy card backing.
insert into "public"."access_media_types"
  ("key", "name", "category", "identifier_label", "requires_identifier", "requires_programming", "requires_responsiva", "supports_replacement", "has_floors", "active", "legacy_key", "sort_order", "building_id")
select 'p2000', 'P2000', "category", "identifier_label", "requires_identifier", "requires_programming", "requires_responsiva", "supports_replacement", "has_floors", "active", null, 1, 2
from "public"."access_media_types"
where "key" = 'p2000' and "building_id" = 1
on conflict (building_id, "key") do nothing;

-- Reorder support for media types (uuid ids, unlike the bigint catalogs).
create or replace function public.reorder_media_types(p_ids uuid[])
returns void
language plpgsql
security definer
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