-- =============================================================================
-- seed.sql — Datos base de CONFIGURACIÓN (sin datos de la organización).
--
-- Se aplica tras el esquema (schema_paths de config.toml) durante
-- `supabase db reset` o `npm run db:setup`.
--
-- Contenido:
--   * Medios de acceso base de ejemplo (catálogo de `access_media_types`).
--   * Ajustes de la instalación (`app_settings`).
-- No contiene personal, tarjetas ni datos de negocio: eso se carga por usuario.
-- =============================================================================

-- ─── Catálogo base de medios de acceso (ejemplo) ───────────────────────────
insert into public.access_media_types (key, name, requires_programming, requires_responsiva, has_floors, active, sort_order)
values
  ('p2000', 'P2000',     true,  true,  false, true, 1),
  ('kone',  'KONE',      true,  true,  true,  true,  2),
  ('accesspro', 'AccessPRO', true, true, false, true,  3)
on conflict (key) do nothing;

-- ─── Ajustes genéricos de la instalación ───────────────────────────────────
insert into public.app_settings (key, value)
values
  ('orgName',                jsonb '"Nexa"'),
  ('orgSupportEmail',        jsonb '"soporte@example.com"'),
  ('orgSupportExtension',    jsonb '"000"'),
  ('replacementCost',        jsonb '""'),
  ('responsivaPickupDays',   jsonb '7'),
  ('responsivaWarnDays',     jsonb '5'),
  ('coreTypesRequired',      jsonb '2')
on conflict (key) do nothing;
