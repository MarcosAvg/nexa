-- Additive migration: document templates and signed documents.
-- Existing tables and data are not modified.

BEGIN;

create table "public"."document_templates" (
  "id"            uuid                     not null default gen_random_uuid(),
  "key"           text                     not null,
  "name"          text                     not null,
  "document_type" text                     not null default 'responsiva',
  "version"       integer                  not null default 1,
  "active"        boolean                  not null default true,
  "legacy_key"    text,
  "content"       text,
  "created_at"    timestamp with time zone not null default now(),
  constraint "document_templates_key_key" unique ("key"),
  constraint "document_templates_legacy_key_key" unique ("legacy_key"),
  constraint "document_templates_pkey" primary key ("id")
);

alter table "public"."document_templates" enable row level security;

create policy "Document templates viewable by authenticated"
  on "public"."document_templates"
  for select
  to authenticated
  using (true);

create policy "Admins insert document templates"
  on "public"."document_templates"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins update document templates"
  on "public"."document_templates"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins delete document templates"
  on "public"."document_templates"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."document_templates" to "authenticated";

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
  "legacy_responsiva_id" uuid,
  "created_at"           timestamp with time zone not null default now(),
  constraint "signed_documents_legacy_responsiva_id_key" unique ("legacy_responsiva_id"),
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

-- Seed templates for the three existing card systems.
insert into "public"."document_templates" ("key", "name", "document_type", "legacy_key")
values
  ('responsiva_p2000', 'Carta Responsiva P2000', 'responsiva', 'P2000'),
  ('responsiva_kone', 'Carta Responsiva KONE', 'responsiva', 'KONE'),
  ('responsiva_accesspro', 'Carta Responsiva AccessPRO', 'responsiva', 'AccessPRO')
on conflict ("key") do nothing;

COMMIT;
