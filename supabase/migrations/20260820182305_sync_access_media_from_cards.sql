-- Keep the generic access media model in sync with legacy card writes.
-- The migration backfilled access_media / access_assignments once; this trigger
-- mirrors subsequent INSERT / UPDATE / DELETE on cards so both models stay
-- consistent transactionally, regardless of which client performs the write.

BEGIN;

create or replace function public.sync_access_media_from_card()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
    v_media_type_id uuid;
    v_media_id uuid;
begin
    if TG_OP = 'DELETE' then
        delete from public.access_media where legacy_card_id = OLD.id;
        update public.access_assignments
           set revoked_at = coalesce(revoked_at, now()), status = 'revoked'
         where legacy_card_id = OLD.id and status = 'active';
        return OLD;
    end if;

    select id into v_media_type_id
      from public.access_media_types
     where legacy_key = NEW.type;

    if v_media_type_id is null then
        return NEW;
    end if;

    if TG_OP = 'INSERT' then
        insert into public.access_media
          (media_type_id, identifier, status, person_id, programming_status, responsiva_status, legacy_card_id, metadata)
        values
          (v_media_type_id, NEW.folio, coalesce(NEW.status, 'available'), NEW.person_id,
           coalesce(NEW.programming_status, 'pending'), coalesce(NEW.responsiva_status, 'unsigned'),
           NEW.id, jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio))
        on conflict (legacy_card_id) do update
          set media_type_id = excluded.media_type_id,
              identifier = excluded.identifier,
              status = excluded.status,
              person_id = excluded.person_id,
              programming_status = excluded.programming_status,
              responsiva_status = excluded.responsiva_status,
              metadata = excluded.metadata,
              updated_at = now();
    else
        select id into v_media_id from public.access_media where legacy_card_id = NEW.id;
        if v_media_id is null then
            insert into public.access_media
              (media_type_id, identifier, status, person_id, programming_status, responsiva_status, legacy_card_id, metadata)
            values
              (v_media_type_id, NEW.folio, coalesce(NEW.status, 'available'), NEW.person_id,
               coalesce(NEW.programming_status, 'pending'), coalesce(NEW.responsiva_status, 'unsigned'),
               NEW.id, jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio));
        else
            update public.access_media
               set media_type_id = v_media_type_id,
                   identifier = NEW.folio,
                   status = coalesce(NEW.status, 'available'),
                   person_id = NEW.person_id,
                   programming_status = coalesce(NEW.programming_status, 'pending'),
                   responsiva_status = coalesce(NEW.responsiva_status, 'unsigned'),
                   metadata = jsonb_build_object('legacy_type', NEW.type, 'legacy_folio', NEW.folio),
                   updated_at = now()
             where id = v_media_id;
        end if;
    end if;

    -- Mantener el historial de asignaciones del modelo nuevo: una fila activa
    -- por tarjeta, reactivando la existente en reasignaciones (índice único
    -- parcial sobre legacy_card_id).
    if NEW.person_id is not null then
        insert into public.access_assignments (person_id, media_type_id, legacy_card_id, assigned_at)
        values (NEW.person_id, v_media_type_id, NEW.id, coalesce(NEW.updated_at, now()))
        on conflict (legacy_card_id) where legacy_card_id is not null do update
          set person_id = excluded.person_id,
              media_type_id = excluded.media_type_id,
              revoked_at = null,
              status = 'active';
    else
        update public.access_assignments
           set revoked_at = coalesce(revoked_at, now()), status = 'revoked'
         where legacy_card_id = NEW.id and status = 'active';
    end if;

    return NEW;
end;
$function$;

grant execute on function public.sync_access_media_from_card() to postgres, service_role;

revoke all on function public.sync_access_media_from_card() from public;

revoke execute on function public.sync_access_media_from_card() from authenticated;

revoke execute on function public.sync_access_media_from_card() from anon;

drop trigger if exists trigger_sync_access_media_from_card on public.cards;

create trigger trigger_sync_access_media_from_card
  after insert or update or delete on public.cards
  for each row execute function public.sync_access_media_from_card();

COMMIT;