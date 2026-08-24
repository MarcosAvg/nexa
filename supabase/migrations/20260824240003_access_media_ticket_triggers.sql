-- Fase 3: efectos derivados en access_media → triggers.
-- Centraliza en la BD la creación/eliminación de tickets (Programación/Firma
-- Responsiva) en cualquier escritura, incluyendo la "edición directa" que hoy
-- se salta estos efectos. Los triggers son idempotentes (solo crean un ticket
-- pendiente si no existe ya) para no duplicar.

BEGIN;

create or replace function public.handle_access_media_ticket_effects()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $function$
declare
    v_type_name text;
    v_requires_programming boolean;
    v_folio text := coalesce(new.identifier, '');
begin
    select t.name, coalesce(t.requires_programming, false)
      into v_type_name, v_requires_programming
      from access_media_types t
     where t.id = new.media_type_id;

    -- 1) Asignación de persona → ticket "Programación" (si el medio la requiere)
    if new.person_id is not null and v_requires_programming then
        if tg_op = 'INSERT'
           or (old.person_id is null and new.person_id is not null)
        then
            if not exists (
                select 1 from tickets
                 where access_media_id = new.id
                   and type = 'Programación'
                   and status = 'pending'
            ) then
                insert into tickets (type, title, description, priority, status, person_id, access_media_id, created_by, payload)
                values (
                    'Programación',
                    v_folio,
                    'Programar acceso para tarjeta ' || coalesce(v_type_name, '') || ' folio ' || v_folio,
                    'alta',
                    'pending',
                    new.person_id,
                    new.id,
                    auth.uid(),
                    '{}'::jsonb
                );
            end if;
        end if;
    end if;

    -- 2) programming_status -> 'done' y responsiva sin firmar → ticket "Firma Responsiva"
    if new.person_id is not null
       and new.programming_status = 'done'
       and coalesce(new.responsiva_status, 'unsigned') <> 'signed'
       and (tg_op = 'INSERT' or old.programming_status is distinct from 'done')
    then
        if not exists (
            select 1 from tickets
             where access_media_id = new.id
               and type = 'Firma Responsiva'
               and status = 'pending'
        ) then
            insert into tickets (type, title, description, priority, status, person_id, access_media_id, created_by, payload)
            values (
                'Firma Responsiva',
                'Firma: ' || v_folio,
                'Firma de responsiva para tarjeta ' || coalesce(v_type_name, '') || ' folio ' || v_folio,
                'media',
                'pending',
                new.person_id,
                new.id,
                auth.uid(),
                '{}'::jsonb
            );
        end if;
    end if;

    -- 3) responsiva firmada → limpiar tickets "Firma Responsiva" pendientes
    if new.responsiva_status = 'signed' then
        delete from tickets
         where access_media_id = new.id
           and type = 'Firma Responsiva'
           and status = 'pending';
    end if;

    return new;
end;
$function$;

drop trigger if exists trg_access_media_ticket_effects on public.access_media;

create trigger trg_access_media_ticket_effects
after insert or update of person_id, programming_status, responsiva_status
on public.access_media
for each row
execute function public.handle_access_media_ticket_effects();

COMMIT;
