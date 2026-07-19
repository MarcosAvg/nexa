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
9. [Tipos, Constantes y Schemas](#610-tipos-compartidos-types)
10. [Application Shell](#613-application-shell)
11. [Vistas](#614-vistas-páginas)
12. [Documentación de Componentes Extendida](#615-referencia-rápida-docscomponentesmd)

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
│   │   ├── index.ts               # Barrel raíz (exporta todos)
│   │   ├── modals/                # Modales de dominio específico
│   │   │   └── index.ts           # Barrel de modales
│   │   ├── catalogs/              # Catálogos (Settings)
│   │   │   └── index.ts           # Barrel de catálogos
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

### 6.7 Stores (Estado Global con Svelte 5 Runes)

> Todos los stores usan clases con `$state` de Svelte 5 (Runes).
> Se exportan como instancias singleton (`export const store = new StoreClass()`).
> Las vistas los importan directamente y Svelte maneja la reactividad.

#### `personnelState` — Estado de Personal

**Ubicación:** `src/lib/stores/personnel.svelte.ts`

```typescript
import { personnelState } from "../stores";

// Estado reactivo
personnelState.personnel           // Person[] — lista actual
personnelState.personnelOptions    // opciones ligeras para selects
personnelState.totalRecords        // número total (para paginación)
personnelState.currentPage         // página actual
personnelState.pageSize            // registros por página (50)
personnelState.isLoading           // flag de carga
personnelState.searchQuery         // query de búsqueda actual
personnelState.statusFilter        // filtro de estado activo
personnelState.dependencyId        // filtro de dependencia activo
personnelState.buildingId          // filtro de edificio activo

// Selección y edición
personnelState.selectedPersonId    // ID de persona seleccionada
personnelState.isDetailsOpen       // panel de detalles abierto
personnelState.editingPerson       // persona siendo editada
personnelState.isEditModalOpen     // modal de edición abierto
personnelState.highlightedCardId   // tarjeta resaltada (desde tickets)
personnelState.extraCards          // tarjetas disponibles en inventario

// Dashboard
personnelState.dashboardStats      // { activePersonnel, koneStock, p2000Stock }
personnelState.dashboardMetrics    // DashboardMetrics (statusCounts, cardCoverage, etc.)
personnelState.metricsLoading      // flag de carga de métricas

// Métodos
personnelState.setPersonnel(data, count);     // reemplazar lista
personnelState.setPersonnelOptions(options);   // reemplazar opciones

personnelState.refresh(page, search, status, depId, bldgId);
personnelState.nextPage();
personnelState.prevPage();
personnelState.goToPage(page);
personnelState.search(query);
personnelState.filter(status, depId, bldgId);

personnelState.selectPerson(id);
personnelState.setDetailsOpen(bool);
personnelState.openEditModal(person);
personnelState.closeEditModal();
personnelState.setCards(cards);

personnelState.refreshDashboardStats();
personnelState.refreshDashboardMetrics();
personnelState.initRealtime();  // suscripción a cambios en Supabase

// Uso típico en vista:
let personnel = $derived(personnelState.personnel);
let currentPage = $derived(personnelState.currentPage);

onMount(() => personnelState.refresh());
```

**Patrón de filtros:** Los filtros se actualizan en el store y `refresh()`
hace la llamada al servicio con los mismos.

**Realtime:** Al inicializar, `initRealtime()` suscribe a cambios en la tabla
`personnel` de Supabase. Las actualizaciones se aplican optimistamente al
array local sin recargar la página completa.

---

#### `ticketState` — Estado de Tickets

**Ubicación:** `src/lib/stores/tickets.svelte.ts`

```typescript
import { ticketState } from "../stores";

// Estado reactivo
ticketState.pendingItems  // Ticket[] — tickets pendientes

// Métodos
ticketState.setTickets(data);          // reemplazar lista completa
ticketState.addTicket(ticket);         // añadir al inicio
ticketState.updateTicket(ticket);      // actualizar por ID
ticketState.removeTicket(id);          // eliminar por ID
ticketState.removeByCard(cardId, types?);  // eliminar por tarjeta (con filtro opcional de tipos)
ticketState.removeByPerson(personId);  // eliminar por persona
```

**Uso en Dashboard:**

```typescript
let pendingItems = $derived(ticketState.pendingItems);
let pendingSignatures = $derived(
    pendingItems.filter(t => t.type === "Firma Responsiva").length
);
```

---

#### `historyState` — Estado de Historial

**Ubicación:** `src/lib/stores/history.svelte.ts`

```typescript
import { historyState } from "../stores";

// Estado reactivo
historyState.historyLogs     // HistoryLog[]
historyState.isLoading       // boolean
historyState.currentPage     // number
historyState.pageSize        // number (50)
historyState.totalRecords    // number

historyState.filters         // { person, cardType, folio, action }

// Métodos
historyState.setHistory(data, count);
historyState.addLog(log);

historyState.refresh(page);
historyState.nextPage();
historyState.prevPage();
historyState.goToPage(page);
```

**Patrón de filtros reactivos:** En `HistoryView`, los filtros se vinculan
con `$effect` que observa `historyState.filters.*` y dispara `refresh()`
con debounce de 400ms.

---

#### `cardState` — Estado de Tarjetas

**Ubicación:** `src/lib/stores/cards.svelte.ts`

```typescript
import { cardState } from "../stores";

cardState.cards              // Card[]
cardState.currentPage        // number
cardState.pageSize           // number (50)
cardState.totalRecords       // number
cardState.isLoading          // boolean
cardState.totalPages         // $derived

cardState.statusFilter       // string
cardState.typeFilter         // string
cardState.searchQuery        // string
cardState.dependencyFilter   // string

cardState.refresh(page?);
cardState.setFilters(type, status, depId);
cardState.setSearch(query);
cardState.nextPage();
cardState.prevPage();
cardState.goToPage(page);
cardState.initSubscriptions();  // suscripción a eventos CARDS_CHANGED y PERSONNEL_CHANGED
```

---

#### Otros Stores

| Store | Archivo | Estado | Propósito |
|---|---|---|---|
| `userState` | `user.svelte.ts` | `profile`, `isAdmin`, `canEdit`, `canDelete`, `currentUser` | Sesión y permisos |
| `uiState` | `ui.svelte.ts` | `activePage`, `isSidebarOpen`, `isSidebarCondensed`, `isDirectEditMode` | UI local (sidebar, páginas) |
| `catalogState` | `catalogs.svelte.ts` | `dependencies`, `buildings`, `specialAccesses`, `schedules` | Catálogos de toda la app |
| `cardlessRegistryState` | `cardlessRegistry.svelte.ts` | `registries`, filtros, paginación | Registro sin tarjeta |
| `networkStore` | `network.svelte.ts` | `isOnline` | Estado de conexión |

#### `userState` — Sesión y permisos

```typescript
import { userState } from "../stores";

userState.profile       // UserProfile | null
userState.isAdmin       // $derived — role === 'admin'
userState.isOperator    // $derived — role === 'operator'
userState.isViewer      // $derived — role === 'viewer'
userState.canEdit       // $derived — admin || operator
userState.canDelete     // $derived — admin
userState.currentUser   // $derived — { name, email, avatar, role } | null

userState.setProfile(profile);
userState.clear();
```

**Nota:** Los derivados (`isAdmin`, `canEdit`, etc.) se actualizan
automáticamente cuando cambia `profile` gracias a `$derived`.

---

#### `catalogState` — Catálogos globales

```typescript
import { catalogState } from "../stores";

catalogState.dependencies       // CatalogItem[]
catalogState.buildings          // CatalogItem[]
catalogState.specialAccesses    // CatalogItem[]
catalogState.schedules          // CatalogItem[]
```

Los catálogos se cargan una vez al inicio desde `App.svelte` y están
disponibles globalmente. Todas las vistas y componentes acceden a ellos
sin necesidad de pasarlos por props.

#### `networkStore` — Conexión

```typescript
import { networkStore } from "../stores/network.svelte";

networkStore.isOnline  // boolean — detecta navigator.onLine
```

Usado por servicios para decidir si leer de caché local o de Supabase,
y por vistas para deshabilitar botones de escritura.

---

#### Patrón de Store recomendado

Para crear un nuevo store, sigue esta estructura:

```typescript
// src/lib/stores/miStore.svelte.ts
export class MiStore {
    // 1. Estado con $state
    items = $state<MiTipo[]>([]);
    isLoading = $state(false);
    currentPage = $state(1);

    // 2. Derivados con $derived
    totalPages = $derived(Math.ceil(this.totalRecords / this.pageSize));

    // 3. Setters (opcional, pueden asignarse directamente)
    setItems(data: MiTipo[], count: number) {
        this.items = data;
        this.totalRecords = count;
    }

    // 4. Métodos async con isLoading
    async refresh(page?: number) {
        this.isLoading = true;
        if (page !== undefined) this.currentPage = page;
        try {
            const { data, count } = await miService.fetchAll(this.currentPage);
            this.setItems(data, count);
        } finally {
            this.isLoading = false;
        }
    }

    // 5. Navegación
    nextPage() { this.refresh(this.currentPage + 1); }
    prevPage() { this.refresh(Math.max(1, this.currentPage - 1)); }
}

export const miStore = new MiStore();
```

---

### 6.8 Utilidades y Helpers

> Funciones y utilidades compartidas para toda la aplicación.
> Se importan desde `"../utils"` (barrel file en `src/lib/utils/index.ts`).

#### `withLoadingToast` — Toast con ciclo de vida

**Ubicación:** `src/lib/utils/toastHelpers.ts`

```typescript
import { withLoadingToast } from "../utils";

// Uso simple
await withLoadingToast(
    "Preparando exportación...",   // mensaje de carga
    "Exportación completada",      // mensaje de éxito
    async () => {
        const data = await service.fetchForExport();
        exportToExcel(data);
    },
    "Exportar Datos",              // contexto para errores
);

// Con actualización de progreso (útil para ZIP)
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

**Parámetros:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `loadingMessage` | `string` | Texto inicial del toast de carga |
| `successMessage` | `string` | Texto del toast de éxito |
| `fn` | `(update: (msg) => void) => Promise<T>` | Operación async con callback de progreso |
| `errorContext` | `string` | Contexto para `handleError` |
| **return** | `T \| null` | Resultado de `fn`, o `null` si hubo error |

**Ventajas:**
- Maneja automáticamente loading → success o loading → error
- Permite actualizar el mensaje de carga en progreso
- Evita código repetitivo de `toast.loading` / `toast.success` / `toast.dismiss`

---

#### `handleError` — Manejo de errores

**Ubicación:** `src/lib/utils/error.ts`

```typescript
import { handleError } from "../utils";

try {
    await operation();
} catch (error) {
    handleError(error, "Contexto descriptivo");
}
```

Muestra un toast con el mensaje de error apropiado:
- `AppError` → muestra `error.message`
- `Error` estándar → muestra `error.message`
- Error de Supabase (código `23505`) → "El registro ya existe (duplicado)"
- Error de timeout (`isTimeout`) → "La solicitud tardó demasiado..."
- Otros → mensaje genérico "Ha ocurrido un error inesperado."

---

#### `withErrorHandling` — Wrappers de error

**Ubicación:** `src/lib/utils/error.ts`

```typescript
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional } from "../utils";

// 1. Lanza el error después de mostrar toast (para fetch/query)
await withErrorHandling(async () => {
    const { data, error } = await supabase.from("tabla").select();
    if (error) throw error;
    return data;
}, "Fetch Data");

// 2. Retorna fallback silenciosamente (para consultas no críticas)
const data = await withErrorHandlingSafe(
    () => supabase.from("tabla").select(),
    "Fetch Data",
    []  // fallback
);

// 3. Comportamiento condicional por flag
const data = await withErrorHandlingConditional(
    () => supabase.from("tabla").select(),
    "Fetch Data",
    throwOnError,  // si true, relanza
    []              // fallback
);
```

| Wrapper | ¿Muestra toast? | ¿Rethrow? | ¿Return? |
|---|---|---|---|
| `withErrorHandling` | ✅ Sí | ✅ Sí | — |
| `withErrorHandlingSafe` | ✅ Sí | ❌ No | `fallback` |
| `withErrorHandlingConditional` | ✅ Sí | ⚠️ Según flag | `fallback` o throw |

---

#### `withTimeout` — Timeout para promesas

**Ubicación:** `src/lib/utils/error.ts`

```typescript
const data = await withTimeout(
    supabase.from("tabla").update(payload),
    15000  // timeout en ms (default: 15000)
);
```

Lanza un error con `isTimeout = true` si la promesa excede el tiempo límite.
Usado en operaciones de escritura (update/insert) para evitar bloqueos.

---

#### `appEvents` — Bus de eventos global

**Ubicación:** `src/lib/utils/appEvents.ts`

```typescript
import { appEvents, EVENTS } from "../utils";

// Escuchar evento
const unsub = appEvents.on(EVENTS.PERSONNEL_CHANGED, () => {
    refreshData();
});

// Cancelar suscripción (importante en onDestroy)
onDestroy(() => unsub());

// Emitir evento (desde servicios después de mutaciones)
appEvents.emit(EVENTS.CARDS_CHANGED);

// Con payload opcional
appEvents.emit("custom:event", { id: "123" });
```

**Eventos disponibles (`EVENTS`):**

| Constante | Valor | Propósito |
|---|---|---|
| `PERSONNEL_CHANGED` | `'personnel:changed'` | Personal creado/editado/eliminado |
| `CARDS_CHANGED` | `'cards:changed'` | Tarjetas creadas/editadas/eliminadas |
| `TICKETS_CHANGED` | `'tickets:changed'` | Tickets creados/completados/eliminados |
| `HISTORY_CHANGED` | `'history:changed'` | Nuevo registro de historial |
| `CATALOGS_CHANGED` | `'catalogs:changed'` | Catálogos actualizados |
| `TRIGGER_DEACTIVATE` | `'trigger:deactivate'` | Desactivación de triggers |

Patrón típico: los `services` emiten eventos después de mutaciones,
y las `views` (o stores) se suscriben para refrescar datos.

---

#### `batchPaginate` — Paginación automática

**Ubicación:** `src/lib/utils/batchPaginate.ts`

```typescript
import { batchPaginate, batchForEach, batchCollectIds } from "../utils";

// 1. Recolectar TODAS las filas de una consulta paginada
const allCards = await batchPaginate<any>(async (from, to) => {
    return supabase
        .from("cards")
        .select("*")
        .eq("type", "KONE")
        .range(from, to);  // ← rango calculado automáticamente
});

// 2. Procesar página por página sin acumular en memoria
await batchForEach(
    async (from, to) => supabase.from("cards").select("id").range(from, to),
    (items) => {
        for (const item of items) {
            // procesar sin almacenar
        }
    }
);

// 3. Recolectar solo IDs (eficiente en memoria)
const ids = await batchCollectIds(
    async (from, to) => supabase.from("personnel").select("id").range(from, to),
    "id",  // campo ID (default: "id")
    1000   // page size (default: 1000)
);
```

| Función | ¿Acumula? | ¿Callbacks? | Ideal para |
|---|---|---|---|
| `batchPaginate` | ✅ Array completo | — | Exportaciones, reportes |
| `batchForEach` | ❌ No | `processPage(items)` | Procesar sin almacenar |
| `batchCollectIds` | ✅ Set de IDs | — | Verificar existencia, filtros |

**Page size default:** 1000 (máximo de PostgREST).

---

#### `dbCache` — Caché offline en IndexedDB

**Ubicación:** `src/lib/utils/dbCache.ts`

```typescript
import { dbCache } from "../utils";

// Guardar en caché
await dbCache.save(`cards_page_${page}_${filters}`, { data, count });

// Cargar desde caché
const cached = await dbCache.load<{ data: any[]; count: number }>(cacheKey);
if (cached) return cached;  // usar datos cacheados

// Si no hay internet, usar caché; si hay internet, fetch + cachear
if (!networkStore.isOnline) {
    const cached = await dbCache.load(key);
    if (cached) return cached;
    return { data: [], count: 0 };
}
```

Usa `idb-keyval` (almacenamiento clave-valor en IndexedDB).
Implementado en servicios con el patrón:

1. Si `!networkStore.isOnline` → intentar cargar de caché
2. Si hay datos en caché → retornarlos
3. Si no → retornar vacío
4. Si `isOnline` → fetch normal + `await dbCache.save(key, result)`

---

#### `confirm` — Modal de confirmación (singleton)

**Ubicación:** `src/lib/utils/confirmModal.svelte.ts`

```typescript
import { confirm } from "../utils/confirmModal.svelte";
import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";

// 1. Abrir confirmación desde cualquier lado
confirm.open({
    title: "¿Eliminar registro?",
    description: "Esta acción no se puede deshacer.",
    variant: "danger",  // "danger" | "warning" | "info"
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    onConfirm: async () => {
        await service.delete(id);
        toast.success("Eliminado");
    },
    onCancel: () => console.log("Cancelado"),
});

// 2. En la vista, vincular el modal al estado global
<ConfirmationModal
    bind:isOpen={confirm.isOpen}
    title={confirm.title}
    description={confirm.description}
    variant={confirm.variant}
    confirmText={confirm.confirmText}
    cancelText={confirm.cancelText}
    onConfirm={confirm.onConfirm}
    onCancel={() => confirm.close()}
/>
```

**Props del singleton:**

| Prop | Tipo | Default |
|---|---|---|---|
| `isOpen` | `boolean` | `false` |
| `title` | `string` | `""` |
| `description` | `string` | `""` |
| `variant` | `ConfirmVariant` | `"danger"` |
| `confirmText` | `string` | `"Confirmar"` |
| `cancelText` | `string` | `"Cancelar"` |
| `onConfirm` | `() => void \| Promise<void>` | `async () => {}` |
| `onCancel` | `() => void` | `() => {}` |

**Métodos:**
- `confirm.open(options)` — Abre modal con configuración
- `confirm.close()` — Cierra el modal
- `confirm.reset()` — Cierra y limpia todos los campos

---

#### `createSimpleDebounce` — Debounce genérico

**Ubicación:** `src/lib/utils/search.svelte.ts`

```typescript
import { createSimpleDebounce } from "../utils";

const debouncedSearch = createSimpleDebounce((value: string) => {
    personnelState.search(value);
}, 300);

function onSearch(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    debouncedSearch(value);
}
```

Usado en todas las vistas para búsqueda con debounce de 300ms.

---

#### Otras utilidades

| Utilidad | Archivo | Propósito |
|---|---|---|
| `catalogCache` | `catalogCache.ts` | Caché en memoria para catálogos |
| `createSimpleDebounce` | `search.svelte.ts` | Debounce para búsquedas |
| `generateLegalHash` | `crypto.ts` | Hash SHA-256 para documentos legales |
| `generateCardPdf` | `pdfGenerator.ts` | Generar PDF de tarjeta |
| `generateResponsivaPdf` | `pdfGenerator.ts` | Generar PDF de responsiva |
| `personnelActions` | `personnelActions.ts` | Acciones de batch (bloquear múltiples) |
| `initGlobalRealtime` | `realtime.ts` | Suscripciones Realtime globales |
| `appEvents` | `appEvents.ts` | Bus de eventos global |

**Utilidades XLSX (exportación):**

| Exportador | Archivo | Propósito |
|---|---|---|
| `exportPersonnelToExcel` | `xlsxPersonnel.ts` | Exportar personal a Excel |
| `exportCardsToExcel` | `xlsxCards.ts` | Exportar tarjetas a Excel |
| `exportHistoryToExcel` | `xlsxHistory.ts` | Exportar historial a Excel |
| `exportResponsivasToExcel` | `xlsxResponsivas.ts` | Exportar responsivas a Excel |
| `exportCardlessRegistryToExcel` | `xlsxRegistry.ts` | Exportar registro sin tarjeta |
| `exportKoneUsageToExcel` | `xlsxKoneUsage.ts` | Exportar conteo KONE |

**Utilidades XLSX (importación):**

| Importador | Archivo | Propósito |
|---|---|---|
| `parseTemplateFile` | `xlsxImporter.ts` | Parsear plantilla de tickets desde Excel |
| `parseKoneUsageFile` | `xlsxKoneUsage.ts` | Parsear archivo de conteo KONE |
| `generateRequestTemplate` | `xlsxTemplate.ts` | Generar plantilla Excel descargable |

**Utilidades ZIP:**

| Utilidad | Archivo | Propósito |
|---|---|---|
| `exportPersonnelAllDependenciesAsZip` | `zipExport.ts` | ZIP con Excel por dependencia |
| `exportResponsivasAllDependenciesAsZip` | `zipExport.ts` | ZIP de responsivas por dependencia |
| `exportCardlessRegistryAllDependenciesAsZip` | `zipExport.ts` | ZIP de registros sin tarjeta |

---

### 6.9 Servicios (Capa de Datos)

> Servicios que encapsulan llamadas a Supabase y lógica de negocio.
> Cada servicio expone métodos async con manejo de errores unificado.

#### `personnelService` — Gestión de Personal

**Ubicación:** `src/lib/services/personnel.ts`

```typescript
import { personnelService } from "../services/personnel";

// Obtener lista paginada con filtros
const { data, count } = await personnelService.fetchAll(
    page = 1,
    limit = 50,
    search = "",           // Nombre o No. Empleado
    statusFilter = "Todos",  // "Todos" | "Activo/a" | "Parcial" | "Sin Acceso" | "Bloqueado/a" | "Baja"
    dependencyId = "",      // UUID de dependencia
    buildingId = "",        // UUID de edificio ("__none__" para buscar sin edificio)
);

// Obtener opciones ligeras para selects
const options = await personnelService.fetchOptions();
// → [{ id, name, employee_no }] filtrado por status != "inactive"

// Buscar por nombre (búsqueda difusa)
const results = await personnelService.searchByName("Pérez", "Juan");
// → Person[] ordenados por relevancia

// Obtener persona por ID (con todas las relaciones)
const person = await personnelService.fetchById("uuid");
// → Person | null

// Crear o actualizar persona (auto-detecta INSERT vs UPDATE por presence de `id`)
await personnelService.save({
    nombres: "Juan",
    apellidos: "Pérez",
    noEmpleado: "EMP-001",
    dependency_id: "uuid",
    building_id: "uuid",
    floor: "2° Piso",
    floors_p2000: ["PB", "1°"],
    floors_kone: ["PB"],
    schedule_id: "uuid",
    entry_time: "08:00",
    exit_time: "17:00",
    email: "juan@ejemplo.com",
    area: "Sistemas",
    position: "Analista",
    specialAccesses: [],
    cards: [],               // Tarjetas iniciales [{ type, folio }]
});

// Cambiar estado (active ↔ blocked ↔ inactive)
await personnelService.updateStatus("uuid", "blocked");

// Eliminar permanentemente
await personnelService.delete("uuid", { cardId: "delete" | "keep" });

// Suscripción en tiempo real (usado internamente por stores)
personnelService.subscribeToChanges((payload) => {
    // payload.eventType: "INSERT" | "UPDATE" | "DELETE"
    // payload.new, payload.old
});

// Estadísticas del dashboard
const stats = await personnelService.fetchDashboardStats();
// → { activePersonnel, koneStock, p2000Stock }

const metrics = await personnelService.fetchDashboardMetrics();
// → DashboardMetrics con statusCounts, cardCoverage, topDependencies, etc.
```

**Tipos clave:**

| Tipo | Propósito |
|---|---|
| `Person` | Registro completo con tarjetas, horario, accesos |
| `DashboardMetrics` | Métricas agregadas para el dashboard |
| `PersonnelRow` | Row interno de la vista `personnel_with_status` |

**Manejo de errores:** Usa `withErrorHandling` para lanzar excepciones,
`withErrorHandlingSafe` para valores por defecto silenciosos, y
`withErrorHandlingConditional` para modo condicional por flag.

---

#### `cardService` — Gestión de Tarjetas

**Ubicación:** `src/lib/services/cards.ts`

```typescript
import { cardService } from "../services/cards";

// Lista paginada
const { data, count } = await cardService.fetchAll(
    page = 1,
    limit = 50,
    search = "",           // Folio o nombre del asignado
    typeFilter = "Todos",   // "Todos" | "P2000" | "KONE"
    statusFilter = "Todas", // "Todas" | "Disponible" | "Activa" | "Bloqueada" | "Baja"
    depId = "",             // UUID de dependencia
);

// Exportar (sin paginación, usa batchPaginate internamente)
const allCards = await cardService.fetchForExport(search, typeFilter, statusFilter, depId);

// Tarjetas disponibles (sin asignar)
const extraCards = await cardService.fetchExtra();
// → Card[] con personName = "Sin asignar"

// Buscar tarjeta por folio exacto
const found = await cardService.findByFolio("FOL-001", "P2000");
// → { card: {...}, ownerName: "Juan Pérez" } | null

// Búsqueda parcial por folio (autocompletado)
const results = await cardService.searchByFolio("FOL");
// → Card[] (limitado a 5 resultados)

// Crear o actualizar tarjeta
await cardService.save({
    folio: "FOL-001",
    type: "P2000",
    person_id: "uuid",          // null = disponible en inventario
    status: "active",           // "active" | "available" | "blocked" | "inactive"
    programming_status: null,    // Se auto-asigna "pending" en nueva asignación
    responsiva_status: null,
}, { oldCardStatus: "blocked" });  // Opciones de reemplazo (reposición)

// Actualizar estado de programación
await cardService.updateProgrammingStatus("card-uuid", "done");
// Si status="done" y responsiva pendiente, crea ticket de Firma

// Actualizar estado de responsiva
await cardService.updateResponsivaStatus("card-uuid", "signed");
// Si status="signed", elimina tickets de "Firma Responsiva"

// Bloquear/reactivar/inactivar
await cardService.updateStatus("card-uuid", "blocked");

// Desvincular de persona (vuelve a inventario)
await cardService.unassign("card-uuid");

// Eliminar permanentemente
await cardService.delete("card-uuid");

// Obtener tarjetas por tipo (para reportes)
const cards = await cardService.fetchCardsByType("KONE");
// → [{ folio, status }]
```

**Flujo de asignación de tarjeta:**

1. `save()` con `person_id` → crea tarjeta + ticket de "Programación"
2. Programación se marca como `done` → `updateProgrammingStatus()`
3. Si `responsiva_status !== "signed"` → crea ticket de "Firma Responsiva"
4. Firma completada → `updateResponsivaStatus("signed")` → elimina ticket

**Flujo de reposición:**

1. `save()` con `replacementOptions.oldCardStatus`
2. Tarjeta anterior: se desvincula y pasa a `blocked` (baja) o `available` (inventario)
3. Nueva tarjeta: se asigna a la persona + ticket de Programación

---

#### `ticketService` — Gestión de Tickets

**Ubicación:** `src/lib/services/tickets.ts`

```typescript
import { ticketService } from "../services/tickets";

// Obtener tickets pendientes (hasta 200)
const tickets = await ticketService.fetchAll();

// Lista paginada con filtros
const { data, count } = await ticketService.fetchPaginated(
    page = 1,
    limit = 50,
    typeFilter = "Todos",       // Tipo de ticket
    priorityFilter = "Todas",   // "Todas" | "Alta" | "Media" | "Baja"
    search = "",               // Folio, persona, descripción
    section = "General",       // "General" | "Responsivas" (filtra Firma Responsiva)
    dependencyId = "",         // UUID de dependencia
);

// Exportar responsivas pendientes
const responsivas = await ticketService.fetchResponsivasForExport(dependencyId);

// Crear ticket manual
await ticketService.create({
    type: "Reporte de Falla",
    description: "Descripción del problema...",
    priority: "alta",             // "alta" | "media" | "baja"
    person_id: "uuid",
    card_id: "uuid",
    title: "Resumen del ticket",
    payload: {},                   // Datos adicionales del formulario
});

// Crear tickets en lote (desde importación Excel)
const { created, errors } = await ticketService.createBatch([
    { type, title, description, priority, payload },
    // ...
]);
// → { created: 5, errors: [{ index: 2, message: "..." }] }

// Completar/eliminar ticket
await ticketService.delete(ticketId, "Razón opcional");

// Eliminar tickets por tarjeta (ej: al desvincular)
await ticketService.deleteByCard(cardId, ["Programación", "Firma Responsiva"], "Razón");

// Eliminar tickets por persona (ej: al dar de baja)
await ticketService.deleteByPerson(personId, "Razón");

// Actualizar estado
await ticketService.updateStatus(ticketId, "completed", "Detalle opcional");
```

**Tipos de ticket:**

| Tipo | Descripción | Origen |
|---|---|---|
| `Alta de Persona` | Nuevo registro de personal | Importación Excel |
| `Programación` | Programar acceso de tarjeta | Automático al asignar tarjeta |
| `Modificación` | Cambio de datos | Importación Excel |
| `Modificación de datos` | Solicitud de cambio desde la UI | Manual desde PersonModal |
| `Firma Responsiva` | Firma de responsiva pendiente | Automático al programar |
| `Solicitud de acceso` | Pedido de nuevo acceso | Manual desde TicketModal |
| `Reposición` | Reemplazo de tarjeta | Importación Excel |
| `Bloqueo de tarjeta` | Bloquear tarjeta | Manual |
| `Baja de tarjeta` | Dar de baja tarjeta | Manual |
| `Bloqueo de persona` | Bloquear persona | Manual |
| `Baja de Persona` | Dar de baja persona | Manual / Importación |
| `Reporte de Falla` | Reportar incidencia | Manual |
| `Otro` | Genérico | Manual |

---

#### `enlaceService` — Enlaces Administrativos

**Ubicación:** `src/lib/services/enlaces.ts`

```typescript
import { enlaceService } from "../services/enlaces";

const enlaces = await enlaceService.fetchAll();
// → Enlace[] con datos de personnel y extensión

await enlaceService.create(personId, extension, createdBy);
await enlaceService.remove(enlaceId, personName);
```

---

#### `HistoryService` — Historial de Auditoría

**Ubicación:** `src/lib/services/history.ts`

```typescript
import { HistoryService } from "../services/history";

// Obtener historial paginado
const { data, count } = await HistoryService.fetchAll(
    page = 1,
    limit = 50,
    filters = { person: "", cardType: "Todos", folio: "", action: "Todas" }
);

// Exportar todo el historial (sin paginación)
const allLogs = await HistoryService.fetchForExport(filters);

// Registrar acción (usado internamente por servicios)
await HistoryService.log(
    "PERSONNEL",           // entity_type
    "uuid",                // entity_id
    "UPDATE",               // action: CREATE | UPDATE | DELETE | UPDATE_STATUS | ASSIGN_CARD | etc.
    { message: "...", entityName: "..." }
);

// Limpiar caché local
HistoryService.clearCache();
```

---

#### Otros Servicios

| Servicio | Archivo | Propósito |
|---|---|---|
| `cardlessRegistryService` | `services/cardlessRegistry.ts` | Registro de personal sin tarjeta |
| `profileService` | `services/profiles.ts` | Perfiles de usuario (fetchAll) |
| `catalogService` | `services/catalogs.ts` | Catálogos (dependencies, buildings, accesses, schedules) |
| `responsivaService` | `services/responsiva.ts` | Responsivas digitales firmadas |

---

### 6.8 Componentes Reutilizables de UI

> Componentes genéricos creados para estandarizar patrones comunes y
> eliminar duplicación entre vistas y modales.

#### `ContentView` — Patrón Loading / Empty / Data

**Ubicación:** `src/lib/components/ContentView.svelte`

Estandariza el ciclo de vida de carga de datos en todas las vistas.
Reemplaza el patrón manual:

```svelte
<!-- ❌ Antes: cada vista implementaba esto manualmente -->
{#if isLoading && data.length === 0}
    <SkeletonTable columns={4} rows={5} />
{:else if !isLoading && data.length === 0}
    <EmptyState icon={...} title="..." description="..." />
{:else}
    <DataTable data={...} />
    <Pagination ... />
{/if}
```

```svelte
<!-- ✅ Después: ContentView lo maneja automáticamente -->
<ContentView
    isLoading={store.isLoading}
    data={items}
    emptyTitle="Aún no hay registros"
    emptyDescription="Comienza creando el primer registro."
    emptyIcon={MyIcon}
    emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
    hasFilters={!!(searchQuery)}
    onClearFilters={() => { /* limpiar filtros */ }}
    emptyTitleFiltered="Sin resultados"
    emptyDescriptionFiltered="No encontramos resultados con los filtros actuales."
    skeletonColumns={5}
    skeletonRows={5}
    skeletonHasActions={true}
    cardClass="overflow-hidden"    <!-- opcional: envuelve en <Card> -->
>
    {#snippet children()}
        <DataTable data={items} columns={columns} />
    {/snippet}
    {#snippet emptyActions()}
        <Button onclick={() => openCreateModal()}>Crear</Button>
    {/snippet}
</ContentView>
```

**Props principales:**

| Prop | Tipo | Default |
|---|---|---|
| `isLoading` | `boolean` | — |
| `data` | `any[]` | — |
| `emptyTitle` | `string` | — |
| `emptyDescription` | `string` | — |
| `emptyIcon` | `ComponentType` | — |
| `skeletonColumns` | `number` | `4` |
| `skeletonRows` | `number` | `5` |
| `skeletonHasActions` | `boolean` | `false` |
| `cardClass` | `string` | — (sin Card) |
| `hasFilters` | `boolean` | `false` |

**Responsive:** Muestra `SkeletonTable` en desktop y `SkeletonCard` en móvil automáticamente.

**Vistas que lo usan:** `PersonnelView`, `CardsView`, `TicketsView`, `HistoryView`,
`EnlacesView`, `RegistroSinTarjetaView`

---

#### `SearchInput` — Búsqueda con ícono

**Ubicación:** `src/lib/components/SearchInput.svelte`

```svelte
<SearchInput
    placeholder="Nombre, No. Empleado..."
    bind:value={searchQuery}
    oninput={onSearch}
    class="h-9 text-xs font-bold"
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `value` | `string` (bindable) | `""` |
| `placeholder` | `string` | `"Buscar..."` |
| `oninput` | `(e: Event) => void` | — |

Usa `bind:value` para two-way binding y `oninput` para búsqueda con debounce.
No necesita el ícono `Search` manualmente — ya lo incluye internamente.

---

#### `SkeletonCard` — Esqueleto para vista móvil

**Ubicación:** `src/lib/components/SkeletonCard.svelte`

```svelte
<SkeletonCard columns={5} rows={5} hasActions={true} />
```

| Prop | Tipo | Default |
|---|---|---|
| `columns` | `number` | `4` |
| `rows` | `number` | `5` |
| `hasActions` | `boolean` | `false` |

Imita el layout de las tarjetas móviles del `DataTable`. Incluye el efecto
shimmer global (`animate-shimmer` definido en `app.css`).

Usado internamente por `ContentView` cuando hay datos cargando.

---

#### `FormSection` — Sección de formulario

**Ubicación:** `src/lib/components/FormSection.svelte`

```svelte
<FormSection title="Datos Personales" disabled={!canEdit}>
    <!-- inputs, selects, etc. -->
</FormSection>
```

| Prop | Tipo | Default |
|---|---|---|
| `title` | `string` | — |
| `disabled` | `boolean` | `false` |

Renderiza un `<fieldset>` con `<legend>` estilizado. El `disabled` deshabilita
todos los controles hijos automáticamente.

---

#### `FormField` — Campo de formulario con label + error

**Ubicación:** `src/lib/components/FormField.svelte`

```svelte
<FormField label="Nombre" for="nombre" error={errors.nombre}>
    <Input id="nombre" bind:value={nombre} />
</FormField>
```

| Prop | Tipo | Default |
|---|---|---|
| `label` | `string` | — |
| `for` | `string` | — (asocia el label al input) |
| `error` | `string` | — (oculta si vacío) |

Reemplaza el patrón:
```svelte
<!-- ❌ Antes -->
<div class="space-y-1.5">
    <label for="x" class="text-xs font-bold text-slate-600 block">X</label>
    <Input id="x" ... />
    {#if errors.x}
        <p class="text-[10px] text-red-500">{errors.x}</p>
    {/if}
</div>
```

---

#### `CatalogSelect` — Select de catálogo genérico

**Ubicación:** `src/lib/components/CatalogSelect.svelte`

```svelte
<CatalogSelect
    catalog={catalogState.dependencies}
    bind:value={dependency}
    placeholder="Seleccionar dependencia..."
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `catalog` | `CatalogItem[]` | — |
| `value` | `string` (bindable) | — |
| `placeholder` | `string` | `"Seleccionar..."` |
| `disabled` | `boolean` | `false` |
| `id` | `string` | — |

Renderiza un `<Select>` con `<option>` por cada item del catálogo.

**Wrappers específicos** (para compatibilidad):

| Componente | Catálogo interno | Ubicación |
|---|---|---|
| `DependencySelect` | `catalogState.dependencies` | `components/DependencySelect.svelte` |
| `BuildingSelect` | `catalogState.buildings` | `components/BuildingSelect.svelte` |
| `ScheduleSelect` | `catalogState.schedules` | `components/ScheduleSelect.svelte` |

Prefiere usar `CatalogSelect` directamente cuando necesites un catálogo
distinto o quieras pasar el array explícitamente.

---

#### Barrel Files (Exportación de Componentes)

Todos los componentes se exportan mediante **barrel files** para centralizar
las importaciones desde las vistas.

**Estructura de barrels en `src/lib/components/`:**

```
components/
├── index.ts              # Barrel raíz — exporta TODOS los componentes base
│                         #   + re-exporta modales y catálogos via `export *`
├── modals/
│   └── index.ts          # Barrel de modales (16 componentes)
├── catalogs/
│   └── index.ts          # Barrel de catálogos (5 componentes)
├── Badge.svelte
├── Button.svelte
└── ...
```

**Patrón de importación recomendado:**

```ts
// ✅ RECOMENDADO — desde el barrel raíz (un solo import)
import { Button, Card, DataTable, TicketModal, BuildingCatalog } from "../components";

// ✅ TAMBIÉN VÁLIDO — desde barrels anidados (más explícito)
import { TicketModal, ConfirmationModal } from "../components/modals";
import { BuildingCatalog, ScheduleCatalog } from "../components/catalogs";

// ❌ EVITAR — import directo del archivo (excepto en imports internos entre componentes)
import Button from "../components/Button.svelte";
import TicketModal from "../components/modals/TicketModal.svelte";
```

> **Nota:** Los componentes dentro de `components/` que se importan entre sí
> (ej. `GlobalOverlays.svelte` → `./modals/PersonModal`) usan rutas relativas
> y no necesitan cambiar.

**Lista completa de componentes exportados desde el barrel raíz (62 total):**

| Categoría | Cant. | Componentes |
|---|---|---|
| Base UI | 15 | Badge, Button, Card, CardItem, Input, Modal, Pagination, Select, SkeletonTable, EmptyState, SkeletonCard, ContentView, SearchInput, FormSection, FormField |
| Filters | 4 | FilterGroup, FilterSelect, ToggleGroup, SectionHeader |
| Data Display | 5 | DataTable, ExportDropdown, TaskBanner, HistoryFilters, SignaturePad |
| Layout | 9 | DashboardLayout, MainLayoutWrapper, Sidebar, BottomNav, GlobalOverlays, CommandPalette, FloatingActionButton, Logo, SidePanel |
| Permissions | 1 | PermissionGuard |
| Domain | 3 | PersonDetailsPanel, ResponsivaPreviewModal, ResponsivaTemplate |
| Catalog Selects | 4 | CatalogSelect, DependencySelect, BuildingSelect, ScheduleSelect |
| Modales (re-exp.) | 16 | AddCardModal, AddEnlaceModal, CardlessRegistryModal, ConfirmAltaModal, ConfirmationModal, DeletePersonnelModal, DetectMissingCardsModal, EditEnlaceModal, ImportPreviewModal, KoneUsageImportModal, ManualTicketDetailsModal, ModificationCompareModal, PersonModal, SignatureModal, TicketImportedDetailsModal, TicketModal |
| Catálogos (re-exp.) | 5 | BuildingCatalog, DependencyCatalog, AccessCatalog, ScheduleCatalog, UserManagementSection |

---

### 6.10 Tipos Compartidos (Types)

**Ubicación:** `src/lib/types/index.ts`

Tipos principales del dominio exportados desde `"../types"`:

| Tipo | Propósito | Campos clave |
|---|---|---|
| `Person` | Registro completo de personal | `id`, `first_name`, `last_name`, `employee_no`, `status`, `status_raw`, `name` (calculado), `building`, `dependency`, `schedule`, `cards`, `floors_p2000`, `floors_kone`, `specialAccesses`, `email`, `area`, `position`, `floor`, `photo_url` |
| `Card` | Tarjeta de acceso | `id`, `folio`, `type`, `status`, `person_id`, `programming_status`, `responsiva_status`, `personName?`, `personStatus?`, `personnel?` |
| `Ticket` | Solicitud/Ticket | `id`, `title`, `description`, `type`, `priority`, `status`, `created_at`, `person_id`, `card_id`, `payload`, `personName?`, `cardType?`, `cardFolio?`, `personnel?` |
| `UserProfile` | Perfil de usuario | `id`, `role` (`'admin' \| 'operator' \| 'viewer'`), `full_name`, `email`, `avatar_url?` |
| `CatalogItem` | Item de catálogo genérico | `id`, `name` + campos adicionales |
| `DashboardMetrics` | Métricas del dashboard | `totalPersonnel`, `statusCounts`, `cardCoverage`, `topDependencies`, `topBuildings`, `dataQuality` |
| `HistoryLog` | Registro de auditoría | `id`, `timestamp`, `entity_type`, `entity_id`, `entity_name`, `action`, `details`, `performed_by` |
| `CardlessRegistry` | Registro sin tarjeta | `id`, `person_id`, nombres, ubicación, `reason`, `comments`, `recorded_at`, `kone_status_at_registration`, propiedades calculadas |
| `Enlace` | Enlace administrativo | `id`, `person_id`, `extension`, `created_at`, `personnel?` |

**Nota:** Los tipos con `?` son opcionales/propiedades calculadas. `CatalogItem` usa `[key: string]: any` para soportar campos adicionales como `floors` en buildings o `days` en schedules.

---

### 6.11 Constantes del Dominio

**Ubicación:** `src/lib/constants/`

#### `status.ts` — Estados de personal y tarjetas

```typescript
import { PERSONNEL_STATUS, CARD_STATUS, getPersonnelStatusVariant, getCardStatusVariant } from "../constants/status";
```

| Constante | Valor | Uso |
|---|---|---|
| `PERSONNEL_STATUS.ACTIVO` | `"Activo/a"` | Estado display de personal activo |
| `PERSONNEL_STATUS.PARCIAL` | `"Parcial"` | Personal con solo un tipo de acceso |
| `PERSONNEL_STATUS.SIN_ACCESO` | `"Sin Acceso"` | Sin tarjetas activas |
| `PERSONNEL_STATUS.BLOQUEADO` | `"Bloqueado/a"` | Acceso denegado |
| `PERSONNEL_STATUS.BAJA` | `"Baja"` | Desactivado permanentemente |
| `PERSONNEL_STATUS_RAW` | `{ ACTIVE, BLOCKED, INACTIVE }` | Estados raw en BD |
| `CARD_STATUS` | `{ ACTIVE, BLOCKED, INACTIVE, AVAILABLE }` | Estados de tarjetas (raw) |
| `CARD_STATUS_LABELS` | Mapa de estado → label display | `"available"` → `"Disponible"` |
| `CARD_TYPES` | `{ KONE: "KONE", P2000: "P2000" }` | Tipos de tarjeta |

**Funciones helper:**

| Función | Retorno | Uso |
|---|---|---|
| `getPersonnelStatusVariant(status)` | `"emerald" \| "amber" \| "slate" \| "rose"` | Variante de Badge para estado de persona |
| `getCardStatusVariant(status)` | `"emerald" \| "rose" \| "slate" \| "blue"` | Variante de Badge para estado de tarjeta |
| `getCardTypeVariant(type)` | `"blue" \| "amber" \| "slate"` | Variante de Badge para tipo de tarjeta |
| `getTicketPriorityVariant(priority)` | `"rose" \| "amber" \| "blue" \| "slate"` | Variante de Badge para prioridad de ticket |
| `getCardStatusLabel(status)` | `string` | Traduce estado raw a label display |

Los estados PARCIAL y SIN_ACCESO son `COMPUTED_STATUSES` — se calculan post-query (no existen en BD).

#### `history.ts` — Acciones de auditoría

```typescript
import { ACTION_NAMES, ACTION_COLORS, translateDetails } from "../constants/history";
```

- `ACTION_NAMES`: Mapa de key → label display (e.g., `CREATE` → `"Registro"`, `BLOCK` → `"Bloqueo de Acceso"`)
- `ACTION_COLORS`: Mapa de key → variante Badge (e.g., `CREATE` → `"emerald"`, `DELETE` → `"rose"`)
- `translateDetails(text)`: Traduce términos técnicos a español para mostrar en UI

#### `legal.ts` — Textos legales de responsivas

```typescript
import { RESPONSIVA_LEGAL_TEXTS } from "../constants/legal";
```

`RESPONSIVA_LEGAL_TEXTS` contiene arrays de párrafos para `KONE` y `P2000`, con placeholders `{nombre}`, `{numEmpleado}`, `{dependencia}`, `{folio}` que se reemplazan al generar el documento.

---

### 6.12 Esquemas de Validación (Zod)

**Ubicación:** `src/lib/schemas.ts`

```typescript
import { personnelSchema } from "../schemas";
import type { PersonnelSchema } from "../schemas";

const result = personnelSchema.safeParse(formData);
if (!result.success) {
    // Campos: first_name, last_name, dependency, building, floor,
    //         schedule_days, entry_time, exit_time, email, employee_no, area, position
    result.error.errors.forEach(e => {
        errors[e.path[0]] = e.message;
    });
}
```

| Campo | Reglas |
|---|---|
| `first_name` | min 2 caracteres, trim |
| `last_name` | min 2 caracteres, trim |
| `dependency` | requerido (min 1) |
| `building` | requerido (min 1) |
| `floor` | requerido (min 1) |
| `schedule_days` | requerido (min 1) |
| `entry_time` | regex `HH:MM` |
| `exit_time` | regex `HH:MM` |
| `email` | email válido O vacío |
| `employee_no` | opcional |
| `area` | opcional |
| `position` | opcional |

---

### 6.13 Application Shell

#### `App.svelte` — Componente raíz

**Ubicación:** `src/App.svelte`

Flujo de inicialización:

1. **Carga de autenticación:** `supabase.auth.getSession()` + `auth.getProfile(userId)`
2. **Carga crítica (await):** `personnelOptions`, `dependencies`, `buildings`, `accesses`, `schedules` — datos necesarios para que la UI sea interactiva
3. **Carga secundaria (background):** `extraCards`, `pendingTickets`, `historyLogs`, `dashboardMetrics`, suscripciones Realtime

**Estados de pantalla:**

| Estado | UI |
|---|---|
| `loadingAuth` (inicial) | Spinner + "Cargando Nexa..." |
| `initError` (error de conexión) | Pantalla de error con botón "Reintentar" |
| `!userState.profile` (no autenticado) | `LoginView` |
| Autenticado | `MainLayoutWrapper` + `Router` + `GlobalOverlays` |

**Manejo de sesión:** `onAuthStateChange` detecta `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`. Omite eventos redundantes para evitar thrashing. Al cerrar sesión, limpia `HistoryService.clearCache()`.

#### `routes.ts` — Definición de rutas

**Ubicación:** `src/lib/routes.ts`

```typescript
import { routes } from "../lib/routes";
```

| Ruta | Vista |
|---|---|
| `/`, `/dashboard` | `DashboardView` |
| `/personal` | `PersonnelView` |
| `/cards` | `CardsView` |
| `/tickets` | `TicketsView` |
| `/history` | `HistoryView` |
| `/settings` | `SettingsView` |
| `/enlaces` | `EnlacesView` |
| `/registro-sin-tarjeta` | `RegistroSinTarjetaView` |
| `*` (catch-all) | `DashboardView` |

Usa `svelte-spa-router` con imports eager (no lazy).

#### `supabase.ts` — Cliente Supabase

**Ubicación:** `src/lib/supabase.ts`

```typescript
import { supabase, auth } from "../lib/supabase";

// Cliente directo
const { data, error } = await supabase.from("tabla").select("*");

// Auth helpers
auth.signIn(email);     // Magic link OTP
auth.signOut();
auth.onAuthStateChange(callback);
auth.getProfile(userId);
```

- Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`
- Muestra error en consola si faltan credenciales

---

### 6.14 Vistas (Páginas)

> Vistas principales de la aplicación. Cada vista corresponde a una ruta en `routes.ts`.

#### `DashboardView` — Panel de Control

**Ubicación:** `src/lib/views/DashboardView.svelte`

**Ruta:** `/dashboard`

Secciones:
1. **KPIs:** 3 tarjetas (Personal Activo, Firmas Pendientes, Total Tickets)
2. **Por Estado:** Barras de progreso por estado (activo, parcial, sin acceso, bloqueado, baja)
3. **Cobertura de Tarjetas:** Barras P2000 y KONE + stock disponible
4. **Calidad de Datos:** % de campos incompletos (email, horario, puesto, área)
5. **Dependencias:** Ranking con barras de activos
6. **Edificios:** Ranking con barras de ocupación

Usa `personnelState.dashboardMetrics` y `personnelState.dashboardStats`. Se actualiza con eventos `PERSONNEL_CHANGED` y `CARDS_CHANGED`.

**Estados:** Metrics loading → Skeleton cards. Sin datos → mensaje "Cargando métricas...".

---

#### `SettingsView` — Configuración

**Ubicación:** `src/lib/views/SettingsView.svelte`

**Ruta:** `/settings` (solo admin)

Layout de 2 columnas: sidebar de navegación + contenido. Pestañas:
- **Catálogos** (default): Sub-pestañas para Edificios, Dependencias, Accesos Especiales, Horarios
- **Usuarios** (solo admin): Gestión de permisos

Herramientas en sidebar:
- Generar plantilla de solicitudes Excel
- Generar plantilla de uso KONE

---

#### `LoginView` — Inicio de sesión

**Ubicación:** `src/lib/views/LoginView.svelte`

**Ruta:** (vista condicional en App.svelte)

Dos modos:
1. **Iniciar Sesión:** Email + contraseña (o magic link)
2. **Registrarse:** Nombre + email + contraseña (con confirmación)

Incluye animación de gradiente en el fondo, logo Nexa, y diseño responsive centrado.

---

### 6.15 Referencia rápida: docs/COMPONENTES.md

Para documentación completa de todos los componentes de UI restantes, incluyendo:

- Componentes base (Pagination, PermissionGuard, SectionHeader, FilterGroup, FilterSelect, ToggleGroup, ExportDropdown, CatalogItemModal)
- Componentes de layout (DashboardLayout, MainLayoutWrapper, Sidebar, BottomNav, GlobalOverlays, CommandPalette, FloatingActionButton, Logo, SidePanel)
- Componentes de dominio (PersonDetailsPanel, CardItem, TaskBanner, HistoryFilters, ResponsivaPreviewModal, SignaturePad)
- Catálogos de Settings (BuildingCatalog, DependencyCatalog, AccessCatalog, ScheduleCatalog, UserManagementSection)
- Flujo de importación (ImportIdleStep, ImportParsedStep, ImportReviewRow, ImportReviewStep)
- Formulario de persona (PersonFormAccess, PersonFormCards, PersonFormLocation, PersonFormSchedule)
- Detalle de tickets (TicketBajaDetail, TicketModificacionDetail, TicketPersonSearch, TicketReporteFallaDetail, TicketReposicionDetail)
- Modales (AddCardModal, AddEnlaceModal, EditEnlaceModal, CardlessRegistryModal, DeletePersonnelModal, DetectMissingCardsModal, ImportPreviewModal, KoneUsageImportModal)

👉 Ver [`docs/COMPONENTES.md`](./COMPONENTES.md)

---

## 7. Build & Despliegue

### Build de producción

```bash
npm run build
```

Esto genera los archivos en `dist/` listos para servir como SPA (Single Page App).

### Despliegue en Vercel / Netlify / Cloudflare Pages

Configurar el redirect para SPA:

```javascript
// vercel.json o similar
{
  "rewrites": [{"source": "/(.*)", "destination": "/index.html"}]
}
```

### Variables de entorno en producción

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase |

---

## 8. Testing

### TypeScript check

```bash
npm run check
```

Verifica tipos y sintaxis Svelte con `svelte-check`.

### Build check

```bash
npm run build
```

---

### 8.1 Buenas prácticas antes de commit

1. `npm run check` — Sin errores de TypeScript
2. `npm run build` — Build exitoso
3. Revisar cambios con `git diff`
4. Confirmar que los imports no tengan componentes faltantes
5. Verificar que los nuevos componentes se hayan agregado al sistema de barrel exports si aplica

#### `Button` — Botón con variantes

**Ubicación:** `src/lib/components/Button.svelte`

```svelte
<Button variant="primary" size="sm" onclick={handleClick} loading={isSaving}>
    Guardar
</Button>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `ButtonVariant` | `"primary"` | `primary`, `secondary`, `success`, `ghost`, `outline`, `danger`, `amber`, `sky`, `soft-blue`, `soft-emerald`, `soft-slate` |
| `size` | `"default" \| "sm" \| "lg"` | `"default"` | Tamaño predefinido |
| `loading` | `boolean` | `false` | Muestra spinner + deshabilita |
| `disabled` | `boolean` | `false` | Deshabilita el botón |
| `onclick` | `(e: MouseEvent) => void` | — | Handler de click |

**Nota:** Soporta todos los atributos nativos de `<button>` (`type`, `form`, `autofocus`, `tabindex`, etc.)
junto con eventos de ratón/teclado (`onmouseenter`, `onkeydown`, etc.).

---

#### `Card` — Contenedor con sombra

**Ubicación:** `src/lib/components/Card.svelte`

```svelte
<Card class="overflow-hidden p-6">
    <p>Contenido</p>
</Card>
```

| Prop | Tipo | Default |
|---|---|---|
| `class` | `string` | `""` | Clases adicionales (usa `twMerge`) |
| `children` | `Snippet` | — | Contenido interno |

Incluye `hover:shadow-md` y `hover:border-slate-300/50` por defecto.
Para desactivarlos, pasa `class="shadow-none hover:shadow-none"`.

---

#### `Badge` — Etiqueta de estado

**Ubicación:** `src/lib/components/Badge.svelte`

```svelte
<Badge variant="emerald">Activo</Badge>
<Badge variant="amber" class="px-3">Pendiente</Badge>
```

| Prop | Tipo | Default |
|---|---|---|---|
| `variant` | `"slate" \| "amber" \| "emerald" \| "blue" \| "rose" \| "violet"` | `"slate"` | |
| `class` | `string` | `""` | Clases adicionales |

**Uso típico:**

```typescript
import { getPersonnelStatusVariant, getCardStatusVariant } from "../constants/status";

<Badge variant={getPersonnelStatusVariant(person.status)}>{person.status}</Badge>
```

---

#### `Input` — Campo de texto

**Ubicación:** `src/lib/components/Input.svelte`

```svelte
<Input bind:value={name} placeholder="Nombre completo" class="h-12 pl-11" />
<Input type="email" bind:value={email} disabled={!canEdit} />
<Input type="date" bind:value={startDate} max={endDate || undefined} />
```

| Prop | Tipo | Default |
|---|---|---|---|
| `value` | `string` (bindable) | `""` | Two-way binding |
| `type` | `InputType` | `"text"` | `text`, `email`, `password`, `date`, `time`, `number`, etc. |
| `placeholder` | `string` | — | |
| `disabled` | `boolean` | `false` | |
| `readonly` | `boolean` | `false` | |
| `required` | `boolean` | `false` | |

Soporta todos los atributos nativos de `<input>` + `twMerge` para clases.

---

#### `Select` — Selector desplegable

**Ubicación:** `src/lib/components/Select.svelte`

```svelte
<!-- Con snippet de opciones -->
<Select bind:value={dependency}>
    {#each dependencies as dep}
        <option value={dep.name}>{dep.name}</option>
    {/each}
</Select>

<!-- Con prop options -->
<Select bind:value={priority} options={["Baja", "Media", "Alta"]} />
```

| Prop | Tipo | Default |
|---|---|---|---|
| `value` | `string \| number` (bindable) | — | |
| `placeholder` | `string` | `"Seleccionar..."` | |
| `options` | `array` | `[]` | Array de strings u objetos `{ value, label }` |
| `disabled` | `boolean` | `false` | |
| `id` | `string` | — | Para asociar con `<label for>` |
| `children` | `Snippet` | — | `<option>` personalizadas (sobrescribe `options`) |

---

#### `Modal` — Modal genérico

**Ubicación:** `src/lib/components/Modal.svelte`

```svelte
<Modal bind:isOpen title="Editar Persona" description="Modifique los datos requeridos." size="xl" onclose={resetForm}>
    <!-- contenido -->

    {#snippet footer()}
        <Button onclick={close}>Cancelar</Button>
        <Button variant="primary" onclick={handleSave}>Guardar</Button>
    {/snippet}
</Modal>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `isOpen` | `boolean` (bindable) | — | Controla visibilidad |
| `title` | `string` | — | Título del modal |
| `description` | `string` | — | Subtítulo opcional |
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "full"` | `"md"` | Ancho máximo |
| `showClose` | `boolean` | `true` | Botón X en el header |
| `footer` | `Snippet` | — | Botones del pie |
| `onclose` | `() => void` | — | Callback al cerrar |

**Comportamiento:**
- Cierra con `Escape` o click en el backdrop
- En móvil se despliega desde abajo (`max-sm:items-end`)
- El `title` usa `id="modal-title"` para accesibilidad (`aria-labelledby`)

---

#### `DataTable` — Tabla de datos con scroll virtual

**Ubicación:** `src/lib/components/DataTable.svelte`

```svelte
<DataTable
    data={personnel}
    actionsWidth="130px"
    columns={[
        { key: "name", label: "Nombre", render: renderName, width: "220px" },
        { key: "status", label: "Estado", render: renderStatus, width: "120px", sortable: true },
    ]}
    mobileCard={mobilePersonnelCard}
>
    {#snippet actions(row)}
        <Button size="sm" onclick={() => onEdit(row)}>Editar</Button>
    {/snippet}
</DataTable>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `data` | `any[]` | — | Arreglo de datos |
| `columns` | `Column[]` | — | Definición de columnas |
| `actions` | `Snippet<[any]>` | — | Acciones por fila |
| `mobileCard` | `Snippet<[any]>` | — | Vista móvil personalizada |
| `actionsWidth` | `string` | `"140px"` | Ancho de la columna de acciones |
| `rowClass` | `(row: any) => string` | — | Clase condicional por fila |

**Tipo `Column`:**

| Prop | Tipo | Default |
|---|---|---|---|
| `key` | `string` | — | Campo del objeto |
| `label` | `string` | — | Encabezado visible |
| `render` | `Snippet<[any]>` | — | Render personalizado |
| `sortable` | `boolean` | `true` | Ordenamiento por columna |
| `width` | `string` | — | Ancho fijo (ej: `"200px"`) |
| `maxWidth` | `string` | — | |
| `hideOnMobile` | `boolean` | — | Oculta columna en móvil |

**Características:**
- Scroll virtual para alto rendimiento con miles de filas
- Ordenamiento por cualquier columna (sensible a mayúsculas y acentos)
- Vista responsive: tabla en desktop, tarjetas expandibles en móvil
- Si no se provee `mobileCard`, genera tarjetas automáticas con toggle "Ver más"

---

#### `EmptyState` — Estado vacío

**Ubicación:** `src/lib/components/EmptyState.svelte`

```svelte
<EmptyState
    icon={Users}
    iconBgClass="from-slate-100 to-slate-200 text-slate-400"
    title="Aún no hay personal registrado"
    titleFiltered="Sin resultados"
    description="Comienza registrando la primera persona."
    descriptionFiltered="No encontramos resultados con los filtros actuales."
    hasFilters={true}
    onClearFilters={clearFilters}
>
    {#snippet children()}
        <Button onclick={onCreate}>Crear</Button>
    {/snippet}
</EmptyState>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `icon` | `ComponentType` | — | Ícono central (lucide-svelte) |
| `iconBgClass` | `string` | `"from-slate-100 to-slate-200"` | `bg-gradient-to-br` + color |
| `title` | `string` | — | Título principal |
| `titleFiltered` | `string` | — | Título alternativo cuando hay filtros |
| `description` | `string` | — | Descripción |
| `descriptionFiltered` | `string` | — | Descripción alternativa con filtros |
| `hasFilters` | `boolean` | `false` | Muestra botón "Limpiar filtros" |
| `onClearFilters` | `() => void` | — | Handler al limpiar |
| `children` | `Snippet` | — | Acciones (botón de crear) |

**Comportamiento:**
- Cuando `hasFilters=true`, muestra `titleFiltered`/`descriptionFiltered` y botón "Limpiar filtros"
- Cuando `hasFilters=false` y hay `children`, muestra los children

---

#### `SkeletonTable` — Esqueleto de tabla (desktop)

**Ubicación:** `src/lib/components/SkeletonTable.svelte`

```svelte
<SkeletonTable columns={5} rows={5} hasActions={true} />
```

| Prop | Tipo | Default |
|---|---|---|---|
| `columns` | `number` | `4` | |
| `rows` | `number` | `5` | |
| `hasActions` | `boolean` | `false` | Muestra columna de acciones |
| `className` | `string` | `""` | |

Incluye efecto `animate-shimmer` (definido en `app.css`).
Las barras tienen anchos escalonados para simular contenido real.

---

#### `Pagination` — Navegación de páginas

**Ubicación:** `src/lib/components/Pagination.svelte`

```svelte
<Pagination
    {currentPage}
    {pageSize}
    {totalRecords}
    onPrevPage={() => prevPage()}
    onNextPage={() => nextPage()}
    onGoToPage={(page) => goToPage(page)}
    isLoading={isLoading}
/>
```

| Prop | Tipo | Default |
|---|---|---|---|
| `currentPage` | `number` | — | Página actual |
| `pageSize` | `number` | — | Registros por página |
| `totalRecords` | `number` | — | Total de registros |
| `onPrevPage` | `() => void` | — | |
| `onNextPage` | `() => void` | — | |
| `onGoToPage` | `(page: number) => void` | — | |
| `isLoading` | `boolean` | `false` | Deshabilita botones |

Muestra rango de páginas con ellipsis y contador "Mostrando X a Y de Z".

---

#### `PermissionGuard` — Control de acceso por rol

**Ubicación:** `src/lib/components/PermissionGuard.svelte`

```svelte
<PermissionGuard requireEdit>
    {#snippet children({ disabled })}
        <Button onclick={onDelete} {disabled}>Eliminar</Button>
    {/snippet}
</PermissionGuard>

<PermissionGuard allowedRoles={["admin", "operator"]}>
    {#snippet children({ disabled })}
        contenido sensible
    {/snippet}
</PermissionGuard>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `allowedRoles` | `("admin" \| "operator" \| "viewer")[]` | `[]` | Roles explícitos |
| `requireEdit` | `boolean` | `false` | Admin u Operator |
| `requireAdmin` | `boolean` | `false` | Solo Admin |
| `disabledOnly` | `boolean` | `false` | Muestra pero deshabilita |
| `fallback` | `Snippet` | — | Contenido alternativo sin permiso |
| `children` | `Snippet<[{ disabled: boolean }]>` | — | Contenido protegido |

El snippet `children` recibe `{ disabled }` para aplicar `disabledOnly`
a los controles internos sin ocultarlos.

---

#### `SectionHeader` — Encabezado de vista

**Ubicación:** `src/lib/components/SectionHeader.svelte`

```svelte
<SectionHeader title="Directorio de Personal">
    {#snippet filters()}
        <FilterGroup label="Estado" options={["Todos", "Activo"]} bind:value={statusFilter} />
    {/snippet}

    {#snippet actions()}
        <Button onclick={onAdd}>Nuevo</Button>
    {/snippet}
</SectionHeader>
```

| Prop | Tipo | Descripción |
|---|---|---|---|
| `title` | `string` | Título de la sección |
| `filters` | `Snippet` | Filtros (colapsables en móvil) |
| `actions` | `Snippet` | Botones de acción (menú en móvil) |
| `onSearch` | `() => void` | Botón de búsqueda en móvil |

**Comportamiento responsive:**
- En móvil: filtros y acciones se colapsan con botones toggle
- En desktop: todo visible horizontalmente

---

#### `FilterGroup` — Filtro de botones

**Ubicación:** `src/lib/components/FilterGroup.svelte`

```svelte
<FilterGroup
    label="Estado"
    options={["Todos", "Activo", "Inactivo"]}
    bind:value={statusFilter}
    onchange={() => refresh()}
/>
```

| Prop | Tipo | Default |
|---|---|---|---|
| `label` | `string` | — | |
| `options` | `string[]` | — | |
| `value` | `string` (bindable) | — | |
| `onchange` | `(value: string) => void` | — | |

Renderiza botones tipo "pill" con selección única.
Ideal para filtros con pocas opciones (estados, tipos).

---

#### `FilterSelect` — Filtro con Select + label

**Ubicación:** `src/lib/components/FilterSelect.svelte`

```svelte
<FilterSelect
    label="Dependencia"
    options={dependencyNames}
    placeholder="Todas"
    bind:value={dependencyFilter}
    onchange={onFilterChange}
/>
```

| Prop | Tipo | Default |
|---|---|---|---|
| `label` | `string` | — | |
| `options` | `string[]` | — | |
| `value` | `string` (bindable) | — | |
| `placeholder` | `string` | `"Seleccionar..."` | |
| `onchange` | `(value: string) => void` | — | |

Especial para filtros con muchas opciones (dependencias, edificios).

---

#### `ToggleGroup` — Selección múltiple

**Ubicación:** `src/lib/components/ToggleGroup.svelte`

```svelte
<ToggleGroup
    label="Pisos Asignados"
    options={["PB", "1°", "2°", "3°"]}
    bind:value={selectedFloors}
    showSelectAll={true}
/>
```

| Prop | Tipo | Default |
|---|---|---|---|
| `label` | `string` | — | |
| `options` | `string[]` | — | |
| `value` | `string[]` (bindable) | `[]` | |
| `showSelectAll` | `boolean` | `false` | Botón "Todos/Ninguno" |
| `onchange` | `(value: string[]) => void` | — | |

---

#### `ExportDropdown` — Menú de exportación

**Ubicación:** `src/lib/components/ExportDropdown.svelte`

```svelte
<ExportDropdown icon={Download} label="Exportar" menuWidth="w-64">
    {#snippet items()}
        <button onclick={() => exportXLSX()}>Hoja Única</button>
        <button onclick={() => exportZIP()}>Todas (ZIP)</button>
    {/snippet}
</ExportDropdown>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `icon` | `Component` | — | Ícono del botón trigger |
| `label` | `string` | — | Texto del botón |
| `items` | `Snippet` | — | Opciones del menú |
| `disabled` | `boolean` | `false` | |
| `menuWidth` | `string` | `"w-56"` | Ancho del menú |

Cierra al hacer click fuera o presionar Escape.

---

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
