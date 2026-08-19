create or replace function public.clean_personnel_floors_on_card_change()
  returns trigger
  language plpgsql
  set search_path to 'public', 'extensions'
  AS $function$
BEGIN
    -- Si se eliminó una tarjeta o se cambió el person_id (desvinculación)
    IF (TG_OP = 'DELETE') OR (OLD.person_id IS NOT NULL AND (NEW.person_id IS NULL OR NEW.person_id <> OLD.person_id)) THEN

        -- Verificar si la persona aún tiene alguna tarjeta del mismo tipo
        IF NOT EXISTS (
            SELECT 1 FROM cards
            WHERE person_id = OLD.person_id
            AND type = OLD.type
            AND id <> OLD.id -- Excluir la que se está borrando o moviendo
        ) THEN
            -- Limpiar los pisos según el tipo
            IF OLD.type = 'P2000' THEN
                UPDATE personnel SET floors_p2000 = ARRAY[]::text[] WHERE id = OLD.person_id;
            ELSIF OLD.type = 'KONE' THEN
                UPDATE personnel SET floors_kone = ARRAY[]::text[] WHERE id = OLD.person_id;
            END IF;
        END IF;

    END IF;
    RETURN NULL;
END;
$function$;

grant execute on function "public"."clean_personnel_floors_on_card_change"() to "postgres", "service_role";

revoke all on function "public"."clean_personnel_floors_on_card_change"() from public;
