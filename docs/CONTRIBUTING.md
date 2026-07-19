# Guía de Contribución — Nexa

> Todo lo que necesitas saber para contribuir al proyecto: configuración,
> arquitectura, estándares de código, patrones de refactorización y despliegue.

---

## Índice

1. [Configuración del Entorno](#1-configuración-del-entorno)
2. [Arquitectura del Proyecto](#2-arquitectura-del-proyecto)
3. [Base de Datos (Supabase)](#3-base-de-datos-supabase)
4. [Flujo de Trabajo con Git](#4-flujo-de-trabajo-con-git)
5. [Estándar de Comentarios](#5-estándar-de-comentarios)
6. [Patrones de Refactorización](#6-patrones-de-refactorización)
7. [Build & Despliegue](#7-build--despliegue)
8. [Testing](#8-testing)

---

## 1. Configuración del Entorno

### Requisitos

- **Node.js** 20+
- **npm** 10+
- Una cuenta en [Supabase](https://supabase.com) (o instancia local)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd nexa

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
```

Editar `.env` con los valores de tu proyecto de Supabase:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> ⚠️ **Nunca committees `.env`.** El archivo `.env.example` es la plantilla
> que sí debe committearse.

### Iniciar desarrollo

```bash
npm run dev
```

Esto inicia Vite en modo desarrollo (por defecto en `http://localhost:5173`).
El Service Worker de PWA también se genera en modo dev para que la
instalación funcione en localhost.

---

## 2. Arquitectura del Proyecto

### Árbol de directorios

```
src/
├── main.ts                        # Entry point de la app
├── App.svelte                     # Componente raíz
├── app.css                        # Estilos globales (Tailwind)
├── lib/
│   ├── supabase.ts                # Cliente de Supabase
│   ├── routes.ts                  # Definición de rutas
│   ├── schemas.ts                 # Esquemas Zod para validación
│   ├── components/                # Componentes Svelte
│   │   ├── modals/                # Modales de dominio específico
│   │   ├── import/                # Flujo de importación XLSX
│   │   ├── person-form/           # Formulario de persona (subcomponentes)
│   │   ├── ticket-detail/         # Detalle por tipo de ticket
│   │   ├── Badge.svelte           # Componentes reutilizables (raíz)
│   │   ├── Button.svelte
│   │   ├── Modal.svelte
│   │   └── ...
│   ├── views/                     # Vistas (páginas)
│   │   ├── PersonnelView.svelte
│   │   ├── CardsView.svelte
│   │   ├── TicketsView.svelte
│   │   ├── HistoryView.svelte
│   │   ├── DashboardView.svelte
│   │   ├── SettingsView.svelte
│   │   ├── EnlacesView.svelte
│   │   ├── RegistroSinTarjetaView.svelte
│   │   └── LoginView.svelte
│   ├── services/                  # Capa de acceso a datos (API)
│   ├── stores/                    # Estado global (Svelte 5 Runes)
│   ├── utils/                     # Utilidades y helpers
│   ├── constants/                 # Constantes del dominio
│   └── types/                     # Tipos compartidos
├── assets/                        # Imágenes, fuentes, etc.
scripts/
└── supabase_setup.sql             # Script completo de base de datos
```

### Capas y responsabilidades

| Capa | Rol | Ejemplo |
|---|---|---|
| **Views** | Orquestan UI + estado. Una vista por ruta. | `PersonnelView.svelte` |
| **Components** | UI reutilizable. Sin acceso directo a servicios. | `Badge.svelte`, `DataTable.svelte` |
| **Services** | Llamadas a Supabase. Devuelven datos tipados. | `personnel.ts`, `cards.ts` |
| **Stores** | Estado global con Svelte 5 Runes (`$state`). | `personnel.svelte.ts` |
| **Utils** | Helpers puros sin efectos secundarios. | `batchPaginate.ts`, `toastHelpers.ts` |

### Flujo de datos típico

```
Vista → Store.refresh() → Service.fetch() → Supabase
                                              ↓
Vista ← Store.$state    ← Service retorna datos
```

---

## 3. Base de Datos (Supabase)

### Esquema

El proyecto usa Supabase con PostgreSQL. Todas las tablas, funciones,
triggers, políticas RLS y permisos están en un solo script:

```
scripts/supabase_setup.sql
```

### Tablas principales

| Tabla | Propósito |
|---|---|
| `personnel` | Registro de personal operativo |
| `cards` | Tarjetas de acceso (P2000, KONE) |
| `tickets` | Solicitudes (altas, bajas, modificaciones, reportes) |
| `history_logs` | Auditoría de operaciones |
| `profiles` | Perfiles de usuario vinculados a `auth.users` |
| `signed_responsivas` | Responsivas digitales firmadas |
| `cardless_registry` | Registro de personal sin tarjeta |
| `enlaces` | Contactos administrativos con extensión |
| `buildings` | Catálogo de edificios |
| `dependencies` | Catálogo de dependencias |
| `schedules` | Catálogo de horarios |
| `special_accesses` | Catálogo de accesos especiales |

### Roles

- **admin** — acceso completo (CRUD)
- **operator** — CRUD en datos operativos, solo lectura en catálogos
- **viewer** — solo lectura

### Cómo ejecutar el setup

1. Abrir el **SQL Editor** de Supabase
2. Copiar el contenido de `scripts/supabase_setup.sql`
3. Ejecutar como usuario `postgres` o `service_role`
4. Configurar el trigger de nuevo usuario desde la UI:
   - **Authentication → Triggers → Create trigger**
   - Trigger: `on_auth_user_created`
   - Table: `auth.users`
   - Function: `public.handle_new_user()`
   - Event: `INSERT`

> El script es **idempotente** — se puede ejecutar múltiples veces sin errores.

---

## 4. Flujo de Trabajo con Git

### Ramas

- `main` — producción. Siempre estable.
- `dev` — integración de características (opcional).
- `feat/nombre` — nuevas funcionalidades.
- `fix/nombre` — correcciones de bugs.
- `refactor/nombre` — refactorizaciones sin cambio de comportamiento.

### Commits

Usa mensajes descriptivos en español:

```bash
git commit -m "feat: agregar exportación masiva por dependencia"
git commit -m "fix: corregir validación de folio duplicado"
git commit -m "refactor: extraer subcomponentes de ImportPreviewModal"
```

### Antes de hacer commit

```bash
npm run check          # Verificar tipos y sintaxis
npm run build          # Verificar que compile
```

---

## 5. Estándar de Comentarios

> Guía para escribir comentarios claros, consistentes y mantenibles
> en archivos `.ts` y `.svelte`.

### Principios Generales

1. **Comenta el \"por qué\", no el \"cómo\"**
   - ❌ `// Incrementar el contador en 1`
   - ✅ `// Se incrementa porque esta ruta puede ejecutarse múltiples veces antes de persistir`

2. **No comentes lo obvio**
   - ❌ `// Crear variable para almacenar el nombre`
   - ✅ Omite el comentario si el código es autoexplicativo.

3. **Sé conciso** — máximo 2-3 líneas por comentario inline.
4. **Usa español neutro** — tono técnico y profesional.

### Tipos de Comentarios

#### JSDoc para funciones exportadas

```typescript
/**
 * Busca personal activo por apellido y nombre.
 * Realiza una búsqueda case-insensitive en la base de datos.
 *
 * @param lastName  Apellido(s) de la persona.
 * @param firstName Nombre(s) de la persona.
 * @returns Lista de personas encontradas, o `[]` si no hay resultados.
 */
export async function searchPersonnel(
    lastName: string,
    firstName: string,
): Promise<Personnel[]> { ... }
```

#### Props de Svelte documentadas

```svelte
<script lang="ts">
    let {
        /** Controla si el modal está visible (two-way bindable). */
        isOpen = $bindable(false),
        /** Texto del botón de guardado. @default "Guardar" */
        saveLabel = "Guardar",
    }: { ... } = $props();
</script>
```

#### Separadores de sección

Solo en archivos largos (+200 líneas):

```typescript
// ─── Estado Global ────────────────────────────────────────────────
```

#### Comentarios inline

Solo para reglas de negocio, edge cases, workarounds:

```typescript
// Se usa 24h como TTL porque las plantillas no cambian más de una vez al día.
const CACHE_TTL = 24 * 60 * 60 * 1000;

// ⚠ svelte-spa-router requiere el helper wrap() para lazy loading.
import { wrap } from "svelte-spa-router/wrap";
```

#### TODO, FIXME, HACK

```typescript
// TODO: Centralizar este timeout en una constante compartida
// FIXME: Esta consulta falla cuando el usuario no tiene dependencia asignada
// HACK: Svelte 5 no soporta reactive Map, se usa objeto como workaround
```

### Lo que NO debe comentarse

- ❌ `let x = 5; // Declarar x con valor 5`
- ❌ Código muerto (eliminar el código directamente)
- ❌ Componentes genéricos autoexplicativos (Badge, Button, Input, etc.)

### Convenciones específicas

| Elemento | Estilo |
|---|---|
| Función exportada | JSDoc bloque (`/** ... */`) |
| Función privada | Inline o sin comentario si es obvia |
| Prop de componente | JSDoc inline (`/** ... */`) |
| Constante global | Inline corto |
| Sección larga | Separador Unicode (`// ───`) |
| TODO | `// TODO: razón` |
| Workaround | `// ⚠` o `// HACK:` |

---

## 6. Patrones de Refactorización

### 6.1 Extracción de Subcomponentes

Dividir componentes grandes (+500 líneas) en subcomponentes enfocados.

#### Cuándo aplicarlo

- El componente supera las **500 líneas**.
- Una sección es **visualmente independiente**.
- El mismo patrón de UI se repite.

#### Patrón de comunicación

Usar **`$bindable()`** para two-way binding y **callbacks** (`onX`) para acciones:

```svelte
<!-- Hijo: PersonFormLocation.svelte -->
<script lang="ts">
    let {
        edificio = $bindable(""),
        pisosP2000 = $bindable<string[]>([]),
        buildings = [] as CatalogItem[],
    }: { ... } = $props();
</script>
```

```svelte
<!-- Padre: PersonModal.svelte -->
<PersonFormLocation bind:edificio bind:pisosP2000 {buildings} />
```

#### Resultados de refactorización

| Archivo original | Líneas antes | Líneas después | Componentes extraídos |
|---|---|---|---|
| `ImportPreviewModal.svelte` | 1,415 | ~200 | 4 subcomponentes |
| `TicketImportedDetailsModal.svelte` | 870 | ~350 | 5 subcomponentes |
| `PersonModal.svelte` | 1,000 | ~550 | 4 subcomponentes |

### 6.2 Helper `withLoadingToast`

Estandariza el ciclo de vida de toasts para operaciones asíncronas.

**Ubicación:** `src/lib/utils/toastHelpers.ts`

```typescript
import { withLoadingToast } from "../utils/toastHelpers";

await withLoadingToast(
    "Preparando exportación...",   // loading
    "Exportación completada",      // success
    async () => {
        const data = await service.fetch();
        exportToExcel(data);
    },
    "Exportar Datos",              // contexto para errores
);
```

Con actualización de progreso:

```typescript
await withLoadingToast(
    "Preparando ZIP...",
    "ZIP descargado",
    async (update) => {
        await exportAllAsZip(deps, (_, __, label) => {
            update(`Procesando: ${label}`);
        });
    },
    "Exportar ZIP",
);
```

### 6.3 Modal CRUD Genérico (`CatalogItemModal`)

Elimina la duplicación de modales CRUD en `SettingsView.svelte`.

**Ubicación:** `src/lib/components/CatalogItemModal.svelte`

```svelte
<CatalogItemModal
    bind:isOpen={isBuildingModalOpen}
    title="Nuevo Edificio"
    bind:itemName={buildingName}
    onSave={handleSaveBuilding}
>
    <!-- snippet opcional para campos extra -->
</CatalogItemModal>
```

### 6.4 Estandarización de `isLoading` en Stores

Todos los stores exponen `isLoading` de la misma forma:

```typescript
export class TicketState {
    pendingItems = $state<Ticket[]>([]);
    isLoading = $state(false);

    async refresh() {
        this.isLoading = true;
        try {
            this.pendingItems = await service.fetch();
        } finally {
            this.isLoading = false;
        }
    }
}
```

**Stores que implementan este patrón:**

| Store | Archivo |
|---|---|
| `PersonnelState` | `stores/personnel.svelte.ts` |
| `TicketState` | `stores/tickets.svelte.ts` |
| `HistoryState` | `stores/history.svelte.ts` |
| `CardlessRegistryState` | `stores/cardlessRegistry.svelte.ts` |

### 6.5 Tipos Estrictos para Variants de Badge

```typescript
// ✅ Correcto: tipo unión concreto
export function getPersonnelStatusVariant(
    status: string,
): "emerald" | "amber" | "slate" | "rose" {
    if (status === PERSONNEL_STATUS.ACTIVO) return "emerald";
    if (status === PERSONNEL_STATUS.PARCIAL) return "amber";
    return "slate";
}

// ❌ Incorrecto: tipo genérico string
export function getPersonnelStatusVariant(status: string): string { ... }
```

### 6.6 Limpieza de `console.log`

| Tipo | ¿Conservar? |
|---|---|
| `console.log` de debug | ❌ Eliminar |
| `console.log` de startup | ❌ Eliminar |
| `console.warn` de fallo recuperable | ✅ Mantener |
| `console.error` de fallo crítico | ✅ Mantener |

### 6.7 Casting y Patrones Tipo con Supabase

```typescript
// unknown de Supabase → castear con as y String()
const newData = payload.new as Record<string, unknown>;
const name = String(newData.first_name ?? '');

// Spread de datos unknown → doble cast
const mapped = data.map(t => ({ ...t } as unknown as Ticket));

// Constructor de librería dinámica (ExcelJS, etc.)
const Workbook = ExcelJSModule.default || ExcelJSModule;
const workbook = new (Workbook as unknown as { new(): any })();

// Conteo filtrado — reutilizar la misma cadena de filtros
const buildQuery = (withCount = false) => {
    let q: any = supabase.from("tabla");
    if (withCount) {
        q = q.select("*", { count: "exact", head: true });
    } else {
        q = q.select("*, relaciones(*)");
    }
    // ... mismos filtros aquí ...
    return q;
};
const { data } = await buildQuery().range(from, to);
const { count } = await buildQuery(true);

// batchPaginate con Supabase → async wrapper + <any>
const items = await batchPaginate<any>(
    async (from, to) => {
        const { data, error } = await supabase
            .from("cards").select("*").range(from, to);
        return { data, error };
    },
    1000
);
```

---

## 7. Build & Despliegue

### Compilación para producción

```bash
npm run build
```

Genera los archivos estáticos en el directorio `dist/`. Esto incluye:

- Bundle de Svelte compilado y minificado
- Service Worker (workbox) para PWA
- Assets optimizados

### Vista previa del build

```bash
npm run preview
```

Sirve el contenido de `dist/` localmente para verificar antes de subir.

### Despliegue

El proyecto es una SPA estática (Vite build). Puede desplegarse en:

- **Supabase Storage** (hosting estático)
- **Vercel** / **Netlify** (conectar repo, build command: `npm run build`, output: `dist`)
- **Cloudflare Pages**
- Cualquier servidor web estático (Nginx, Apache)

> Asegúrate de que el servidor web tenga un fallback a `index.html`
> para que el routing del SPA funcione correctamente (Svelte SPA router).

---

## 8. Testing

El proyecto usa **Playwright** para tests E2E.

```bash
# Ejecutar tests
npx playwright test

# Con interfaz visual
npx playwright test --ui

# Ver reporte
npx playwright show-report
```

### Verificación de tipos y sintaxis

```bash
npm run check
```

Esto ejecuta `svelte-check` y `tsc` para verificar tipos en todo el proyecto.

---

*Última actualización: julio 2026*
