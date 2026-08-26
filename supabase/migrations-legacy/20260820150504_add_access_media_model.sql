-- Additive migration: generic access media model.
-- Does not modify or delete existing tables, columns, or data.

BEGIN;

create table "public"."access_media_types" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "key"                  text                     not null,
  "name"                 text                     not null,
  "category"             text                     not null default 'card',
  "identifier_label"     text                     not null default 'Folio',
  "requires_identifier"  boolean                  not null default true,
  "requires_programming" boolean                  not null default true,
  "requires_responsiva"  boolean                  not null default true,
  "supports_replacement" boolean                  not null default true,
  "has_floors"           boolean                  not null default false,
  "active"               boolean                  not null default true,
  "legacy_key"           text,
  "sort_order"           bigint,
  "created_at"           timestamp with time zone not null default now(),
  constraint "access_media_types_key_key" unique ("key"),
  constraint "access_media_types_legacy_key_key" unique ("legacy_key"),
  constraint "access_media_types_pkey" primary key ("id")
);

alter table "public"."access_media_types" enable row level security;

create policy "Access media types viewable by authenticated"
  on "public"."access_media_types"
  for select
  to authenticated
  using (true);

create policy "Admins insert access media types"
  on "public"."access_media_types"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins update access media types"
  on "public"."access_media_types"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins delete access media types"
  on "public"."access_media_types"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."access_media_types" to "authenticated";

create table "public"."access_media" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "media_type_id"      uuid                     not null,
  "identifier"         text,
  "status"             text                     not null default 'available',
  "person_id"          uuid,
  "programming_status" text                     not null default 'pending',
  "responsiva_status"  text                     not null default 'unsigned',
  "legacy_card_id"     uuid,
  "metadata"           jsonb                    not null default '{}'::jsonb,
  "created_at"         timestamp with time zone not null default now(),
  "updated_at"         timestamp with time zone not null default now(),
  constraint "access_media_legacy_card_id_key" unique ("legacy_card_id"),
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

create table "public"."floors" (
  "id"         bigint generated by default as identity not null,
  "label"      text   not null,
  "sort_order" bigint,
  constraint "floors_label_key" unique ("label"),
  constraint "floors_pkey" primary key ("id")
);

alter table "public"."floors" enable row level security;

create policy "Floors viewable by authenticated"
  on "public"."floors"
  for select
  to authenticated
  using (true);

create policy "Admins insert floors"
  on "public"."floors"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins update floors"
  on "public"."floors"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins delete floors"
  on "public"."floors"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."floors" to "authenticated";

create table "public"."access_assignments" (
  "id"             uuid                     not null default gen_random_uuid(),
  "person_id"      uuid                     not null,
  "media_type_id"  uuid                     not null,
  "legacy_card_id" uuid,
  "assigned_at"    timestamp with time zone not null default now(),
  "revoked_at"     timestamp with time zone,
  "status"         text                     not null default 'active',
  constraint "access_assignments_pkey" primary key ("id"),
  constraint "access_assignments_media_type_id_fkey" foreign key ("media_type_id") references public.access_media_types("id"),
  constraint "access_assignments_person_id_fkey" foreign key ("person_id") references public.personnel("id") on delete cascade
);

alter table "public"."access_assignments" enable row level security;

create index idx_access_assignments_media_type_id on public.access_assignments using btree (media_type_id);
create index idx_access_assignments_person_id on public.access_assignments using btree (person_id);

create policy "Access assignments viewable by authenticated"
  on "public"."access_assignments"
  for select
  to authenticated
  using (true);

create policy "Admins and operators insert access assignments"
  on "public"."access_assignments"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators update access assignments"
  on "public"."access_assignments"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators delete access assignments"
  on "public"."access_assignments"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

grant select, insert, update, delete on table "public"."access_assignments" to "authenticated";

create table "public"."access_assignment_permissions" (
  "id"            bigint generated by default as identity not null,
  "assignment_id" uuid   not null,
  "resource_type" text   not null,
  "resource_key"  text   not null,
  "permission"    text   not null default 'allow',
  constraint "access_assignment_permissions_pkey" primary key ("id"),
  constraint "access_assignment_permissions_assignment_id_fkey" foreign key ("assignment_id") references public.access_assignments("id") on delete cascade
);

alter table "public"."access_assignment_permissions" enable row level security;

create index idx_access_assignment_permissions_assignment_id on public.access_assignment_permissions using btree (assignment_id);

create policy "Access assignment permissions viewable by authenticated"
  on "public"."access_assignment_permissions"
  for select
  to authenticated
  using (true);

create policy "Admins and operators insert access assignment permissions"
  on "public"."access_assignment_permissions"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators update access assignment permissions"
  on "public"."access_assignment_permissions"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators delete access assignment permissions"
  on "public"."access_assignment_permissions"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

grant select, insert, update, delete on table "public"."access_assignment_permissions" to "authenticated";

create table "public"."migration_map" (
  "id"           bigint generated by default as identity not null,
  "source_table" text                     not null,
  "source_id"    text                     not null,
  "target_table" text                     not null,
  "target_id"    text                     not null,
  "migrated_at"  timestamp with time zone not null default now(),
  constraint "migration_map_pkey" primary key ("id"),
  constraint "migration_map_source_table_source_id_key" unique ("source_table", "source_id")
);

alter table "public"."migration_map" enable row level security;

create policy "Migration map viewable by authenticated"
  on "public"."migration_map"
  for select
  to authenticated
  using (true);

grant select on table "public"."migration_map" to "authenticated";

-- Seed the access media types for the three existing card systems.
insert into "public"."access_media_types"
  ("key", "name", "category", "identifier_label", "requires_identifier", "requires_programming", "requires_responsiva", "supports_replacement", "has_floors", "active", "legacy_key", "sort_order")
values
  ('p2000', 'P2000', 'card', 'Folio', true, true, true, true, true, true, 'P2000', 1),
  ('kone', 'KONE', 'card', 'Folio', true, true, true, true, true, true, 'KONE', 2),
  ('accesspro', 'AccessPRO', 'card', 'Folio', true, true, true, true, false, true, 'AccessPRO', 3)
on conflict ("key") do nothing;

COMMIT;
