-- Fase 1: repuntar tickets al nuevo esquema access_media.
-- tickets.card_id referenciaba cards(id). Ahora referencia access_media(id).
-- El mapeo cards.id -> access_media.id se obtiene vía access_media.legacy_card_id.

BEGIN;

alter table public.tickets add column if not exists access_media_id uuid;

update public.tickets t
   set access_media_id = am.id
  from public.access_media am
 where am.legacy_card_id = t.card_id;

alter table public.tickets drop constraint if exists tickets_card_id_fkey;
alter table public.tickets drop column if exists card_id;

alter table public.tickets
  add constraint tickets_access_media_id_fkey
  foreign key (access_media_id) references public.access_media(id) on delete cascade;

create index if not exists idx_tickets_access_media_id on public.tickets using btree (access_media_id);

COMMIT;