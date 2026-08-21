create table "public"."personnel" (
  "id"               uuid                     not null default gen_random_uuid(),
  "first_name"       text                     not null,
  "last_name"        text                     not null,
  "employee_no"      text,
  "email"            text,
  "area"             text,
  "position"         text,
  "dependency_id"    bigint,
  "building_id"      bigint,
  "floor"            text,
  "schedule_id"      bigint,
  "entry_time"       time without time zone,
  "exit_time"        time without time zone,
  "status"           text                     default 'active'::text,
  "photo_url"        text,
  "created_at"       timestamp with time zone default now(),
  "baja_at"          timestamp with time zone,
  "baja_reason"      text,
  "baja_type"        text,
  "baja_by"          uuid,
  constraint "personnel_baja_by_fkey" foreign key (baja_by) references auth.users(id) on delete set null,
  constraint "personnel_building_id_fkey" foreign key (building_id) references public.buildings(id),
  constraint "personnel_dependency_id_fkey" foreign key (dependency_id) references public.dependencies(id),
  constraint "personnel_employee_no_key" unique (employee_no),
  constraint "personnel_pkey" primary key (id),
  constraint "personnel_schedule_id_fkey" foreign key (schedule_id) references public.schedules(id)
);

alter table "public"."personnel"
  enable row level security;

alter table "public"."personnel"
  replica identity full;

create index idx_personnel_baja_by on public.personnel using btree (baja_by);

create index idx_personnel_building on public.personnel using btree (building_id);

create index idx_personnel_dependency on public.personnel using btree (dependency_id);

create index idx_personnel_employee_no on public.personnel using btree (employee_no);

create index idx_personnel_first_name on public.personnel using btree (first_name);

create index idx_personnel_last_name on public.personnel using btree (last_name);

create index idx_personnel_name on public.personnel using btree (first_name, last_name);

create index idx_personnel_schedule_id on public.personnel using btree (schedule_id);

create index idx_personnel_status on public.personnel using btree (status);

create trigger trigger_sync_personnel_access
  after insert or update or delete on public.personnel
  for each row
  execute function public.sync_personnel_access_to_assignments();

create policy "Admins/Operators delete personnel" on "public"."personnel"
  for delete
  to PUBLIC
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins/Operators insert personnel" on "public"."personnel"
  for insert
  to PUBLIC
  with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Admins/Operators update personnel" on "public"."personnel"
  for update
  to PUBLIC
  using ((exists ( select 1
   from public.profiles
  where ((profiles.id = ( select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

create policy "Personnel viewable by everyone" on "public"."personnel"
  for select
  to PUBLIC
  using ((( select auth.role() as role) = 'authenticated'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."personnel" to "authenticated", "postgres", "service_role";
