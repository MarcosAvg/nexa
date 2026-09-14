-- Dashboard: crecimiento de personal por rango de fechas.
-- Incremento = plantilla final - plantilla inicial (solo altas por ahora, vía created_at).
-- Porcentaje = incremento / plantilla inicial * 100 (null si inicial = 0).
-- Desglose por: totales, dependencia, edificio y piso (agrupado por edificio).

create or replace function public.get_dashboard_growth(
    p_start_date date default null,
    p_end_date date default null
)
  returns json
  language plpgsql
  stable
  set search_path to 'public', 'extensions'
  as $function$
declare
    v_start date;
    v_end date;
    v_min date;
    totals json;
    by_dependency json;
    by_building json;
    by_floor json;
begin
    select min(created_at)::date into v_min from personnel;
    v_end := coalesce(p_end_date, current_date);
    v_start := coalesce(p_start_date, v_min);

    select json_build_object(
        'initial', initial,
        'final', final,
        'increment', final - initial,
        'percent', case when initial = 0 then null else round((final - initial) * 100.0 / initial, 1) end
    )
    into totals
    from (
        select
            count(*) filter (where created_at < v_start) as initial,
            count(*) filter (where created_at < (v_end + interval '1 day')) as final
        from personnel
    ) t;

    select coalesce(json_agg(x order by x.sort_order, x.name), '[]'::json)
    into by_dependency
    from (
        select id, name, sort_order, initial, final,
               (final - initial) as increment,
               case when initial = 0 then null else round((final - initial) * 100.0 / initial, 1) end as percent
        from (
            select d.id, d.name, d.sort_order,
                   count(p.id) filter (where p.created_at < v_start) as initial,
                   count(p.id) filter (where p.created_at < (v_end + interval '1 day')) as final
            from dependencies d
            left join personnel p on p.dependency_id = d.id
            group by d.id, d.name, d.sort_order
        ) t
    ) x;

    select coalesce(json_agg(x order by x.sort_order, x.name), '[]'::json)
    into by_building
    from (
        select id, name, sort_order, initial, final,
               (final - initial) as increment,
               case when initial = 0 then null else round((final - initial) * 100.0 / initial, 1) end as percent
        from (
            select b.id, b.name, b.sort_order,
                   count(p.id) filter (where p.created_at < v_start) as initial,
                   count(p.id) filter (where p.created_at < (v_end + interval '1 day')) as final
            from buildings b
            left join personnel p on p.building_id = b.id
            group by b.id, b.name, b.sort_order
        ) t
    ) x;

    select coalesce(json_agg(x order by x."buildingSort", x."buildingName", x."floorSort", x.label), '[]'::json)
    into by_floor
    from (
        select "buildingId", "buildingName", "buildingSort", "floorId", label, "floorSort",
               initial, final,
               (final - initial) as increment,
               case when initial = 0 then null else round((final - initial) * 100.0 / initial, 1) end as percent
        from (
            select b.id as "buildingId", b.name as "buildingName", b.sort_order as "buildingSort",
                   fl.id as "floorId", fl.label as label, fl.sort_order as "floorSort",
                   count(p.id) filter (where p.created_at < v_start) as initial,
                   count(p.id) filter (where p.created_at < (v_end + interval '1 day')) as final
            from floors fl
            join buildings b on b.id = fl.building_id
            left join personnel p on p.building_id = fl.building_id
                 and lower(coalesce(p.floor, '')) = lower(coalesce(fl.label, ''))
            group by b.id, b.name, b.sort_order, fl.id, fl.label, fl.sort_order
        ) t
    ) x;

    return json_build_object(
        'startDate', v_start,
        'endDate', v_end,
        'minCreatedAt', v_min,
        'totals', totals,
        'byDependency', by_dependency,
        'byBuilding', by_building,
        'byFloor', by_floor
    );
end;
$function$;

grant execute on function "public"."get_dashboard_growth"(date, date) to "authenticated", "postgres", "service_role";
revoke all on function "public"."get_dashboard_growth"(date, date) from public;
