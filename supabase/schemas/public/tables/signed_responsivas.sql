create table "public"."signed_responsivas" (
  "id"             uuid                     not null default gen_random_uuid(),
  "person_id"      uuid,
  "folio"          text                     not null,
  "card_type"      text                     not null,
  "data"           jsonb                    not null,
  "signature"      text                     not null,
  "legal_hash"     text,
  "legal_snapshot" text,
  "created_at"     timestamp with time zone default now(),
  constraint "signed_responsivas_person_id_fkey" foreign key (person_id) references public.personnel(id) on delete cascade,
  constraint "signed_responsivas_pkey" primary key (id)
);

alter table "public"."signed_responsivas"
  enable row level security;

create index idx_signed_responsivas_person_id on public.signed_responsivas using btree (person_id);

create policy "Admins delete responsivas" on "public"."signed_responsivas"
  for delete
  to "authenticated"
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins/Operators insert responsivas" on "public"."signed_responsivas"
  for insert
  to PUBLIC
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Responsivas viewable" on "public"."signed_responsivas"
  for select
  to PUBLIC
  using ((( select auth.role() as role) = 'authenticated'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."signed_responsivas" to "authenticated", "postgres", "service_role";
