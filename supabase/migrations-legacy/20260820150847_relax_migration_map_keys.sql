-- Relax migration_map so the same source row can map to multiple targets.
-- Also add a partial unique index to keep card-to-assignment backfill idempotent.

BEGIN;

alter table "public"."migration_map"
  drop constraint "migration_map_source_table_source_id_key";

alter table "public"."migration_map"
  add constraint "migration_map_source_target_key" unique ("source_table", "source_id", "target_table");

create unique index idx_access_assignments_legacy_card_id
  on "public"."access_assignments" ("legacy_card_id")
  where ("legacy_card_id" is not null);

COMMIT;
