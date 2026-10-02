-- Historial: claves de flujo paginadas en servidor.
-- Evita transferir todos los history_logs para paginar "por flujo" en el cliente.

create or replace function public.get_history_flows(
    p_person text default null,
    p_card_types text[] default null,
    p_folio text default null,
    p_actions text[] default null,
    p_start_date date default null,
    p_end_date date default null,
    p_page integer default 1,
    p_size integer default 50
)
  returns json
  language sql
  stable
  set search_path to 'public', 'extensions'
  as $function$
    with filtered as (
        select flow_id, timestamp, id
        from history_logs
        where (p_person is null or entity_name ilike '%' || p_person || '%')
          and (p_folio is null or entity_name ilike '%' || p_folio || '%')
          and (p_actions is null or p_actions = '{}'::text[] or action = any(p_actions))
          and (p_start_date is null or timestamp >= p_start_date::timestamp)
          and (p_end_date is null or timestamp < (p_end_date + interval '1 day'))
          and (
              p_card_types is null or p_card_types = '{}'::text[]
              or (entity_type = 'CARD' and exists (
                  select 1 from unnest(p_card_types) c where entity_name ilike c || '%'
              ))
          )
    ),
    flow_keys as (
        select flow_id::text as key, max(timestamp) as last, false as single
        from filtered where flow_id is not null group by flow_id
        union all
        select ('row-' || id) as key, timestamp as last, true as single
        from filtered where flow_id is null
    ),
    all_keys as (
        select key, last, single from flow_keys order by last desc
    ),
    page_keys as (
        select key, last, single from all_keys
        limit p_size offset (p_page - 1) * p_size
    )
    select json_build_object(
        'total', (select count(*) from all_keys),
        'keys', coalesce(
            (select json_agg(json_build_object('key', key, 'last', last, 'single', single)) from page_keys),
            '[]'::json
        )
    )
  $function$;

grant execute on function "public"."get_history_flows"(text, text[], text, text[], date, date, integer, integer) to "authenticated", "postgres", "service_role";
revoke all on function "public"."get_history_flows"(text, text[], text, text[], date, date, integer, integer) from public;
