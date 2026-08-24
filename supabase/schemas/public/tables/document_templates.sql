create table "public"."document_templates" (
  "id"            uuid                     not null default gen_random_uuid(),
  "key"           text                     not null,
  "name"          text                     not null,
  "document_type" text                     not null default 'responsiva',
  "version"       integer                  not null default 1,
  "active"        boolean                  not null default true,
  "media_type_id" uuid,
  "content"       text,
  "created_at"    timestamp with time zone not null default now(),
  constraint "document_templates_key_key" unique ("key"),
  constraint "document_templates_pkey" primary key ("id"),
  constraint "document_templates_media_type_id_fkey" foreign key ("media_type_id") references public.access_media_types("id") on delete set null
);

alter table "public"."document_templates" enable row level security;

create unique index idx_document_templates_media_type_id on public.document_templates using btree (media_type_id) where (media_type_id is not null);

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
