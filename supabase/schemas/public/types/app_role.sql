create type "public"."app_role" as enum (
  'admin',
  'operator',
  'viewer'
);

grant usage on type "public"."app_role" to "postgres";
