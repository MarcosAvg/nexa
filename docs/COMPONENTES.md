# Documentación de Componentes — Nexa

> Catálogo completo de componentes de UI, organizados por categoría.
> Este archivo complementa la sección 6.8 de `CONTRIBUTING.md`.

---

## Sistema de Barrels (Importación)

Todos los componentes se exportan a través de **barrel files** para centralizar las importaciones.

### Estructura de barrels

```
src/lib/components/
├── index.ts              # Barrel raíz — exporta TODOS los componentes
├── modals/
│   └── index.ts          # Barrel de modales (importado por barrel raíz)
├── catalogs/
│   └── index.ts          # Barrel de catálogos (importado por barrel raíz)
├── ... (componentes .svelte)
```

- **Barrel raíz** (`index.ts`): Exporta los 42 componentes base + re-exporta `modals/` y `catalogs/` vía `export * from`.
- **Barrels anidados** (`modals/index.ts`, `catalogs/index.ts`): Exportan sus componentes específicos.

### Patrón de importación recomendado

```ts
// ✅ RECOMENDADO — desde el barrel raíz (un solo import)
import { Button, Card, DataTable, TicketModal, BuildingCatalog } from "../components";

// ✅ TAMBIÉN VÁLIDO — desde barrels anidados (explícito)
import { TicketModal, ConfirmationModal } from "../components/modals";
import { BuildingCatalog, ScheduleCatalog } from "../components/catalogs";

// ❌ EVITAR — import directo del archivo (excepto en imports internos entre componentes)
import Button from "../components/Button.svelte";     // Evitar en vistas
import TicketModal from "../components/modals/TicketModal.svelte"; // Evitar en vistas
```

> **Nota:** Los componentes internos que importan desde `./modals/` o `./catalogs/` (por ejemplo, `GlobalOverlays.svelte` importando `./modals/PersonModal`) usan rutas relativas y no necesitan cambiar.

### Lista completa de componentes exportados

El barrel raíz exporta **62 componentes** en total:

| Categoría | Cantidad | Componentes |
|---|---|---|
| Base UI | 15 | Badge, Button, Card, CardItem, Input, Modal, Pagination, Select, SkeletonTable, EmptyState, SkeletonCard, ContentView, SearchInput, FormSection, FormField |
| Filters | 4 | FilterGroup, FilterSelect, ToggleGroup, SectionHeader |
| Data Display | 5 | DataTable, ExportDropdown, TaskBanner, HistoryFilters, SignaturePad |
| Layout | 9 | DashboardLayout, MainLayoutWrapper, Sidebar, BottomNav, GlobalOverlays, CommandPalette, FloatingActionButton, Logo, SidePanel |
| Permissions | 1 | PermissionGuard |
| Domain | 3 | PersonDetailsPanel, ResponsivaPreviewModal, ResponsivaTemplate |
| Catalog Selects | 4 | CatalogSelect, DependencySelect, BuildingSelect, ScheduleSelect |
| Modales (re-exportados) | 16 | AddCardModal, AddEnlaceModal, CardlessRegistryModal, ConfirmAltaModal, ConfirmationModal, DeletePersonnelModal, DetectMissingCardsModal, EditEnlaceModal, ImportPreviewModal, KoneUsageImportModal, ManualTicketDetailsModal, ModificationCompareModal, PersonModal, SignatureModal, TicketImportedDetailsModal, TicketModal |
| Catálogos (re-exportados) | 5 | BuildingCatalog, DependencyCatalog, AccessCatalog, ScheduleCatalog, UserManagementSection |

---

## Índice

1. [Componentes Base (continuación)](#1-componentes-base-continuación)
2. [Componentes de Layout](#2-componentes-de-layout)
3. [Componentes de Dominio](#3-componentes-de-dominio)
4. [Catálogos (Settings)](#4-catálogos-settings)
5. [Modales](#5-modales)

---

## 1. Componentes Base (continuación)

> Continuación de la sección `6.8 Componentes Base de UI` de CONTRIBUTING.md.

### `Pagination` — Paginación con ellipsis

**Ubicación:** `src/lib/components/Pagination.svelte`

```svelte
<Pagination
    currentPage={page}
    pageSize={50}
    totalRecords={234}
    onPrevPage={() => store.prevPage()}
    onNextPage={() => store.nextPage()}
    onGoToPage={(p) => store.goToPage(p)}
    isLoading={store.isLoading}
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `currentPage` | `number` | — |
| `pageSize` | `number` | — |
| `totalRecords` | `number` | — |
| `onPrevPage` | `() => void` | — |
| `onNextPage` | `() => void` | — |
| `onGoToPage` | `(page: number) => void` | — |
| `isLoading` | `boolean` | `false` |

Muestra el contador "Mostrando X–Y de Z", botones Anterior/Siguiente, y botones de página con ellipsis. Se oculta automáticamente si `totalRecords === 0`.

**Vistas que lo usan:** `PersonnelView`, `CardsView`, `TicketsView`, `HistoryView`, `EnlacesView`, `RegistroSinTarjetaView`

---

### `PermissionGuard` — Control de acceso por rol

**Ubicación:** `src/lib/components/PermissionGuard.svelte`

```svelte
<PermissionGuard requireAdmin disabledOnly>
    {#snippet children({ disabled })}
        <button {disabled} onclick={handleDelete}>Eliminar</button>
    {/snippet}
</PermissionGuard>

<PermissionGuard requireEdit>
    <Button onclick={onEdit}>Editar</Button>
</PermissionGuard>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `requireAdmin` | `boolean` | `false` | Solo admin puede ver |
| `requireEdit` | `boolean` | `false` | Admin u operator pueden ver |
| `disabledOnly` | `boolean` | `false` | Si no tiene permiso, pasa `disabled` a los hijos en vez de ocultarlos |
| `children` | `Snippet<[{ disabled: boolean }]>` | — | Render prop con `disabled` |

**Modos:**
- **Ocultar** (default): `requireAdmin` / `requireEdit` → si no cumple, no renderiza
- **Deshabilitar** (`disabledOnly`): Renderiza igual pero pasa `disabled: true` al snippet

Útil para botones de eliminar (solo admin) vs editar (admin/operator).

---

### `SectionHeader` — Encabezado de vista con filtros

**Ubicación:** `src/lib/components/SectionHeader.svelte`

```svelte
<SectionHeader title="Personal" subtitle="Gestión de colaboradores">
    {#snippet filters()}
        <SearchInput bind:value={search} oninput={onSearch} />
    {/snippet}
    {#snippet actions()}
        <Button onclick={onCreate}>Nuevo</Button>
    {/snippet}
</SectionHeader>
```

| Prop | Tipo | Default |
|---|---|---|
| `title` | `string` | — |
| `subtitle` | `string` | `""` |
| `filters` | `Snippet` | — |
| `actions` | `Snippet` | — |

En móvil, los filtros se colapsan detrás de un botón de "Filtros" y las acciones se muestran en la parte inferior.

**Vistas que lo usan:** Todas las vistas principales.

---

### `FilterGroup` — Botones tipo pill

**Ubicación:** `src/lib/components/FilterGroup.svelte`

```svelte
<FilterGroup
    label="Estado"
    options={["Todos", "Activo/a", "Parcial", "Baja"]}
    bind:value={statusFilter}
    onchange={onFilterChange}
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `label` | `string` | — |
| `options` | `string[]` | `[]` |
| `value` | `string` (bindable) | — |
| `onchange` | `() => void` | — |

Renderiza botones tipo pill para selección única. El seleccionado tiene fondo slate-900. Ideal para filtros de estado.

---

### `FilterSelect` — Select con label

**Ubicación:** `src/lib/components/FilterSelect.svelte`

```svelte
<FilterSelect
    label="Dependencia"
    options={catalogState.dependencies.map(d => d.name)}
    bind:value={depFilter}
    placeholder="Todas"
    onchange={onFilterChange}
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `label` | `string` | — |
| `options` | `string[]` | `[]` |
| `value` | `string` (bindable) | — |
| `placeholder` | `string` | `"Seleccionar..."` |
| `onchange` | `() => void` | — |

Select compacto con label arriba. Usado en los headers de filtros de las vistas.

---

### `ToggleGroup` — Multi-selección con checkboxes

**Ubicación:** `src/lib/components/ToggleGroup.svelte`

```svelte
<ToggleGroup
    label="Pisos Asignados P2000"
    options={["PB", "1°", "2°", "3°"]}
    bind:value={selectedFloors}
    showSelectAll={true}
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `label` | `string` | — |
| `options` | `string[]` | `[]` |
| `value` | `string[]` (bindable) | — |
| `showSelectAll` | `boolean` | `false` |

Cada opción es un badge clickeable. Con `showSelectAll`, agrega opción "Todos" al inicio. Usado en `PersonModal` para pisos P2000/KONE y accesos especiales.

---

### `ExportDropdown` — Menú de exportación

**Ubicación:** `src/lib/components/ExportDropdown.svelte`

```svelte
<ExportDropdown
    items={[
        { label: "Excel General", onclick: () => exportAll(), icon: FileSpreadsheet },
        { label: "ZIP por Dependencia", onclick: () => exportZip(), icon: FolderArchive },
    ]}
/>
```

| Prop | Tipo | Default |
|---|---|---|
| `items` | `{ label: string; onclick: () => void; icon?: ComponentType }[]` | `[]` |

Muestra un botón que al clickearlo despliega un menú contextual con las opciones. Incluye cierre automático al hacer click fuera.

---


---

## 2. Componentes de Layout

### `DashboardLayout` — Layout principal de la app

**Ubicación:** `src/lib/components/DashboardLayout.svelte`

```svelte
<DashboardLayout sidebarItems={items} user={currentUser} onLogout={handleLogout}>
    <Router {routes} />
</DashboardLayout>
```

| Prop | Tipo | Descripción |
|---|---|---|
| `sidebarItems` | `{ label: string; href: string; icon?: any }[]` | Items de navegación |
| `user` | `{ name: string; email: string; avatar?: string }` | Usuario actual |
| `headerTitle` | `Snippet` | Título opcional del header |
| `children` | `Snippet` | Contenido principal |
| `onLogout` | `() => void` | Handler de cierre de sesión |

Compone `Sidebar` + `main` + `BottomNav`. El main tiene scroll independiente y padding responsive (`p-4 pb-24 lg:p-10`). Ancho máximo de contenido: `1600px`.

---

### `MainLayoutWrapper` — Wrapper de layout con lógica de ruta

**Ubicación:** `src/lib/components/MainLayoutWrapper.svelte`

Envuelve `<DashboardLayout>` con lógica adicional:
- **Sincroniza `uiState.activePage`** según la ruta actual usando `$location`
- **Banner offline** (barra roja fija cuando `!networkStore.isOnline`)
- **Incluye `CommandPalette`** global (accesible con `Ctrl+K`)
- **Filtra items del sidebar** según rol del usuario (Settings solo para admin)

No recibe props significativas — usa stores directamente.

---

### `Sidebar` — Navegación lateral

**Ubicación:** `src/lib/components/Sidebar.svelte`

```svelte
<Sidebar items={navItems} user={currentUser} onLogout={handleLogout} />
```

| Prop | Tipo | Descripción |
|---|---|---|
| `items` | `{ label: string; href: string; icon?: any }[]` | Links de navegación |
| `user` | `{ name: string; email: string; avatar?: string }` | Usuario actual |
| `onLogout` | `() => void` | Cerrar sesión |

**Características:**
- Modo expandido (w-72) y condensado (w-20) controlado por `uiState.isSidebarCondensed`
- Animaciones de hover/active en items con glow azul
- Indicador de página activa con barra lateral + punto
- Botón "Modo Dios" para admin (edición directa de estados)
- Perfil de usuario con avatar, nombre y botón de logout
- Copyright en el footer
- En móvil, se superpone con backdrop blur

---

### `BottomNav` — Navegación inferior (móvil)

**Ubicación:** `src/lib/components/BottomNav.svelte`

Navegación inferior fija, visible solo en `lg:hidden`. Muestra 4 items principales (Inicio, Personal, Tarjetas, Pendientes) + botón de menú que abre la sidebar.

- Item activo: punto azul arriba + icono azul + texto azul
- Botón menú: toggle `uiState.isSidebarOpen`
- Respeta `safe-area-inset-bottom`

---

### `GlobalOverlays` — Overlays globales de la app

**Ubicación:** `src/lib/components/GlobalOverlays.svelte`

No recibe props — orquesta todos los modales globales:

```svelte
<PersonDetailsPanel />        <!-- Panel lateral de detalles -->
<PersonModal />               <!-- Modal de edición de persona -->
<AddCardModal />              <!-- Modal de añadir tarjeta -->
<ConfirmationModal />         <!-- Confirmación singleton (confirm) -->
<DeletePersonnelModal />      <!-- Modal de eliminación permanente -->
```

Además:
- Escucha evento `TRIGGER_DEACTIVATE` para abrir confirmación de baja
- Gestiona estado local de `isCardModalOpen`, `replacingCard`, `deleteModal`
- Provee handlers `onBlock`, `onDeactivate`, `onReactivate`, `onDeletePermanent`, etc.

---

### `CommandPalette` — Buscador global (Ctrl+K)

**Ubicación:** `src/lib/components/CommandPalette.svelte`

```svelte
<!-- Se incluye automáticamente en MainLayoutWrapper -->
```

Atajo: `Ctrl+K` o `Cmd+K`.

**Características:**
- Búsqueda combinada: personal + tarjetas + acciones rápidas + navegación
- Resultados con categorías (Personal, Tarjeta, Acción, Navegación)
- Navegación con flechas y Enter para ejecutar
- Auto-foco al abrir
- Shimmer de carga mientras busca
- Vista vacía con sugerencias de navegación
- Cierra con Escape o click fuera

**Elementos de búsqueda:**
- **Acciones rápidas:** Nueva Alta de Personal, Gestión de Enlaces, Configuración
- **Navegación:** Dashboard, Personal, Inventario, Tickets, Auditoría
- **Personal:** Busca por nombre/apellido en Supabase (top 5)
- **Tarjetas:** Busca por folio en Supabase (top 5)

---

### `FloatingActionButton` — Botón flotante (móvil)

**Ubicación:** `src/lib/components/FloatingActionButton.svelte`

```svelte
<FloatingActionButton onclick={createNew} label="Nuevo registro" icon={Plus} />
```

| Prop | Tipo | Default |
|---|---|---|
| `onclick` | `() => void` | — |
| `icon` | `ComponentType` | `Plus` |
| `label` | `string` | `"Crear nuevo"` |

Visible solo en móvil (`lg:hidden`), posicionado sobre el BottomNav.

---

### `Logo` — Logotipo Nexa

**Ubicación:** `src/lib/components/Logo.svelte`

```svelte
<Logo showText={true} class="scale-110" />
```

| Prop | Tipo | Default |
|---|---|---|
| `showText` | `boolean` | `true` |
| `class` | `string` | `""` |

Hexágono gradiente azul-índigo + texto "Nexa".

---

### `SidePanel` — Panel lateral deslizante

**Ubicación:** `src/lib/components/SidePanel.svelte`

```svelte
<SidePanel bind:isOpen title="Detalles" subtitle="Nombre" onclose={handleClose}>
    <!-- contenido -->

    {#snippet footer()}
        <Button onclick={close}>Cerrar</Button>
    {/snippet}
</SidePanel>
```

| Prop | Tipo | Default |
|---|---|---|
| `isOpen` | `boolean` (bindable) | — |
| `title` | `string` | — |
| `subtitle` | `string` | `""` |
| `children` | `Snippet` | — |
| `footer` | `Snippet` | — |
| `onclose` | `() => void` | — |

**Responsive:** En móvil se despliega desde abajo (bottom sheet, 85vh), en escritorio desde la derecha (max-w-lg).

---

## 3. Componentes de Dominio

### `PersonDetailsPanel` — Detalles de persona

**Ubicación:** `src/lib/components/PersonDetailsPanel.svelte`

Panel lateral completo con información detallada de una persona. Usa `SidePanel` internamente.

| Prop | Tipo |
|---|---|
| `isOpen` | `boolean` (bindable) |
| `person` | `Person \| null` |
| `onEdit` | `(person) => void` |
| `onBlock` | `(person) => void` |
| `onDeactivate` | `(person) => void` |
| `onReactivate` | `(person) => void` |
| `onDeletePermanent` | `(person) => void` |
| `onCardAdd` | `(person) => void` |
| `onCardBlock` | `(card) => void` |
| `onCardUnassign` | `(card) => void` |
| `onCardReplace` | `(card) => void` |
| `onCardProgram` | `(card) => void` |
| `onRefresh` | `() => Promise<void>` |

**Secciones:**
1. **Información General:** Nombres, apellidos, empleado, dependencia, correo, área, puesto
2. **Ubicación:** Edificio, piso base
3. **Pisos Asignados:** P2000 (puertas), KONE (elevadores) — separados por tipo
4. **Accesos Especiales** (si tiene)
5. **Horario:** Días, entrada, salida
6. **Estado:** Badge de estado
7. **Acciones Rápidas:** Editar, Bloquear, Baja (o Reactivar y Eliminar si está inactivo)
8. **Tarjetas Asignadas:** Lista de `CardItem` con botón "Asignar Tarjeta"
9. **Historial de Responsivas:** Lista de responsivas firmadas con opción Ver/Eliminar

---

### `CardItem` — Item de tarjeta en panel de detalles

**Ubicación:** `src/lib/components/CardItem.svelte`

```svelte
<CardItem
    type="KONE"
    folio="KNE-001"
    status="active"
    programming_status="done"
    responsiva_status="signed"
    isHighlighted={true}
    onGenerateResponsiva={handleGen}
    onBlock={handleBlock}
    onUnassign={handleUnassign}
    onReplace={handleReplace}
    onProgram={handleProgram}
    onPrint={handlePrint}
    onDirectStatusChange={uiState.isDirectEditMode ? handleStatusChange : undefined}
/>
```

| Prop | Tipo |
|---|---|
| `type` | `"P2000" \| "KONE"` |
| `folio` | `string` |
| `status` | `"active" \| "blocked" \| "inactive"` |
| `responsiva_status` | `string` |
| `programming_status` | `string` |
| `isHighlighted` | `boolean` |
| Acciones | Callbacks variados |

**Botones de acción:**
- **Responsiva** (verde): Solo activo si `programming_status === "done"`
- **Programar** (azul): Visible solo si `programming_status !== "done"`
- **Imprimir** (gris): Genera PDF de la tarjeta
- **Bloquear** (ámbar): Toggle block/unblock
- **Reposición** (índigo): Abre flujo de reemplazo
- **Baja** (rosa): Desvincula la tarjeta

**Modo Dios:** Si `uiState.isDirectEditMode` está activo y se pasa `onDirectStatusChange`, muestra un panel extra para cambiar estados directamente (responsiva: Sin Firmar/Legacy/Firmada, programación: Sin Programar/Programada).

---

### `TaskBanner` — Tarjeta de ticket pendiente

**Ubicación:** `src/lib/components/TaskBanner.svelte`

```svelte
<TaskBanner ticket={ticket} onManage={handleManage} onComplete={handleComplete} />
```

| Prop | Tipo |
|---|---|
| `ticket` | `Ticket` |
| `onManage` | `(ticket) => void` |
| `onComplete` | `(ticket) => void` |

Renderiza una tarjeta visual para un ticket pendiente:

- **Header:** Icono por tipo (Programación→CreditCard, Firma→FileSignature, Alta→User, etc.) + prioridad (Badge)
- **Cuerpo:** Título, descripción (2 líneas cada uno)
- **Metadatos:** Persona (avatar circular + nombre), fecha, folio de tarjeta
- **Footer:** Botón "Completar" (para Programación/Firma/Modificación) o "Gestionar Ticket"

Configuración visual por tipo de ticket (icono, color de borde/fondo/texto).

---

### `HistoryFilters` — Filtros del Historial

**Ubicación:** `src/lib/components/HistoryFilters.svelte`

```svelte
<HistoryFilters
    bind:personName
    bind:cardType
    bind:cardFolio
    bind:action
/>
```

| Prop | Tipo (bindable) |
|---|---|
| `personName` | `string` |
| `cardType` | `string` |
| `cardFolio` | `string` |
| `action` | `string` |

Cuatro campos de filtro: Persona (input con Search), Tipo de Tarjeta (Select), Folio (input), Acción (Select con `ACTION_NAMES` ordenados alfabéticamente).

---

### `ResponsivaPreviewModal` — Vista previa de responsiva

**Ubicación:** `src/lib/components/ResponsivaPreviewModal.svelte`

Modal que muestra la previsualización de una Carta Responsiva. Incluye:

- **Modo texto y modo PDF** (toggle)
- **Verificación de integridad** (hash SHA-256)
- **Firma** → abre `SignatureModal` → guarda en `signed_responsivas`
- **Descarga PDF** con `generateResponsivaPdf`
- **Envío por email** con Web Share API o fallback mailto
- **Prompt de correo** si la persona no tiene email registrado

---

### `SignaturePad` — Pad de firma digital

**Ubicación:** `src/lib/components/SignaturePad.svelte`

```svelte
<SignaturePad onSave={handleSave} onCancel={handleCancel} loading={isSaving} />
```

| Prop | Tipo |
|---|---|
| `onSave` | `(signatureBase64: string) => void` |
| `onCancel` | `() => void` |
| `loading` | `boolean` |

**Características:**
- Canvas con soporte para mouse, touch y stylus
- Grosor de trazo adaptativo: usa presión del lápiz si disponible, velocidad como fallback
- Suavizado con curvas cuadráticas
- **Modo Tableta:** Overlay de pantalla completa con zona de captura adaptativa — el primer toque define el centro, ideal para firmar en tablet
- Toolbar flotante con botones Limpiar, Confirmar, Cerrar
- Soporte High-DPI (devicePixelRatio)
- Cancelación con Escape

---

## 4. Catálogos (Settings)

> Componentes utilizados en `SettingsView.svelte` para gestionar catálogos.

### `BuildingCatalog` — Gestión de edificios

**Ubicación:** `src/lib/components/catalogs/BuildingCatalog.svelte`

```svelte
<BuildingCatalog canEdit={isAdmin} />
```

| Prop | Tipo |
|---|---|
| `canEdit` | `boolean` |

Muestra tarjetas de edificios con nombre y pisos. Botón "Nuevo Edificio". Modal de creación/edición con campo de nombre + pisos separados por coma. Modal de eliminación con confirmación por nombre exacto.

### `DependencyCatalog` — Gestión de dependencias

**Ubicación:** `src/lib/components/catalogs/DependencyCatalog.svelte`

```svelte
<DependencyCatalog canEdit={isAdmin} />
```

Muestra `DataTable` con todas las dependencias. Modal CRUD simple con campo de nombre.

### `AccessCatalog` — Gestión de accesos especiales

**Ubicación:** `src/lib/components/catalogs/AccessCatalog.svelte`

```svelte
<AccessCatalog canEdit={isAdmin} />
```

Muestra `DataTable` con todos los accesos especiales. Cada fila muestra un ícono `Key`. Modal CRUD simple.

### `ScheduleCatalog` — Gestión de horarios

**Ubicación:** `src/lib/components/catalogs/ScheduleCatalog.svelte`

```svelte
<ScheduleCatalog canEdit={isAdmin} />
```

Muestra `DataTable` con horarios (nombre + días). Modal con nombre + checkboxes para Lunes-Domingo.

### `UserManagementSection` — Gestión de usuarios

**Ubicación:** `src/lib/components/catalogs/UserManagementSection.svelte`

Muestra `DataTable` de usuarios con nombre/email y rol (Badge admin/operator/visor). Modal de edición con campos de nombre, email (solo lectura), y selector de rol con descripción de permisos.
---

## 5. Modales

> Modales específicos de dominio en `src/lib/components/modals/`.

### `AddCardModal` — Asignar/crear tarjeta

**Ubicación:** `src/lib/components/modals/AddCardModal.svelte`

```svelte
<AddCardModal
    bind:isOpen
    mode="assign"           <!-- "assign" | "inventory" -->
    replacingCard={null}    <!-- { type, folio, id } | null -->
    allowedCardTypes={null} <!-- ["P2000"] para restringir -->
    onSave={handleSave}
    onclose={handleClose}
/>
```

**Flujo inteligente:** Al escribir un folio, busca en inventario local y luego en Supabase. Muestra estado en tiempo real:
- **Disponible** (verde) — Lista para asignar
- **Ocupado** (rojo) — Ya pertenece a otra persona
- **Restringido** (gris) — Bloqueada o inactiva
- **Nuevo** (ámbar) — No existe, se creará (requiere confirmación extra)

Incluye selector de tipo (P2000/KONE) con diseño de tarjetas visuales.

### `AddEnlaceModal` — Asignar enlace

**Ubicación:** `src/lib/components/modals/AddEnlaceModal.svelte`

Busca persona por nombre (debounce 300ms), muestra resultados, selecciona y asigna extensión.

### `EditEnlaceModal` — Editar extensión

**Ubicación:** `src/lib/components/modals/EditEnlaceModal.svelte`

Modal simple para editar la extensión telefónica de un enlace existente.

### `CardlessRegistryModal` — Registro sin tarjeta

**Ubicación:** `src/lib/components/modals/CardlessRegistryModal.svelte`

**Flujo:** Campos de nombre/apellido → búsqueda automática de persona en BD → vinculación opcional → selección de edificio/piso/motivo → guardado.

Características:
- Búsqueda automática al escribir nombre y apellido (350ms debounce)
- Chip de persona vinculada con estado KONE (pendiente, entregada, sin tarjeta)
- Snapshot `kone_status_at_registration` para precisión histórica
- Validación completa antes de enviar
- Modal de eliminación incluido

### `DeletePersonnelModal` — Eliminación permanente

**Ubicación:** `src/lib/components/modals/DeletePersonnelModal.svelte`

Confirmación de eliminación irreversible con gestión de tarjetas. Cada tarjeta tiene toggle: "ELIMINAR" o "DEJAR DISPONIBLE". Al confirmar, ejecuta las acciones según el mapa de decisiones.

### `DetectMissingCardsModal` — Detectar tarjetas faltantes

**Ubicación:** `src/lib/components/modals/DetectMissingCardsModal.svelte`

Analiza rangos de folios KONE y cruza con historial para detectar tarjetas no devueltas. Muestra tabla con folio, motivo (Extravío, Eliminada, etc.) y persona responsable. Permite exportar a Excel.

### `ImportPreviewModal` — Importación de plantilla Excel

**Ubicación:** `src/lib/components/modals/ImportPreviewModal.svelte`

Flujo completo de importación de plantilla Excel: parsea el archivo, muestra resultados, busca coincidencias en BD y permite confirmar la creación de tickets en lote con `ticketService.createBatch()`. Los pasos (idle, parsed, review) se manejan internamente en el modal.

### `KoneUsageImportModal` — Importar conteo KONE

**Ubicación:** `src/lib/components/modals/KoneUsageImportModal.svelte`

Flujo similar a ImportPreviewModal pero para archivos de conteo de uso KONE. Analiza el archivo, muestra resultados, y exporta a Excel.
