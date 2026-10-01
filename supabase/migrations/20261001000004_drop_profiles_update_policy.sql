-- Elimina la policy autorreferente de UPDATE en profiles.
--
-- "Admins update all profiles" contiene una subconsulta sobre la propia
-- tabla; combinada con la policy RESTRICTIVE "Active users only", el
-- planificador entra en expansión infinita (42P17) al evaluar UPDATEs.
-- Toda escritura a profiles pasa por RPCs SECURITY DEFINER
-- (set_user_role / set_user_active), así que los UPDATEs directos fallan
-- cerrado y limpio en lugar de recursionar.

BEGIN;

drop policy if exists "Admins update all profiles" on public.profiles;

COMMIT;
