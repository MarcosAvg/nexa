create table "public"."app_settings" (
  "key"        text                     not null,
  "value"      jsonb                    not null,
  "updated_at" timestamp with time zone not null default now(),
  constraint "app_settings_pkey" primary key ("key")
);

alter table "public"."app_settings" enable row level security;

create policy "App settings viewable by authenticated"
  on "public"."app_settings"
  for select
  to authenticated
  using (true);

create policy "Admins update app settings"
  on "public"."app_settings"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins insert app settings"
  on "public"."app_settings"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."app_settings" to "authenticated";