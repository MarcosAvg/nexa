-- Fase A: limpieza de restos de la migración legacy.
-- Normalización de etiquetas de piso ya no es usada por ningún flujo (los
-- pisos se guardan tal cual desde el catálogo de cada edificio).

drop function if exists public.normalize_floor_label(text);