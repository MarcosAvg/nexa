create table "public"."ticket_types" (
  "key"          text                     not null,
  "name"         text                     not null,
  "section"      text                     not null default 'general',
  "color_variant" text                    not null default 'slate',
  "sort_order"   bigint,
  "active"       boolean                  not null default true,
  constraint "ticket_types_pkey" primary key ("key"),
  constraint "ticket_types_section_check" check (section in ('general', 'responsivas'))
);

alter table "public"."ticket_types" enable row level security;

create policy "Ticket types viewable by authenticated"
  on "public"."ticket_types"
  for select
  to authenticated
  using (true);

create policy "Admins insert ticket types"
  on "public"."ticket_types"
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins update ticket types"
  on "public"."ticket_types"
  for update
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))))
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

create policy "Admins delete ticket types"
  on "public"."ticket_types"
  for delete
  to authenticated
  using ((exists ( select 1
    from public.profiles
   where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = 'admin'::public.app_role)))));

grant select, insert, update, delete on table "public"."ticket_types" to "authenticated";