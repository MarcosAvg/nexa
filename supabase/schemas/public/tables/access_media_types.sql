create table "public"."access_media_types" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "key"                  text                     not null,
  "name"                 text                     not null,
  "requires_programming" boolean                  not null default true,
  "requires_responsiva"  boolean                  not null default true,
  "has_floors"           boolean                  not null default false,
  "active"               boolean                  not null default true,
  "sort_order"           bigint,
  "created_at"           timestamp with time zone not null default now(),
  constraint "access_media_types_pkey" primary key ("id")
);

-- Edificios donde aplica el medio (un tipo sirve en N edificios con la misma tarjeta).
create table "public"."access_media_type_buildings" (
  "media_type_id" uuid  not null,
  "building_id"   bigint not null,
  constraint "access_media_type_buildings_pkey" primary key ("media_type_id", "building_id"),
  constraint "access_media_type_buildings_media_type_id_fkey" foreign key ("media_type_id") references public.access_media_types("id") on delete cascade,
  constraint "access_media_type_buildings_building_id_fkey" foreign key ("building_id") references public.buildings("id")
);

alter table "public"."access_media_type_buildings" enable row level security;

create policy "Media type buildings viewable by authenticated"
  on "public"."access_media_type_buildings"
  for select
  to authenticated
  using (true);

create policy "Admins insert media type buildings"
  on "public"."access_media_type_buildings"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins delete media type buildings"
  on "public"."access_media_type_buildings"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."access_media_type_buildings" to "authenticated";

create unique index access_media_types_building_key on public.access_media_types using btree (building_id, "key");

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
