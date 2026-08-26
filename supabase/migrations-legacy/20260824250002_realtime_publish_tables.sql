-- Fase B: Realtime completo.
-- Publica en supabase_realtime las tablas mutables y usa REPLICA IDENTITY FULL
-- para que el payload Realtime incluya la fila completa (clave para hacer merge).

BEGIN;

DO $migration$
declare
    t text;
begin
    foreach t in array array[
        'personnel',
        'access_media',
        'access_assignments',
        'access_media_types',
        'cardless_registry',
        'document_templates',
        'dependencies',
        'buildings',
        'schedules',
        'special_accesses',
        'floors',
        'enlaces'
    ] loop
        execute format('alter publication supabase_realtime add table public.%I', t);
        execute format('alter table public.%I replica identity full', t);
    end loop;
end;
$migration$;

COMMIT;
