-- Fase 3a: elimina las tablas legacy de tarjetas y responsivas, sus vistas y
-- triggers. La app ya escribe/lee access_media y signed_documents.

BEGIN;

drop trigger if exists trigger_sync_access_media_from_card on public.cards;
drop trigger if exists trigger_clean_floors_on_card_management on public.cards;

drop view if exists public.cards_ordered;

drop function if exists public.sync_access_media_from_card();
drop function if exists public.clean_personnel_floors_on_card_change();

drop table if exists public.cards;
drop table if exists public.signed_responsivas;

COMMIT;