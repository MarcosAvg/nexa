-- Fase D: auditoría de "quién editó".
-- Añade updated_by (uuid) a las tablas mutables y lo fija con auth.uid() en cada
-- UPDATE (complementa una posible columna updated_by de la persona/registro).

BEGIN;

-- Reutilizamos un trigger para fijar updated_by = auth.uid() en UPDATE.
-- La columna se añade a las mismas tablas mutables de la Fase A.
create or replace function public.set_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $function$
begin
    if auth.uid() is not null then
        new.updated_by = auth.uid();
    end if;
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
        execute format('alter table public.%I add column if not exists updated_by uuid', t);
        execute format(
            'drop trigger if exists trg_%I_set_updated_by on public.%I',
            t, t
        );
        execute format(
            'create trigger trg_%I_set_updated_by before update on public.%I for each row execute function public.set_updated_by()',
            t, t
        );
    end loop;
end;
$migration$;

COMMIT;
