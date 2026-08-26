-- U1: Cierre automático del ticket "Programación" cuando la tarjeta se programa.
-- handle_access_media_ticket_effects ahora elimina el ticket "Programación"
-- pendiente de la tarjeta al pasar programming_status a 'done' (flujo inteligente).

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

    if new.programming_status = 'done' then
        delete from tickets
         where access_media_id = new.id
           and type = 'Programación'
           and status = 'pending';
    end if;

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

    if new.responsiva_status = 'signed' then
        delete from tickets
         where access_media_id = new.id
           and type = 'Firma Responsiva'
           and status = 'pending';
    end if;

    return new;
end;
$function$;

COMMIT;
