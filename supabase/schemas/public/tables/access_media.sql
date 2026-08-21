create table "public"."access_media" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "media_type_id"      uuid                     not null,
  "identifier"         text,
  "status"             text                     not null default 'available',
  "person_id"          uuid,
  "programming_status" text                     not null default 'pending',
  "responsiva_status"  text                     not null default 'unsigned',
  "metadata"           jsonb                    not null default '{}'::jsonb,
  "created_at"         timestamp with time zone not null default now(),
  "updated_at"         timestamp with time zone not null default now(),
  constraint "access_media_pkey" primary key ("id"),
  constraint "access_media_media_type_id_fkey" foreign key ("media_type_id") references public.access_media_types("id"),
  constraint "access_media_person_id_fkey" foreign key ("person_id") references public.personnel("id") on delete set null
);

alter table "public"."access_media" enable row level security;

create index idx_access_media_identifier on public.access_media using btree (identifier);
create index idx_access_media_media_type_id on public.access_media using btree (media_type_id);
create index idx_access_media_person_id on public.access_media using btree (person_id);
create unique index idx_access_media_identifier_type on public.access_media using btree (media_type_id, identifier) where (identifier is not null);

create policy "Access media viewable by authenticated"
  on "public"."access_media"
  for select
  to authenticated
  using (true);

create policy "Admins and operators insert access media"
  on "public"."access_media"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators update access media"
  on "public"."access_media"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators delete access media"
  on "public"."access_media"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

grant select, insert, update, delete on table "public"."access_media" to "authenticated";
