<script lang="ts">
    /**
     * TicketModificacionDetail.svelte
     *
     * Displays the requested changes for a Modificación ticket type.
     */
    let {
        p = {} as Record<string, string>,
        onOpenCompare,
        disabled = false,
    }: {
        p: Record<string, string>;
        onOpenCompare: () => void;
        disabled?: boolean;
    } = $props();
</script>

<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
    <p class="text-xs font-bold text-amber-700 uppercase tracking-widest">
        Cambios solicitados
    </p>
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {#if p.nuevo_apellido}
            <div class="text-slate-500">Apellidos</div>
            <div class="text-amber-800 font-medium">{p.nuevo_apellido}</div>
        {/if}
        {#if p.nuevo_nombre}
            <div class="text-slate-500">Nombres</div>
            <div class="text-amber-800 font-medium">{p.nuevo_nombre}</div>
        {/if}
        {#if p.nueva_dep}
            <div class="text-slate-500">Dependencia</div>
            <div class="text-amber-800 font-medium">{p.nueva_dep}</div>
        {/if}
        {#if p.nuevo_edificio}
            <div class="text-slate-500">Edificio</div>
            <div class="text-amber-800 font-medium">{p.nuevo_edificio}</div>
        {/if}
        {#if p.nuevo_piso}
            <div class="text-slate-500">Piso Base</div>
            <div class="text-amber-800 font-medium">{p.nuevo_piso}</div>
        {/if}
        {#if p.nueva_area}
            <div class="text-slate-500">Área</div>
            <div class="text-amber-800 font-medium">{p.nueva_area}</div>
        {/if}
        {#if p.nuevo_puesto}
            <div class="text-slate-500">Puesto</div>
            <div class="text-amber-800 font-medium">{p.nuevo_puesto}</div>
        {/if}
        {#if p.hora_entrada}
            <div class="text-slate-500">Hora Entrada</div>
            <div class="text-amber-800 font-medium">{p.hora_entrada}</div>
        {/if}
        {#if p.hora_salida}
            <div class="text-slate-500">Hora Salida</div>
            <div class="text-amber-800 font-medium">{p.hora_salida}</div>
        {/if}
        {#if p.accion_p2000}
            <div class="text-slate-500">Acción P2000</div>
            <div class="text-amber-800 font-medium">
                {p.accion_p2000}: {p.pisos_p2000 || "N/A"}
            </div>
        {/if}
        {#if p.accion_kone}
            <div class="text-slate-500">Acción KONE</div>
            <div class="text-amber-800 font-medium">
                {p.accion_kone}: {p.pisos_kone || "N/A"}
            </div>
        {/if}
        {#if p.accion_acc}
            <div class="text-slate-500">Acción Acc. Esp.</div>
            <div class="text-amber-800 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {p.accion_acc}: {[p.acceso1, p.acceso2, p.acceso3].filter(Boolean).join(", ") || "N/A"}
            </div>
        {/if}
    </div>
    <p class="text-[10px] text-amber-600 mt-1">
        Al hacer clic en "Revisar Cambios" se abrirá el panel de
        comparación completo con los datos actuales vs. propuestos.
    </p>
</div>
