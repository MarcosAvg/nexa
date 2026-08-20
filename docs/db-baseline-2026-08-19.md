# Production Database Baseline

Date: 2026-08-19
Project: `nexa`
Project ref: `mxvzusmmevvfnhnjgpzo`
Region: `us-west-2`
PostgreSQL: `17.6.1`

This document records the read-only inspection performed before the database
refactor. No production writes were executed during this inspection.

The live schema snapshot is now versioned declaratively under
`supabase/schemas/`. It was generated from the remote project with
`supabase db pull --declarative`; it contains schema definitions only, not
production rows or credentials. The generated `supabase/schemas/public/schema.sql`
is current and is intentionally retained as part of that declarative schema.

## Inventory

| Entity | Count |
|---|---:|
| `public.personnel` | 2,846 |
| `public.cards` | 5,219 |
| `public.signed_responsivas` | 885 |
| `public.tickets` | 36 |
| `public.history_logs` | 12,381 |
| `public.enlaces` | 29 |
| `public.cardless_registry` | 806 |
| `public.profiles` | 6 |
| `auth.users` | 6 |
| `storage.objects` | 0 |

## Access Media

| Type | Total |
|---|---:|
| KONE | 2,944 |
| P2000 | 2,275 |
| AccessPRO | 0 |

Of the 5,219 cards, 4,959 are assigned and 260 are unassigned. The existing
unique `(folio, type)` constraint has no duplicate groups.

## Responsivas

| Card type | Total |
|---|---:|
| KONE | 361 |
| P2000 | 524 |

All 885 records have a person. 868 match exactly one existing card by
`person_id + folio + type`; 17 do not match a current card and require an
explicit historical fallback during the later migration.

## Personnel and Catalogs

- 2,836 personnel records are `active`.
- 1 record is `blocked`.
- 9 records are `inactive`.
- 786 personnel records have no employee number.
- No duplicate non-empty employee numbers were found.
- All personnel records have a dependency, building, and schedule.
- The four buildings currently share the same 36-value floor array.
- The current model stores floors in `floors_p2000` and `floors_kone`.

## Current Public Tables and Views

Tables:

- `buildings`
- `cardless_registry`
- `cards`
- `dependencies`
- `enlaces`
- `history_logs`
- `personnel`
- `profiles`
- `schedules`
- `signed_responsivas`
- `special_accesses`
- `tickets`

Views:

- `cards_ordered`
- `personnel_with_status`

## Registered Migrations

Only these migrations are currently registered in Supabase:

- `20260424165523_add_offboarding_fields`
- `20260520195340_add_email_templates_table`
- `20260520195636_seed_email_templates`

The repository does not yet contain a complete `supabase/migrations` history
matching the live schema. This is schema drift and must be addressed before
the refactor is versioned as a reproducible project.

## Security Findings To Address Before Refactoring

Critical findings reported by Supabase advisors:

- `public.personnel_with_status` is a `SECURITY DEFINER` view.
- `public.cards_ordered` is a `SECURITY DEFINER` view.
- `get_dashboard_metrics()` is callable by `anon` and `authenticated`.
- `get_dashboard_stats()` is callable by `anon` and `authenticated`.
- `search_personnel_fuzzy(...)` is callable by `anon` and `authenticated`.
- `handle_new_user()` is callable by `anon` and `authenticated`.
- Authenticated users can delete rows from `signed_responsivas`.
- `enlaces` grants broad operations to authenticated users.
- Several functions have a mutable `search_path`.
- Leaked-password protection is disabled.

## Performance Findings To Address

Supabase advisors reported missing indexes on foreign keys for:

- `cardless_registry.dependency_id`
- `cardless_registry.recorded_by`
- `history_logs.performed_by`
- `personnel.baja_by`
- `personnel.schedule_id`
- `signed_responsivas.person_id`
- `tickets.created_by`

Unused indexes were also reported, but they will not be removed during the
initial repair phase.

## Refactor Constraints

The initial refactor must be additive and non-destructive:

- Do not drop tables or columns.
- Do not delete production data.
- Preserve legacy identifiers in every new relation.
- Validate permissions before changing policies.
- Keep old views and tables available until the new model is verified.
- Create reversible migrations for every production change.
