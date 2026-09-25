-- Índices faltantes para claves foráneas detectados por los advisors de Supabase.
--
-- 1) access_media_type_buildings.building_id: la PK compuesta empieza por
--    media_type_id, por lo que la FK de building_id no tiene índice de cobertura.
-- 2) cardless_registry.media_type_id: FK sin índice. Se crea solo si la columna
--    existe (el esquema declarativo puede no incluirla todavía).

create index if not exists idx_access_media_type_buildings_building_id
  on public.access_media_type_buildings using btree (building_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cardless_registry'
      and column_name = 'media_type_id'
  ) then
    create index if not exists idx_cardless_registry_media_type_id
      on public.cardless_registry using btree (media_type_id);
  end if;
end;
$$;
