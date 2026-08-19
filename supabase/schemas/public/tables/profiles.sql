create table "public"."profiles" (
  "id"         uuid                     not null,
  "email"      text,
  "full_name"  text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "avatar_url" text,
  constraint "profiles_email_key" unique (email),
  constraint "profiles_id_fkey" foreign key (id) references auth.users(id) on delete cascade,
  constraint "profiles_pkey" primary key (id)
);

alter table "public"."profiles"
  enable row level security;

alter table "public"."profiles"
  add column "role" public.app_role not null default 'viewer'::public.app_role;

create policy "Admins update all profiles" on "public"."profiles"
  for update
  to PUBLIC
  using ((exists ( select 1
   from public.profiles profiles_1
  where ((profiles_1.id = ( select auth.uid() as uid)) AND (profiles_1.role = 'admin'::public.app_role)))));

create policy "Profiles viewable by everyone" on "public"."profiles"
  for select
  to PUBLIC
  using ((( select auth.role() as role) = 'authenticated'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "authenticated", "postgres", "service_role";
