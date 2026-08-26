-- Idempotent backfill: seed the global floors catalog and migrate
-- floors_p2000/floors_kone into access_assignment_permissions.
-- Existing personnel columns are preserved.

BEGIN;

create unique index idx_access_assignment_permissions_unique
  on "public"."access_assignment_permissions" ("assignment_id", "resource_type", "resource_key");

insert into "public"."floors" ("label", "sort_order")
select distinct x.label,
  case
    when lower(x.label) in ('sótano', 'sotano') then -2
    when lower(x.label) = 'planta baja' then -1
    when x.label ~ '^[0-9]+$' then x.label::int
    else 0
  end
from (
  select unnest(floors_p2000) as label from "public"."personnel"
  union
  select unnest(floors_kone) as label from "public"."personnel"
  union
  select unnest(floors) as label from "public"."buildings"
) x
where x.label is not null and btrim(x.label) <> ''
on conflict ("label") do nothing;

insert into "public"."access_assignment_permissions" ("assignment_id", "resource_type", "resource_key")
select aa.id, 'floor', f.label
from "public"."personnel" p
join "public"."access_assignments" aa on aa.person_id = p.id
join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'p2000'
join lateral unnest(coalesce(p.floors_p2000, '{}'::text[])) f(label) on true
where f.label is not null and btrim(f.label) <> ''
on conflict ("assignment_id", "resource_type", "resource_key") do nothing;

insert into "public"."access_assignment_permissions" ("assignment_id", "resource_type", "resource_key")
select aa.id, 'floor', f.label
from "public"."personnel" p
join "public"."access_assignments" aa on aa.person_id = p.id
join "public"."access_media_types" t on t.id = aa.media_type_id and t.key = 'kone'
join lateral unnest(coalesce(p.floors_kone, '{}'::text[])) f(label) on true
where f.label is not null and btrim(f.label) <> ''
on conflict ("assignment_id", "resource_type", "resource_key") do nothing;

COMMIT;
