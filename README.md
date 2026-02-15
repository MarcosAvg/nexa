# Nexa - Control de Accesos

Plataforma para la gestión de accesos, personal operativo y auditoría de registros.

## Funcionalidades

- **Gestión de Personal**: Administración de expedientes y perfiles de usuario.
- **Control de Accesos**: Asignación y monitoreo de tarjetas físicas.
- **Sistema de Tickets**: Seguimiento de incidencias y tareas.
- **Reportes**: Generación de documentos en formato Excel y PDF.
- **Auditoría**: Registro detallado de movimientos e historial de cambios.

## Tecnologías

- **Frontend**: Svelte 5 (Runes)
- **Backend**: Supabase (PostgreSQL + RLS)
- **Estilos**: Tailwind CSS
- **Herramientas**: Vite, Lucide

## Configuración

1. Instalar dependencias: `npm install`
2. Configurar `.env`: Copiar `.env.example` y añadir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Iniciar desarrollo: `npm run dev`

## Scripts

- `npm run build`: Compilación para producción.
- `npm run check`: Verificación de sintaxis y tipos.

---
Nexa - Control de Accesos.
