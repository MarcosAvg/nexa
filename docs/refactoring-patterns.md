# Patrones de Refactorización

> Documentación de los patrones y convenciones establecidos durante la
> refactorización del proyecto. Sirve como guía para mantener la consistencia
> en el desarrollo futuro.

---

## Índice

1. [Extracción de Subcomponentes](#1-extracción-de-subcomponentes)
2. [Helper `withLoadingToast`](#2-helper-withloadingtoast)
3. [Modal CRUD Genérico (`CatalogItemModal`)](#3-modal-crud-genérico-catalogitemmodal)
4. [Estandarización de `isLoading` en Stores](#4-estandarización-de-isloading-en-stores)
5. [Tipos Estrictos para Variants de Badge](#5-tipos-estrictos-para-variants-de-badge)
6. [Limpieza de `console.log` en Producción](#6-limpieza-de-consolelog-en-producción)
7. [Convenciones de Directorios](#7-convenciones-de-directorios)

---

## 1. Extracción de Subcomponentes

### Propósito

Dividir componentes Svelte grandes (>800 líneas) en subcomponentes
enfocados con una única responsabilidad.

### Cuándo aplicarlo

- Un componente supera las **500 líneas**.
- Una sección del template es **visualmente independiente** (ej: un fieldset,
  un panel de detalle, un paso de un wizard).
- El mismo patrón de UI se repite en varios lugares.

### Patrón de comunicación

Usar **`$bindable()`** para two-way binding cuando el padre necesita leer
y escribir el mismo valor. Usar **callbacks** (`onX`) para acciones
disparadas desde el hijo.

#### Ejemplo: Two-way binding con `$bindable()`

```svelte
<!-- PersonFormLocation.svelte -->
<script lang="ts">
    let {
        edificio = $bindable(""),
        pisoBase = $bindable(""),
        pisosP2000 = $bindable<string[]>([]),
        pisosKone = $bindable<string[]>([]),
        // Props de solo lectura
        availableFloors = [] as string[],
        buildings = [] as CatalogItem[],
    }: {
        edificio: string;
        pisoBase: string;
        pisosP2000: string[];
        pisosKone: string[];
        availableFloors: string[];
        buildings: CatalogItem[];
    } = $props();
</script>

<fieldset class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
    <legend>Ubicación</legend>
    <!-- bind:value conecta directamente con el padre -->
    <Select id="edificio" bind:value={edificio}>
        {#each buildings as b}
            <option value={b.name}>{b.name}</option>
        {/each}
    </Select>
</fieldset>
```

```svelte
<!-- PersonModal.svelte (padre) -->
<PersonFormLocation
    bind:edificio
    bind:pisoBase
    bind:pisosP2000
    bind:pisosKone
    {availableFloors}
    {buildings}
/>
```

#### Ejemplo: Callbacks para acciones

```svelte
<!-- PersonFormCards.svelte -->
<script lang="ts">
    let {
        tarjetasAsignadas = [] as { type: string; folio: string }[],
        onRemoveCard = (index: number) => {},
        onAddCard = () => {},
    }: {
        tarjetasAsignadas: { type: string; folio: string }[];
        onRemoveCard: (index: number) => void;
        onAddCard: () => void;
    } = $props();
</script>

<button onclick={() => onRemoveCard(index)}>
    <Trash2 size={16} />
</button>
<Button onclick={onAddCard}>
    <Plus size={16} /> Asignar Tarjeta
</Button>
```

```svelte
<!-- PersonModal.svelte (padre) -->
<PersonFormCards
    {tarjetasAsignadas}
    onRemoveCard={(i) => removeCard(i)}
    onAddCard={() => (isCardModalOpen = true)}
/>
```

#### Ejemplo: Mix de $bindable y callbacks

```svelte
<!-- TicketPersonSearch.svelte -->
<script lang="ts">
    let {
        isSearching = false,
        candidates = [] as any[],
        selectedPerson = null as any | null,
        onSelectPerson = (person: any) => {},
        onClearSelection = () => {},
    }: {
        isSearching: boolean;
        candidates: any[];
        selectedPerson: any | null;
        onSelectPerson: (person: any) => void;
        onClearSelection: () => void;
    } = $props();
</script>

<!-- El hijo maneja los 4 estados visuales -->
{#if isSearching}
    <!-- Spinner -->
{:else if candidates.length === 0 && searchDone}
    <!-- Sin resultados -->
{:else if candidates.length > 1 && !selectedPerson}
    <!-- Múltiples candidatos -->
{:else if selectedPerson}
    <!-- Persona seleccionada -->
{/if}
```

### Reglas

1. **Un archivo, una responsabilidad**: cada subcomponente debe poder
   describirse en una sola frase.
2. **No duplicar lógica**: si el subcomponente necesita un `$derived` que
   antes estaba en el padre, muévelo al hijo (solo si se usa exclusivamente ahí).
3. **Props explícitas**: tipar todas las props con tipos literales; evitar
   `any` salvo en casos justificados.
4. **Prefijo consistente**: `PersonForm*`, `Ticket*Detail`, `Import*Step`.

### Resultados de la sesión

| Archivo original | Líneas antes | Líneas después | Componentes extraídos |
|---|---|---|---|
| `ImportPreviewModal.svelte` | 1,415 | ~200 | `ImportIdleStep`, `ImportParsedStep`, `ImportReviewStep`, `ImportReviewRow` |
| `TicketImportedDetailsModal.svelte` | 870 | ~350 | `TicketPersonSearch`, `TicketModificacionDetail`, `TicketBajaDetail`, `TicketReposicionDetail`, `TicketReporteFallaDetail` |
| `PersonModal.svelte` | 1,000 | ~550 | `PersonFormLocation`, `PersonFormSchedule`, `PersonFormAccess`, `PersonFormCards` |

---

## 2. Helper `withLoadingToast`

### Propósito

Estandarizar el ciclo de vida de toasts para operaciones asíncronas:
**loading → success** en éxito, **loading dismiss + error toast** en fallo.

### Ubicación

`src/lib/utils/toastHelpers.ts`

### Firma

```typescript
async function withLoadingToast<T>(
    loadingMessage: string,   // Texto inicial del toast de carga
    successMessage: string,   // Texto del toast de éxito
    fn: (updateMessage: (msg: string) => void) => Promise<T>,  // Operación
    errorContext: string,     // Contexto para handleError
): Promise<T | null>
```

### Uso básico

```svelte
<script lang="ts">
    import { withLoadingToast } from "../utils/toastHelpers";

    async function exportData() {
        await withLoadingToast(
            "Preparando exportación...",
            "Exportación completada",
            async () => {
                const data = await service.fetchForExport(...);
                exportToExcel(data);
            },
            "Exportar Datos",
        );
    }
</script>
```

### Uso con actualización de progreso

```svelte
<script lang="ts">
    async function downloadZip() {
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
    }
</script>
```

### Vista donde se aplicó

- `HistoryView.svelte`
- `CardsView.svelte`
- `PersonnelView.svelte`
- `TicketsView.svelte`
- `RegistroSinTarjetaView.svelte`
- `EnlacesView.svelte`
- `DashboardView.svelte`

---

## 3. Modal CRUD Genérico (`CatalogItemModal`)

### Propósito

Eliminar la duplicación de modales CRUD en `SettingsView.svelte` (que
contenía 5 modales casi idénticos para catálogos como Edificios, Pisos,
Dependencias, Horarios, Accesos Especiales).

### Ubicación

`src/lib/components/CatalogItemModal.svelte`

### Características

- Campo **"Nombre"** siempre presente (obligatorio).
- **Children** (`Snippet`) para campos adicionales opcionales.
- **Footer** personalizable mediante snippet (opcional).
- Two-way binding en `isOpen` e `itemName`.
- Botón Save con estado `loading` y `disabled`.

### Uso

```svelte
<script lang="ts">
    import CatalogItemModal from "../CatalogItemModal.svelte";

    let isBuildingModalOpen = $state(false);
    let buildingName = $state("");

    async function handleSaveBuilding() {
        await api.createBuilding(buildingName);
        isBuildingModalOpen = false;
    }
</script>

<CatalogItemModal
    bind:isOpen={isBuildingModalOpen}
    title="Nuevo Edificio"
    description="Registra un nuevo edificio en el catálogo"
    bind:itemName={buildingName}
    onSave={handleSaveBuilding}
    saveLabel="Guardar Edificio"
/>
```

### Con campos adicionales

```svelte
<CatalogItemModal
    bind:isOpen={isFloorModalOpen}
    title={editingId ? "Editar Piso" : "Nuevo Piso"}
    bind:itemName={floorName}
    onSave={handleSaveFloor}
>
    <!-- Campos extra via snippet -->
    <Select bind:value={selectedBuilding}>
        <option value="">Selecciona edificio</option>
        {#each buildings as b}
            <option value={b.id}>{b.name}</option>
        {/each}
    </Select>
</CatalogItemModal>
```

### Props

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `isOpen` | `boolean` (bindable) | `false` | Control de apertura |
| `title` | `string` | `"Nuevo Elemento"` | Título del modal |
| `description` | `string` | `""` | Subtítulo |
| `itemName` | `string` (bindable) | `""` | Valor del campo nombre |
| `onSave` | `() => Promise<void>` | `async () => {}` | Callback de guardado |
| `onClose` | `() => void` | `() => {}` | Callback al cerrar |
| `children` | `Snippet` | — | Campos adicionales |
| `footer` | `Snippet` | — | Footer personalizado |
| `canSave` | `boolean` | `true` | Habilita/deshabilita botón |
| `saveLabel` | `string` | `"Guardar"` | Texto del botón |
| `saveLoading` | `boolean` | `false` | Spinner en botón |
| `nameLabel` | `string` | `"Nombre"` | Label del input nombre |
| `namePlaceholder` | `string` | `"Nombre"` | Placeholder |

---

## 4. Estandarización de `isLoading` en Stores

### Propósito

Todos los stores deben exponer `isLoading` de la misma manera para que
las vistas puedan suscribirse sin importar qué store usen.

### Implementación

```typescript
// ✅ PATRÓN CORRECTO
export class TicketState {
    pendingItems = $state<Ticket[]>([]);
    isLoading = $state(false);  // ← Siempre presente

    async refresh() {
        this.isLoading = true;   // ← Antes de la operación
        try {
            const data = await service.fetch();
            this.pendingItems = data;
        } finally {
            this.isLoading = false;  // ← En finally (no catch)
        }
    }
}
```

### Stores que implementan este patrón

| Store | Archivo |
|---|---|
| `PersonnelState` | `stores/personnel.svelte.ts` |
| `TicketState` | `stores/tickets.svelte.ts` |
| `HistoryState` | `stores/history.svelte.ts` |
| `CardlessRegistryState` | `stores/cardlessRegistry.svelte.ts` |

### Uso en vistas

```svelte
<!-- ✅ CORRECTO: usar isLoading directamente del store -->
{#if ticketState.isLoading}
    <div class="flex justify-center py-8">
        <Loader2 size={24} class="animate-spin text-slate-400" />
    </div>
{/if}

<!-- ❌ INCORRECTO: variable local duplicada -->
<!-- let isLoading = $state(false); ← No hacer esto si el store ya lo tiene -->
```

---

## 5. Tipos Estrictos para Variants de Badge

### Propósito

Eliminar errores de TypeScript causados por retornar `string` en
funciones de mapeo de variantes (Badge espera un tipo unión específico).

### Antes

```typescript
// ❌ Tipo muy amplio — causa error al asignar a Badge.variant
export function getPersonnelStatusVariant(status: string): string {
    if (status === PERSONNEL_STATUS.ACTIVO) return "emerald";
    return "slate";
}
```

### Después

```typescript
// ✅ Tipo estricto que solo permite valores válidos
export function getPersonnelStatusVariant(
    status: string,
): "emerald" | "amber" | "slate" | "rose" {
    if (status === PERSONNEL_STATUS.ACTIVO) return "emerald";
    if (status === PERSONNEL_STATUS.PARCIAL) return "amber";
    if (status === PERSONNEL_STATUS.BLOQUEADO) return "rose";
    return "slate";
}
```

### Funciones estandarizadas en `constants/status.ts`

| Función | Tipo de retorno |
|---|---|
| `getPersonnelStatusVariant()` | `"emerald" \| "amber" \| "slate" \| "rose"` |
| `getCardStatusVariant()` | `"emerald" \| "rose" \| "slate" \| "blue"` |
| `getTicketPriorityVariant()` | `"rose" \| "amber" \| "blue" \| "slate"` |
| `cardStatusBadge().color` | `"emerald" \| "rose" \| "slate"` |

---

## 6. Limpieza de `console.log` en Producción

### Propósito

Eliminar logs de depuración que saturan la consola en producción
mientras se mantienen advertencias y errores importantes.

### Reglas

| Tipo | ¿Conservar? | Ejemplo |
|---|---|---|
| `console.log` de debug | ❌ Eliminar | `"[Realtime: Tickets]" payload` |
| `console.log` de startup | ❌ Eliminar | `"Conectando subscripciones..."` |
| `console.log` de éxito esperado | ❌ Eliminar | `"canal: suscrito"` |
| `console.warn` de fallo recuperable | ✅ Mantener | Error de reconexión |
| `console.error` de fallo crítico | ✅ Mantener | Máximo de reintentos alcanzado |
| `console.warn` de pérdida de conexión | ✅ Mantener | `"Conexión perdida..."` |

### Ubicación

`src/lib/utils/realtime.ts` — se eliminaron ~8 logs de debug, se
mantuvieron todos los `console.warn`/`console.error`.

---

## 7. Convenciones de Directorios

### Estructura

```
src/lib/components/
├── modals/              # Modales grandes o de uso específico
│   ├── PersonModal.svelte
│   ├── TicketModal.svelte
│   └── ...
├── import/              # Componentes del flujo de importación
│   ├── ImportIdleStep.svelte
│   ├── ImportParsedStep.svelte
│   └── ...
├── person-form/         # Secciones del formulario de persona
│   ├── PersonFormLocation.svelte
│   ├── PersonFormSchedule.svelte
│   └── ...
├── ticket-detail/       # Paneles de detalle por tipo de ticket
│   ├── TicketPersonSearch.svelte
│   ├── TicketModificacionDetail.svelte
│   └── ...
├── CatalogItemModal.svelte   # Componente genérico (no en subdirectorio)
├── Badge.svelte
├── Button.svelte
└── ...
```

### Reglas

1. **Componentes reutilizables** (Badge, Button, Modal, Input, Select):
   en la raíz de `components/`.
2. **Componentes específicos de un dominio**: en subdirectorio
   (`person-form/`, `ticket-detail/`, `import/`).
3. **Modales**: en `modals/` a menos que sean genéricos
   (`CatalogItemModal.svelte` está en la raíz porque se usa en vistas
   y no es un modal de dominio específico).
4. **Un solo componente por archivo**.

---

## Resumen de Archivos Creados/Refactorizados

| Archivo | Líneas | Propósito |
|---|---|---|
| `utils/toastHelpers.ts` | ~50 | Helper `withLoadingToast` |
| `components/CatalogItemModal.svelte` | ~100 | Modal CRUD genérico |
| `components/import/ImportIdleStep.svelte` | ~40 | Paso idle del import |
| `components/import/ImportParsedStep.svelte` | ~160 | Paso de selección de filas |
| `components/import/ImportReviewStep.svelte` | ~110 | Paso de revisión con matches |
| `components/import/ImportReviewRow.svelte` | ~220 | Fila expandible de revisión |
| `components/ticket-detail/TicketPersonSearch.svelte` | ~90 | Búsqueda de persona |
| `components/ticket-detail/TicketModificacionDetail.svelte` | ~70 | Cambios de modificación |
| `components/ticket-detail/TicketBajaDetail.svelte` | ~30 | Confirmación de baja |
| `components/ticket-detail/TicketReposicionDetail.svelte` | ~100 | Validación de reposición |
| `components/ticket-detail/TicketReporteFallaDetail.svelte` | ~20 | Detalle de reporte de falla |
| `components/person-form/PersonFormLocation.svelte` | ~65 | Sección de ubicación |
| `components/person-form/PersonFormSchedule.svelte` | ~50 | Sección de horario |
| `components/person-form/PersonFormAccess.svelte` | ~20 | Sección de accesos |
| `components/person-form/PersonFormCards.svelte` | ~55 | Gestión de tarjetas |
| `constants/status.ts` | — | Tipos estrictos para variants |
| `stores/tickets.svelte.ts` | — | Estandarización isLoading |
| `utils/realtime.ts` | — | Limpieza console.log |
