-- Actualiza `updated_at` automáticamente al modificar una fila.
create or replace function "public"."set_updated_at"()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;
