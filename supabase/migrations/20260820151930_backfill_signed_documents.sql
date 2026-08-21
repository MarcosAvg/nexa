-- Idempotent backfill: copy signed responsivas into signed_documents,
-- linking them to access_media and templates. The 17 responsivas without a
-- matching card are intentionally left in the legacy table.

BEGIN;

insert into "public"."signed_documents"
  ("person_id", "access_media_id", "template_id", "document_type", "content", "signature", "legal_hash", "legal_snapshot", "legacy_responsiva_id", "created_at")
select
  r.person_id,
  am.id,
  dt.id,
  'responsiva',
  r.data,
  r.signature,
  r.legal_hash,
  r.legal_snapshot,
  r.id,
  r.created_at
from "public"."signed_responsivas" r
join "public"."cards" c on c.person_id = r.person_id and c.folio = r.folio and c.type = r.card_type
join "public"."access_media" am on am.legacy_card_id = c.id
join "public"."document_templates" dt on dt.legacy_key = r.card_type
where not exists (select 1 from "public"."signed_documents" sd where sd.legacy_responsiva_id = r.id);

insert into "public"."migration_map" ("source_table", "source_id", "target_table", "target_id")
select 'signed_responsivas', r.id::text, 'signed_documents', sd.id::text
from "public"."signed_responsivas" r
join "public"."signed_documents" sd on sd.legacy_responsiva_id = r.id
on conflict on constraint "migration_map_source_target_key" do nothing;

COMMIT;
