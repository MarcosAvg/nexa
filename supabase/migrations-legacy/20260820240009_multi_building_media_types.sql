-- Modelo multi-edificio: un tipo de medio es una entidad global que se asigna
-- a N edificios (una sola tarjeta física funciona en todos ellos).

BEGIN;

-- 1. Tabla puente N:M
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

-- 2. Canónico por clave = fila con menor building_id
create temp table tmp_canonical as
select key, (array_agg(id order by building_id))[1] as keep_id
from public.access_media_types
group by key;

create temp table tmp_remap as
select t.id as old_id, c.keep_id as new_id, t.building_id
from public.access_media_types t
join tmp_canonical c on c.key = t.key;

-- 3. Junction con todos los edificios originales (hacia el canónico)
insert into public.access_media_type_buildings (media_type_id, building_id)
select distinct r.new_id, r.building_id
from tmp_remap r;

-- 4. Re-puntar hijos del duplicado hacia el canónico
update public.access_media am
   set media_type_id = r.new_id
  from tmp_remap r
 where am.media_type_id = r.old_id
   and r.old_id <> r.new_id;

update public.access_assignments aa
   set media_type_id = r.new_id
  from tmp_remap r
 where aa.media_type_id = r.old_id
   and r.old_id <> r.new_id;

update public.document_templates dt
   set media_type_id = r.new_id
  from tmp_remap r
 where dt.media_type_id = r.old_id
   and r.old_id <> r.new_id;

-- 5. Eliminar filas duplicadas y la columna de edificio
delete from public.access_media_types t
using tmp_remap r
where t.id = r.old_id
  and r.old_id <> r.new_id;

drop index if exists access_media_types_building_key;
alter table public.access_media_types drop column if exists building_id;

COMMIT;