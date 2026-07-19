# Nexa — Control de Accesos

Plataforma para la gestión de accesos, personal operativo y auditoría de registros.

## Funcionalidades

- **Gestión de Personal**: Administración de expedientes y perfiles de usuario.
- **Control de Accesos**: Asignación y monitoreo de tarjetas físicas (P2000, KONE).
- **Sistema de Tickets**: Seguimiento de incidencias y tareas.
- **Reportes**: Generación de documentos en formato Excel y PDF.
- **Auditoría**: Registro detallado de movimientos e historial de cambios.

## Tecnologías

- **Frontend**: Svelte 5 (Runes)
- **Backend**: Supabase (PostgreSQL + RLS)
- **Estilos**: Tailwind CSS 4
- **Herramientas**: Vite, Lucide, Chart.js

## Inicio rápido

```bash
npm install
cp .env.example .env   # editar con tus credenciales de Supabase
npm run dev
```

## Documentación para desarrolladores

→ **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — guía completa con:

- Configuración del entorno y base de datos
- Arquitectura del proyecto (capas, flujo de datos)
- Setup de Supabase y esquema de base de datos
- Estándares de código y comentarios
- Patrones de refactorización
- Build, despliegue y testing

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Compilación para producción |
| `npm run preview` | Vista previa del build |
| `npm run check` | Verificación de tipos y sintaxis |
| `npx playwright test` | Tests E2E |

---
