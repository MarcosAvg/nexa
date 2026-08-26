-- Fase A: Optimistic locking.
-- Añade updated_at (timestamp) a las tablas mutables y un trigger BEFORE UPDATE
-- que lo actualiza. Permite al cliente detectar ediciones concurrentes
-- (if rowcount = 0 → conflicto).

BEGIN;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

DO $migration$
declare
    t text;
begin
    foreach t in array array[
        'personnel',
        'access_assignments',
        'tickets',
        'document_templates',
        'cardless_registry',
        'dependencies',
        'buildings',
        'schedules',
        'special_accesses',
        'access_media_types',
        'floors',
        'enlaces'
    ] loop
        execute format(
            'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
            t
        );
        execute format(
            'drop trigger if exists trg_%I_set_updated_at on public.%I',
            t, t
        );
        execute format(
            'create trigger trg_%I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
            t, t
        );
    end loop;
end;
$migration$;

COMMIT;
