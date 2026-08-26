# Seguridad — Nexa

## Reportar una vulnerabilidad

Apreciamos los reportes de seguridad responsables. Si descubres una vulnerabilidad, **no la publiques públicamente** en issues antes de que sea remediada.

Contacta de forma privada con el mantenimiento del proyecto. Incluye en lo posible:

- Descripción y alcance del problema.
- Pasos para reproducirlo.
- Código o configuración afectada y versión.
- Impacto potencial (datos a los que se accede, etc.).

## Alcance

Este proyecto es una aplicación web (Svelte + Supabase). La seguridad depende en gran parte de la configuración correcta de tu instancia (RLS de Supabase, claves en variables de entorno, etc.). Revisa la documentación de despliegue para asegurar una instalación segura.

> **Advertencia por código generado con IA.** Este proyecto fue desarrollado en
> gran parte con herramientas de IA generativa, que pueden introducir
> vulnerabilidades o configuraciones no ideales. **No se ofrece garantía de
> seguridad.** Al usar el proyecto en entornos productivos, audita:
> - Las políticas **RLS** y los permisos de roles (`anon`, `authenticated`, `service_role`).
> - Las **RPCs** expuestas y sus `grant execute` (no deben ser públicas si no aplica).
> - La configuración almacenada en `app_settings` (ajustes por instalación).
> - Las variables de entorno y la rotación de claves.

## Configuración segura recomendada

- **Nunca** subir `.env` ni claves reales al repositorio (están en `.gitignore`).
- Usar Supabase con **Row Level Security** habilitado (viene en el esquema).
- Restringir permisos de `anon`/`service_role` según lo que la app necesita.
- Mantener las migraciones y el esquema al día.

## Buenas prácticas de contribución

- No incluir credenciales, tokens ni datos personales reales en PRs.
- Al documentar, usa placeholders (p. ej. `TU_SUPABASE_URL`) en lugar de valores reales.
