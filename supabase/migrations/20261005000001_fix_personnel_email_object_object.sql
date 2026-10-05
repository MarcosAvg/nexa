-- Corrige correos importados como "[object Object]" (Excel convirtió un
-- hipervínculo/rich text a texto). Se dejan vacíos (NULL), que es el valor
-- canónico de "sin correo" en la base.
update public.personnel
set email = null
where email = '[object Object]';
