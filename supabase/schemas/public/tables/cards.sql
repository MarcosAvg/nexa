create table "public"."cards" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "folio"              text                     not null,
  "type"               text                     not null,
  "status"             text                     default 'available'::text,
  "responsiva_status"  text                     default 'unsigned'::text,
  "programming_status" text                     default 'pending'::text,
  "person_id"          uuid,
  "updated_at"         timestamp with time zone default now(),
  constraint "cards_folio_type_key" unique (folio, type),
  constraint "cards_pkey" primary key (id),
  constraint "cards_person_id_fkey" foreign key (person_id) references public.personnel(id) on delete set null
);

alter table "public"."cards"
  enable row level security;

alter table "public"."cards"
  replica identity full;

create index idx_cards_folio on public.cards using btree (folio);

create index idx_cards_person_id on public.cards using btree (person_id);

create index idx_cards_prog_status on public.cards using btree (programming_status);

create index idx_cards_ready on public.cards using btree (person_id, status, programming_status, responsiva_status)
  where ((status = 'active'::text) AND (programming_status = 'done'::text) AND (responsiva_status = ANY (ARRAY['signed'::text, 'legacy'::text])));

create index idx_cards_resp_status on public.cards using btree (responsiva_status);

create index idx_cards_status on public.cards using btree (status);

create index idx_cards_type on public.cards using btree (type);

create trigger trigger_clean_floors_on_card_management
  after delete or update on public.cards
  for each row
  execute function public.clean_personnel_floors_on_card_change();

create trigger trigger_sync_access_media_from_card
  after insert or update or delete on public.cards
  for each row
  execute function public.sync_access_media_from_card();

create policy "Admins/Operators delete cards" on "public"."cards"
  for delete
  to PUBLIC
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins/Operators insert cards" on "public"."cards"
  for insert
  to PUBLIC
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins/Operators update cards" on "public"."cards"
  for update
  to PUBLIC
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Cards viewable by everyone" on "public"."cards"
  for select
  to PUBLIC
  using ((( select auth.role() as role) = 'authenticated'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."cards" to "authenticated", "postgres", "service_role";
