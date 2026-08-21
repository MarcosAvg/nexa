create table "public"."signed_documents" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "person_id"            uuid,
  "access_media_id"      uuid,
  "template_id"          uuid,
  "document_type"        text                     not null default 'responsiva',
  "content"              jsonb,
  "signature"            text                     not null,
  "legal_hash"           text,
  "legal_snapshot"       text,
  "created_at"           timestamp with time zone not null default now(),
  constraint "signed_documents_pkey" primary key ("id"),
  constraint "signed_documents_access_media_id_fkey" foreign key ("access_media_id") references public.access_media("id") on delete set null,
  constraint "signed_documents_person_id_fkey" foreign key ("person_id") references public.personnel("id") on delete set null,
  constraint "signed_documents_template_id_fkey" foreign key ("template_id") references public.document_templates("id")
);

alter table "public"."signed_documents" enable row level security;

create index idx_signed_documents_access_media_id on public.signed_documents using btree (access_media_id);
create index idx_signed_documents_person_id on public.signed_documents using btree (person_id);
create index idx_signed_documents_template_id on public.signed_documents using btree (template_id);

create policy "Signed documents viewable by authenticated"
  on "public"."signed_documents"
  for select
  to authenticated
  using (true);

create policy "Admins and operators insert signed documents"
  on "public"."signed_documents"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins delete signed documents"
  on "public"."signed_documents"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."signed_documents" to "authenticated";
