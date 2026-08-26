-- Paso 1: identidad única del medio de acceso.
-- document_templates se vincula por FK a access_media_types (el texto legal
-- menciona el edificio, así que el vínculo natural es con el medio concreto).
-- Se elimina legacy_key de ambas tablas.

BEGIN;

alter table public.document_templates add column if not exists media_type_id uuid;

update public.document_templates dt
   set media_type_id = amt.id
  from public.access_media_types amt
 where dt.legacy_key is not null
   and upper(amt.key) = upper(dt.legacy_key);

create unique index if not exists idx_document_templates_media_type_id
  on public.document_templates (media_type_id) where (media_type_id is not null);

alter table public.document_templates drop constraint if exists document_templates_legacy_key_key;
alter table public.document_templates drop column if exists legacy_key;

alter table public.access_media_types drop constraint if exists access_media_types_legacy_key_key;
alter table public.access_media_types drop column if exists legacy_key;

COMMIT;