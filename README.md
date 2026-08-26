<div align="center">

# Nexa — Control de Accesos y Gestión de Personal

[![CI](https://github.com/TU-USUARIO/nexa/actions/workflows/ci.yml/badge.svg)](https://github.com/TU-USUARIO/nexa/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/TU-USUARIO/nexa/pulls)

Plataforma web para el **control de accesos**, la administración de **personal operativo**,
el **control de inventario de tarjetas/medios de acceso** y la **auditoría** de movimientos.

Construida con **Svelte 5 (Runes)** sobre **Supabase** (PostgreSQL + Row Level Security),
como una PWA interactiva que genera reportes en Excel y PDF.

</div>

## ✨ Funcionalidades

- **Gestión de Personal** — expedientes, estados por edificio, actividades y accesos.
- **Control de Accesos** — medios de acceso (P2000, KONE, AccessPRO), inventario,
  asignación, reposición y desvinculación de tarjetas.
- **Sistema de Tickets** — programación, firma de responsivas, altas, bajas,
  modificaciones y reportes de falla.
- **Reportes** — exportación a **Excel** y **PDF** (plantillas por tipo de movimiento).
- **Auditoría** — historial granular de acciones agrupado por flujo.
- **Modularidad** — funcionalidades opcionales que se habilitan por instalación
  (p. ej. "Conteo de uso" y "Registro sin tarjeta") vía `app_settings`.

## 🧱 Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Svelte 5 (Runes), Vite, Lucide, Chart.js |
| Estilos | Tailwind CSS 4 |
| Backend / DB | Supabase (PostgreSQL 17 + RLS) |
| Datos | `@supabase/supabase-js`, `idb-keyval`, Zod |
| Reportes | ExcelJS, jsPDF, file-saver |
| Testing | Playwright (opcional), svelte-check, tsc |

## 🚀 Inicio rápido

### Requisitos

- **Node.js ≥ 20** y npm.
- (Opcional, recomendado) **Supabase CLI** para entorno local: `npm install -g supabase`.

### 1. Clonar e instalar

```bash
git clone https://github.com/TU-USUARIO/nexa.git
cd nexa
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` según el entorno que elijas
(ver siguiente sección).

### 3. Levantar la base de datos

**Opción A — Supabase local (CLI, gratis y sin datos):**

```bash
supabase start          # levanta Postgres + Auth + Storage
npm run db:setup        # aplica el esquema (supabase/schemas/**) + seed de configuración
```

**Opción B — Proyecto remoto (tu propia instancia en Supabase):**

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Ejecuta `supabase link --project-ref <TU_PROJECT_REF>` cuándo tengas la CLI.
3. Aplica el esquema: `supabase db push`.
4. Copia la URL y la **anon key** del proyecto a tu `.env`.

### 4. Arrancar la app

```bash
npm run dev
```

Abre `http://localhost:5173` y crea tu primer usuario (admin) desde la pantalla de login.

## ⚙️ Configuración de la organización

Los datos visuales/legales (nombre del sistema, correo de soporte, extensión,
costo de reposición, etc.) **no están hardcodeados**: se configuran en
**Configuración → Configuración de Responsiva** y se persisten en `app_settings`.
Por defecto son valores genéricos; ajústalos a tu organización.

## 📁 Estructura

```
src/
  lib/
    views/       # vistas por ruta (Dashboard, Personal, Tarjetas, Tickets…)
    components/  # componentes reutilizables (modales, tablas, badges…)
    services/    # capa de datos (Supabase + lógica de negocio)
    stores/      # estado global con Svelte 5 Runes
    utils/       # utilidades (exports Excel/PDF, formato, helpers)
    constants/   # constantes de dominio y de apariencia
    modules/     # definiciones y módulos compilados (VITE_MODULES)
supabase/
  schemas/       # DEFINICIONES declarativas del esquema (fuente de verdad)
  seed.sql       # datos base de configuración (sin datos de la org)
  migrations-legacy/  # historial previo (no aplicable a un clon limpio)
```

## 🧪 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (PWA) |
| `npm run preview` | Vista previa del build |
| `npm run check` | Verificación de tipos (svelte-check + tsc) |
| `npm run format` / `npm run format:check` | Formateo con Prettier |
| `npm run test` | Tests E2E (Playwright; se auto-skip sin credenciales) |
| `npm run db:setup` / `npm run db:reset` | Bootstrap del esquema vía CLI de Supabase |

## ⚠️ Aviso y descargo de responsabilidad

> **Proyecto generado con IA generativa.** Gran parte de este código fue
> desarrollado con la ayuda de herramientas de IA. Aunque se ha revisado y
> probado, la IA puede introducir errores, patrones inusuales o decisiones no
> convencionales.
>
> **No se ofrece garantía alguna** de funcionamiento, seguridad, idoneidad ni
> integridad. El uso del proyecto es bajo tu propia responsabilidad.
>
> Recomendaciones antes de usarlo con datos reales:
> - Realiza **copias de seguridad** de tu base de datos y revisa/migra el
>   esquema con cuidado.
> - Audita la configuración de seguridad (RLS, permisos de roles, `app_settings`).
> - Prueba los flujos en un entorno de pruebas.
>
> El autor y los mantenedores **no se hacen responsables** de pérdida de datos,
> daños, ni del mal uso que se le dé al proyecto.

## 🤝 Contribuciones

Nos encantan las contribuciones. Antes de empezar revisa:

- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — guía completa (setup, arquitectura, base de datos, estándares).
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`SECURITY.md`](SECURITY.md) — cómo reportar vulnerabilidades.

Toda contribución debe pasar `npm run check` y `npm run build`.

## 📄 Licencia

MIT — consulta [`LICENSE`](LICENSE).
