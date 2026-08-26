-- Triggers BEFORE UPDATE que setean updated_at / updated_by en tablas con esas columnas.
-- Definiciones extraídas del estado real de la base (fuente de verdad).
-- Se usa `drop trigger if exists` antes de `create trigger` para que el script sea idempotente.

drop trigger if exists trg_access_assignments_set_updated_at on public.access_assignments;
create trigger trg_access_assignments_set_updated_at before update on public.access_assignments for each row execute function set_updated_at();

drop trigger if exists trg_access_assignments_set_updated_by on public.access_assignments;
create trigger trg_access_assignments_set_updated_by before update on public.access_assignments for each row execute function set_updated_by();

drop trigger if exists trg_access_media_types_set_updated_at on public.access_media_types;
create trigger trg_access_media_types_set_updated_at before update on public.access_media_types for each row execute function set_updated_at();

drop trigger if exists trg_access_media_types_set_updated_by on public.access_media_types;
create trigger trg_access_media_types_set_updated_by before update on public.access_media_types for each row execute function set_updated_by();

drop trigger if exists trg_buildings_set_updated_at on public.buildings;
create trigger trg_buildings_set_updated_at before update on public.buildings for each row execute function set_updated_at();

drop trigger if exists trg_buildings_set_updated_by on public.buildings;
create trigger trg_buildings_set_updated_by before update on public.buildings for each row execute function set_updated_by();

drop trigger if exists trg_cardless_registry_set_updated_at on public.cardless_registry;
create trigger trg_cardless_registry_set_updated_at before update on public.cardless_registry for each row execute function set_updated_at();

drop trigger if exists trg_cardless_registry_set_updated_by on public.cardless_registry;
create trigger trg_cardless_registry_set_updated_by before update on public.cardless_registry for each row execute function set_updated_by();

drop trigger if exists trg_dependencies_set_updated_at on public.dependencies;
create trigger trg_dependencies_set_updated_at before update on public.dependencies for each row execute function set_updated_at();

drop trigger if exists trg_dependencies_set_updated_by on public.dependencies;
create trigger trg_dependencies_set_updated_by before update on public.dependencies for each row execute function set_updated_by();

drop trigger if exists trg_document_templates_set_updated_at on public.document_templates;
create trigger trg_document_templates_set_updated_at before update on public.document_templates for each row execute function set_updated_at();

drop trigger if exists trg_document_templates_set_updated_by on public.document_templates;
create trigger trg_document_templates_set_updated_by before update on public.document_templates for each row execute function set_updated_by();

drop trigger if exists trg_enlaces_set_updated_at on public.enlaces;
create trigger trg_enlaces_set_updated_at before update on public.enlaces for each row execute function set_updated_at();

drop trigger if exists trg_enlaces_set_updated_by on public.enlaces;
create trigger trg_enlaces_set_updated_by before update on public.enlaces for each row execute function set_updated_by();

drop trigger if exists trg_floors_set_updated_at on public.floors;
create trigger trg_floors_set_updated_at before update on public.floors for each row execute function set_updated_at();

drop trigger if exists trg_floors_set_updated_by on public.floors;
create trigger trg_floors_set_updated_by before update on public.floors for each row execute function set_updated_by();

drop trigger if exists trg_personnel_set_updated_at on public.personnel;
create trigger trg_personnel_set_updated_at before update on public.personnel for each row execute function set_updated_at();

drop trigger if exists trg_personnel_set_updated_by on public.personnel;
create trigger trg_personnel_set_updated_by before update on public.personnel for each row execute function set_updated_by();

drop trigger if exists trg_schedules_set_updated_at on public.schedules;
create trigger trg_schedules_set_updated_at before update on public.schedules for each row execute function set_updated_at();

drop trigger if exists trg_schedules_set_updated_by on public.schedules;
create trigger trg_schedules_set_updated_by before update on public.schedules for each row execute function set_updated_by();

drop trigger if exists trg_special_accesses_set_updated_at on public.special_accesses;
create trigger trg_special_accesses_set_updated_at before update on public.special_accesses for each row execute function set_updated_at();

drop trigger if exists trg_special_accesses_set_updated_by on public.special_accesses;
create trigger trg_special_accesses_set_updated_by before update on public.special_accesses for each row execute function set_updated_by();

drop trigger if exists trg_tickets_set_updated_at on public.tickets;
create trigger trg_tickets_set_updated_at before update on public.tickets for each row execute function set_updated_at();

drop trigger if exists trg_tickets_set_updated_by on public.tickets;
create trigger trg_tickets_set_updated_by before update on public.tickets for each row execute function set_updated_by();
