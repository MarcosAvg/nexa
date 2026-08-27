-- Baja transaccional de persona con gestión de tarjetas.
-- Recibe el mapa de decisiones por tarjeta (card_id → 'delete' | 'keep') como
-- jsonb. En un solo paso atómico:
--   - tarjetas marcadas "delete"  → se eliminan.
--   - tarjetas marcadas "keep"    → se liberan al inventario (person_id = null,
--                                   disponibles, responsiva/programación reseteada).
--   - tarjetas no mencionadas     → se liberan al inventario (comportamiento base).
--   - revoca asignaciones activas, limpia tickets pendientes y marca la persona
--     como 'inactive'. Los datos de la persona se conservan.
create or replace function "public"."deactivate_person_with_cards"(
    p_person_id uuid,
    p_card_actions jsonb default null
)
 returns void
 language plpgsql
 security invoker
 set search_path to 'public', 'extensions'
as $function$
declare
    v_name text;
begin
    if p_person_id is null then
        raise exception 'Se requiere el id de la persona';
    end if;

    select coalesce(first_name || ' ' || last_name, 'Personal') into v_name
      from personnel
     where id = p_person_id;

    if p_card_actions is not null then
        -- Tarjetas a eliminar
        if exists (select 1 from jsonb_each_text(p_card_actions) where value = 'delete') then
            delete from access_media am
             using jsonb_each_text(p_card_actions) je
            where je.key = am.id::text
              and je.value = 'delete'
              and am.person_id = p_person_id;
        end if;

        -- Tarjetas a conservar → liberarlas al inventario
        if exists (select 1 from jsonb_each_text(p_card_actions) where value = 'keep') then
            update access_media am
               set person_id        = null,
                   status           = 'available',
                   programming_status = 'pending',
                   responsiva_status  = 'unsigned'
              from jsonb_each_text(p_card_actions) je
             where je.key = am.id::text
               and je.value = 'keep'
               and am.person_id = p_person_id;
        end if;
    end if;

    -- Cualquier otra tarjeta aún asignada a la persona → liberarla al inventario.
    update access_media
       set person_id        = null,
           status           = 'available',
           programming_status = 'pending',
           responsiva_status  = 'unsigned'
     where person_id = p_person_id and status <> 'inactive';

    -- Revocar asignaciones activas
    update access_assignments
       set status = 'revoked',
           revoked_at = now()
     where person_id = p_person_id and status = 'active';

    -- Limpiar tickets pendientes
    delete from tickets
     where person_id = p_person_id and status = 'pending';

    -- Conservar datos; solo cambiar estado
    update personnel set status = 'inactive' where id = p_person_id;

    insert into history_logs(entity_type, entity_id, entity_name, action, details, performed_by)
    values (
        'PERSONNEL',
        p_person_id::text,
        v_name,
        'DEACTIVATE',
        jsonb_build_object('message', 'Persona dada de baja', 'card_actions', p_card_actions),
        auth.uid()
    );
end;
$function$;
