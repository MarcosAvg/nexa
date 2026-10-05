-- Permite asignar un enlace administrativo sin extensión telefónica.
alter table public.enlaces alter column extension drop not null;
