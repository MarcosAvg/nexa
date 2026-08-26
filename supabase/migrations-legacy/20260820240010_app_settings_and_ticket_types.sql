-- Parámetros de negocio y catálogo de tipos de ticket.

BEGIN;

-- 1. Parámetros de la aplicación (antes en localStorage del cliente).
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

insert into public.app_settings ("key", "value") values
  ('coreTypesRequired', '2'),
  ('responsivaPickupDays', '7'),
  ('responsivaWarnDays', '5');

-- 2. Helper de lectura para SQL (vista y métricas).
create or replace function public.core_types_required()
  returns integer
  language sql
  stable
  set search_path to 'public'
  AS $function$
    SELECT COALESCE(
      (SELECT (value)::integer FROM public.app_settings WHERE key = 'coreTypesRequired'),
      2
    );
$function$;

grant execute on function "public"."core_types_required"() to "authenticated", "postgres", "service_role";
revoke all on function "public"."core_types_required"() from public;
revoke execute on function "public"."core_types_required"() from anon;

-- 3. Catálogo de tipos de ticket.
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

insert into public.ticket_types ("key", "name", "section", "color_variant", "sort_order") values
  ('programacion',        'Programación',           'general',     'amber',   1),
  ('firma_responsiva',    'Firma Responsiva',       'responsivas', 'emerald', 2),
  ('modificacion_datos',  'Modificación de datos',  'general',     'violet',  3),
  ('baja_persona',        'Baja de Persona',        'general',     'rose',    4),
  ('cobro',               'Cobro',                  'general',     'blue',    5),
  ('bloqueo',             'Bloqueo',                'general',     'rose',    6);

-- 4. Tabla de mapeo de la migración ya sin uso.
drop table if exists public.migration_map;

COMMIT;