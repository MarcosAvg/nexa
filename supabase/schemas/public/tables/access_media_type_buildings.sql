-- Edificios donde aplica un tipo de medio: una misma tarjeta física sirve en
-- todos los edificios asignados (relación N:M).

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