create table "public"."enlaces" (
  "id"         uuid                     not null default gen_random_uuid(),
  "person_id"  uuid                     not null,
  "extension"  text                     not null,
  "created_at" timestamp with time zone default now(),
  constraint "enlaces_person_id_key" unique (person_id),
  constraint "enlaces_pkey" primary key (id),
  constraint "enlaces_person_id_fkey" foreign key (person_id) references public.personnel(id) on delete cascade
);

alter table "public"."enlaces"
  enable row level security;

create index idx_enlaces_person_id on public.enlaces using btree (person_id);

create policy "Admins and operators delete enlaces" on "public"."enlaces"
  for delete
  to "authenticated"
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators insert enlaces" on "public"."enlaces"
  for insert
  to "authenticated"
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins and operators update enlaces" on "public"."enlaces"
  for update
  to "authenticated"
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))))
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Authenticated users view enlaces" on "public"."enlaces"
  for select
  to "authenticated"
  using (true);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."enlaces" to "authenticated", "postgres", "service_role";
