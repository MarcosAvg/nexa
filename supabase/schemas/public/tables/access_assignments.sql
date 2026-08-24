create table "public"."access_assignments" (
  "id"              uuid                     not null default gen_random_uuid(),
  "person_id"       uuid                     not null,
  "media_type_id"   uuid                     not null,
  "access_media_id" uuid,
  "assigned_at"     timestamp with time zone not null default now(),
  "revoked_at"      timestamp with time zone,
  "status"          text                     not null default 'active',
  constraint "access_assignments_pkey" primary key ("id"),
  constraint "access_assignments_media_type_id_fkey" foreign key ("media_type_id") references public.access_media_types("id"),
  constraint "access_assignments_person_id_fkey" foreign key ("person_id") references public.personnel("id") on delete cascade,
  constraint "access_assignments_access_media_id_fkey" foreign key ("access_media_id") references public.access_media("id") on delete set null
);

alter table "public"."access_assignments" enable row level security;

create index idx_access_assignments_media_type_id on public.access_assignments using btree (media_type_id);
create index idx_access_assignments_person_id on public.access_assignments using btree (person_id);
create unique index idx_access_assignments_access_media_id on public.access_assignments using btree (access_media_id) where (access_media_id is not null);

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
