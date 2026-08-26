-- Fase C: refuerzo de RLS en tickets.
-- Antes cualquier usuario autenticado podía insertar tickets. Se restringe el
-- INSERT a admin/operator (los flujos que crean tickets ya son admin/operator y
-- los triggers se disparan en su contexto).

BEGIN;

drop policy if exists "Everyone insert tickets" on public.tickets;

create policy "Admins/Operators insert tickets"
  on public.tickets
  for insert
  to authenticated
  with check ((exists ( select 1
    from public.profiles
   where ((profiles.id = (select auth.uid() as uid)) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'operator'::public.app_role]))))));

COMMIT;
