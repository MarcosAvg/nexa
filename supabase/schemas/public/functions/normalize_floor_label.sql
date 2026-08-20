create or replace function public.normalize_floor_label(p_label text)
returns text
language sql
immutable
set search_path to 'public', 'extensions'
as $function$
select case
    when lower(btrim(p_label)) in ('sotano', 'sótano') then 'Sótano'
    when lower(btrim(p_label)) in ('planta baja')      then 'Planta Baja'
    when lower(btrim(p_label)) = 'pb'                  then 'Planta Baja'
    else btrim(p_label)
end;
$function$;

grant execute on function public.normalize_floor_label(p_label text) to postgres, service_role;

revoke all on function public.normalize_floor_label(p_label text) from public;

revoke execute on function public.normalize_floor_label(p_label text) from authenticated;

revoke execute on function public.normalize_floor_label(p_label text) from anon;