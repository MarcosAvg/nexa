# Estándar de Comentarios

> Guía para escribir comentarios claros, consistentes y mantenibles
> en todo el proyecto. Aplicable a archivos `.ts` y `.svelte`.

---

## Principios Generales

1. **Comenta el "por qué", no el "cómo"**
   - El código ya dice *qué* hace. El comentario debe explicar *por qué*
     se hace de esa manera.
   - ❌ `// Incrementar el contador en 1`
   - ✅ `// Se incrementa el contador porque esta ruta puede ejecutarse
     múltiples veces antes de persistir`

2. **No comentes lo obvio**
   - ❌ `// Crear variable para almacenar el nombre`
   - ❌ `// Llamar a la función fetch`
   - ✅ Omite el comentario si el código es autoexplicativo.

3. **Sé conciso**
   - Máximo 2-3 líneas por comentario inline.
   - Si necesitas más espacio, usa un bloque JSDoc.

4. **Usa español neutro**
   - Todos los comentarios en español, con tono técnico y profesional.

---

## Tipos de Comentarios

### 1. JSDoc para funciones y componentes

Todas las funciones exportadas, métodos de clase y componentes Svelte
deben tener un bloque JSDoc que describa su propósito.

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

```svelte
<!--
 * PersonFormLocation.svelte
 *
 * Sección de ubicación del formulario de persona.
 * Permite seleccionar edificio, piso base y pisos asignados.
 -->
<script lang="ts">
    let {
        /** Edificio seleccionado (two-way bindable). */
        edificio = $bindable(""),
        /** Lista de edificios disponibles en el catálogo. */
        buildings = [] as CatalogItem[],
    }: { ... } = $props();
</script>
```

### 2. Separadores de sección

Usar solo en archivos largos (+200 líneas) o con múltiples
responsabilidades claras.

Formato:
```typescript
// ─── Estado Global ────────────────────────────────────────────────
```

Reglas:
- Un separador por sección lógica (estado, derivados, acciones, template).
- Máximo 4-5 separadores por archivo.
- Deben tener el ancho completo (~80 chars) para separar visualmente.

### 3. Comentarios inline

Solo para:
- **Reglas de negocio** no obvias.
- **Edge cases** o valores mágicos.
- **Workarounds** técnicos (bugs de librerías, limitaciones).
- **Decisiones de diseño** importantes.

```typescript
// Se usa 24h como TTL porque las plantillas no cambian más de una vez al día.
const CACHE_TTL = 24 * 60 * 60 * 1000;
```

```typescript
// ⚠ svelte-spa-router requiere el helper wrap() para lazy loading.
// Si se migra a otro router, esto debe reemplazarse.
import { wrap } from "svelte-spa-router/wrap";
```

### 4. TODO, FIXME, HACK

Usar con moderación. Siempre incluir contexto y, si es posible,
referencia a un issue/ticket.

```typescript
// TODO: Centralizar este timeout en una constante compartida (JIRA-123)
// FIXME: Esta consulta falla cuando el usuario no tiene dependencia asignada
// HACK: Svelte 5 no soporta reactive Map, se usa objeto como workaround
```

---

## Componentes Svelte

### Props documentadas

Usar comentarios JSDoc inline para props:

```svelte
<script lang="ts">
    let {
        /** Controla si el modal está visible (two-way bindable). */
        isOpen = $bindable(false),
        /** Texto del botón de guardado. @default "Guardar" */
        saveLabel = "Guardar",
        /** Callback ejecutado al hacer clic en Guardar. */
        onSave = async () => {},
    }: { ... } = $props();
</script>
```

### Subcomponentes extraídos

Cada subcomponente debe tener un bloque de documentación que explique
su responsabilidad:

```svelte
<!--
 * TicketBajaDetail.svelte
 *
 * Panel de confirmación para tickets de tipo "Baja de Persona".
 * Muestra el conteo de tarjetas activas que serán desactivadas.
 */
```

---

## Convenciones Específicas

| Elemento | Estilo | Ejemplo |
|---|---|---|
| Archivo | Sin header (autor/fecha va en git) | — |
| Clase exportada | JSDoc bloque | `/** Gestiona el estado de tickets pendientes. */` |
| Función exportada | JSDoc bloque | `/** ... @param ... @returns ... */` |
| Función privada | Inline o sin comentario si es obvia | `// Calcula el folio cheque por tipo de tarjeta` |
| Prop de componente | JSDoc inline | `/** Texto del botón primario. */` |
| Constante global | Inline corto | `// TTL del caché en milisegundos (24h)` |
| Sección larga | Separador Unicode | `// ─── Acciones ────────────────────────────────────` |
| TODO | `// TODO: razón (referencia)` | `// TODO: Migrar a API unificada` |
| Workaround | `// ⚠` o `// HACK:` | `// ⚡ Svelte 5: los event listeners no se limpian solos` |

---

## Lo que NO debe comentarse

- ❌ `let x = 5; // Declarar x con valor 5`
- ❌ `import { foo } from "./bar"; // Importar foo`
- ❌ `export default function() { ... } // Exportar función por defecto`
- ❌ Comentarios de código muerto (eliminar el código directamente)
- ❌ Componentes genéricos autoexplicativos (Badge, Button, Input, Select, Modal, etc.).
  Estos no necesitan file header porque su propósito es obvio por su nombre.

---

## Casting y tipos comunes (lecciones de refactorización)

### Patrones para `unknown` de Supabase

Cuando Supabase devuelve datos de tipo `unknown`, usar `as` y `String()`:

```typescript
const newData = payload.new as Record<string, unknown>;
const name = String(newData.first_name ?? '');
```

### Variantes de Badge

Los helper functions que devuelven variantes de Badge deben tipar
correctamente el retorno:

```typescript
// ✅ Correcto: tipo unión concreto
export function getPersonnelStatusVariant(status: string): "emerald" | "amber" | "slate" | "rose" {
    // ...
}

// ❌ Incorrecto: tipo genérico string
export function getPersonnelStatusVariant(status: string): string {
    // ...
}
```

### Spread de datos desconocidos

Cuando se hace spread de un valor que podría ser `unknown`:

```typescript
// ❌ Falla si t es unknown
const mapped = data.map(t => ({ ...t } as Ticket));

// ✅ Doble cast via unknown
const mapped = data.map(t => ({ ...t } as unknown as Ticket));
```

### `batchPaginate` con Supabase

`batchPaginate` espera que el callback retorne `Promise<{ data, error }>`.
`PostgrestFilterBuilder` (el tipo que devuelve Supabase) **no implementa
Promise por defecto**, por lo que hay que envolverlo en una función async
Y proporcionar el tipo genérico `<any>`:

```typescript
// ✅ Correcto: async wrapper + tipo genérico
const items = await batchPaginate<any>(
    async (from, to) => {
        const { data, error } = await supabase
            .from("cards")
            .select("*")
            .range(from, to);
        return { data, error };
    },
    1000
);

// ❌ Error 1: falta el tipo genérico <any>
// ❌ Error 2: PostgrestFilterBuilder no es Promise válida
const items = await batchPaginate(
    (from, to) => supabase.from("cards").select("*").range(from, to),
    1000
);
```

### Conteo filtrado en Supabase

Cuando necesitas un conteo que respete los mismos filtros que el query
de datos, reutiliza la misma cadena de filtros:

```typescript
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

// Query de datos
const { data } = await buildQuery().range(from, to);
// Query de conteo (mismos filtros)
const { count } = await buildQuery(true);
```

### Eventos en Svelte

Siempre tipar el parámetro del evento para evitar `any` implícito:

```typescript
// ✅ Correcto
oninput={(e: Event) => handleInput(e)}

// ❌ Incorrecto: e es any implícito
oninput={(e) => handleInput(e)}
```

### Constructor de librería dinámica

Para imports dinámicos de constructores, castear via `unknown`:

```typescript
const Workbook = ExcelJSModule.default || ExcelJSModule;
const workbook = new (Workbook as unknown as { new(): any })();
```

---

## Mantenimiento

- Al refactorizar, actualiza los comentarios afectados.
- Los comentarios deben ser verdad. Un comentario incorrecto es peor
  que ningún comentario.
- Revisa los comentarios como parte del code review.
- Los patrones de casting y tipado documentados aquí provienen de
  errores reales encontrados y corregidos. Úsalos como referencia
  para evitar errores similares.
