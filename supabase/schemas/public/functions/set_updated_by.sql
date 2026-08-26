-- Setea `updated_by` con el usuario autenticado al modificar una fila.
create or replace function "public"."set_updated_by"()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
begin
    if auth.uid() is not null then
        new.updated_by = auth.uid();
    end if;
    return new;
end;
$function$;
