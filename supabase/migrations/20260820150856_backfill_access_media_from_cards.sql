-- Idempotent backfill: copy cards into access_media and access_assignments.
-- Existing tables and data are not modified. Re-runs are safe.

BEGIN;

WITH inserted_media AS (
  insert into "public"."access_media"
    ("media_type_id", "identifier", "status", "person_id", "programming_status", "responsiva_status", "legacy_card_id", "metadata")
  select
    t.id,
    c.folio,
    coalesce(c.status, 'available'),
    c.person_id,
    coalesce(c.programming_status, 'pending'),
    coalesce(c.responsiva_status, 'unsigned'),
    c.id,
    jsonb_build_object('legacy_type', c.type, 'legacy_folio', c.folio)
  from "public"."cards" c
  join "public"."access_media_types" t on t.legacy_key = c.type
  where not exists (select 1 from "public"."access_media" am where am.legacy_card_id = c.id)
  returning id, legacy_card_id
)
insert into "public"."migration_map" ("source_table", "source_id", "target_table", "target_id")
select 'cards', legacy_card_id::text, 'access_media', id::text
from inserted_media
on conflict on constraint "migration_map_source_target_key" do nothing;

WITH inserted_assignments AS (
  insert into "public"."access_assignments" ("person_id", "media_type_id", "legacy_card_id", "assigned_at")
  select
    c.person_id,
    t.id,
    c.id,
    coalesce(c.updated_at, now())
  from "public"."cards" c
  join "public"."access_media_types" t on t.legacy_key = c.type
  where c.person_id is not null
    and not exists (select 1 from "public"."access_assignments" aa where aa.legacy_card_id = c.id)
  returning id, legacy_card_id
)
insert into "public"."migration_map" ("source_table", "source_id", "target_table", "target_id")
select 'cards', legacy_card_id::text, 'access_assignments', id::text
from inserted_assignments
on conflict on constraint "migration_map_source_target_key" do nothing;

COMMIT;
