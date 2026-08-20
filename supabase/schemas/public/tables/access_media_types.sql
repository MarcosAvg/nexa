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
