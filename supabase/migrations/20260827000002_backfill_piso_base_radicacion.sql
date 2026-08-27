-- Corrección: inyectar el piso base de radicación en los permisos de pisos.
-- Aplica la misma regla que applyBaseFloor del servicio: si la persona radica
-- en un edificio que gestiona medios con pisos y tiene una asignación activa
-- en ese edificio (medio con pisos que aplica al edificio), se agrega el
-- permiso del piso base si no existe ya.
with base_floor as (
  select f.building_id, f.id as floor_id, lower(f.label) as lbl
  from floors f
),
candidates as (
  select p.id as person_id, p.building_id, p.floor,
         bf.floor_id as base_floor_id,
         aa.id as assignment_id
  from personnel p
  join base_floor bf on bf.building_id = p.building_id and bf.lbl = lower(p.floor)
  join access_assignments aa on aa.person_id = p.id and aa.status = 'active'
  join access_media_types amt on amt.id = aa.media_type_id and amt.has_floors
  join access_media_type_buildings mtb on mtb.media_type_id = amt.id and mtb.building_id = p.building_id
  where p.building_id is not null and p.floor is not null and p.floor <> ''
)
insert into access_assignment_permissions (assignment_id, resource_type, permission, building_id, floor_id, special_access_id)
select c.assignment_id, 'floor', 'allow', c.building_id, c.base_floor_id, null
from candidates c
where not exists (
  select 1 from access_assignment_permissions pmp
  where pmp.assignment_id = c.assignment_id
    and pmp.resource_type = 'floor'
    and pmp.building_id = c.building_id
    and pmp.floor_id = c.base_floor_id
);
