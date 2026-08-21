-- Migrate the remaining legacy responsivas that do not match a current card
-- (17 documented historical records plus any signed after the first backfill)
-- into signed_documents. access_media_id stays null: the record is preserved
-- in the new model without a live card link.

BEGIN;

insert into public.signed_documents
  (person_id, access_media_id, template_id, document_type, content, signature, legal_hash, legal_snapshot, legacy_responsiva_id, created_at)
select
  r.person_id,
  null,
  dt.id,
  'responsiva',
  r.data,
  r.signature,
  r.legal_hash,
  r.legal_snapshot,
  r.id,
  r.created_at
from public.signed_responsivas r
left join public.document_templates dt on dt.legacy_key = r.card_type
where not exists (select 1 from public.signed_documents sd where sd.legacy_responsiva_id = r.id);

insert into public.migration_map (source_table, source_id, target_table, target_id)
select 'signed_responsivas', r.id::text, 'signed_documents', sd.id::text
from public.signed_responsivas r
join public.signed_documents sd on sd.legacy_responsiva_id = r.id
on conflict on constraint migration_map_source_target_key do nothing;

COMMIT;