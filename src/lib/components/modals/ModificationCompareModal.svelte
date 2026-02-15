<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { personnelService } from "../../services";
    import { HistoryService } from "../../services/history";
    import { ticketService } from "../../services/tickets";
    import { personnelState, ticketState } from "../../stores";
    import { cardService } from "../../services/cards";
    import { toast } from "svelte-sonner";
    import { ArrowRight, Plus, Minus, User } from "lucide-svelte";
    import type { Ticket } from "../../types";

    let {
        isOpen = $bindable(false),
        ticket = null,
        onComplete,
    }: {
        isOpen: boolean;
        ticket?: Ticket | null;
        onComplete?: () => void;
    } = $props();

    let isSubmitting = $state(false);

    // Get person data from store (current DB state)
    let currentPerson = $derived.by(() => {
        if (!ticket?.person_id) return null;
        return (
            personnelState.personnel.find((p) => p.id === ticket.person_id) ||
            null
        );
    });

    // Get modified data from ticket payload
    let modifiedData = $derived(ticket?.payload?.modified || null);

    // Field definitions for comparison
    const fieldDefs = [
        {
            label: "Nombre(s)",
            currentKey: "first_name",
            modifiedKey: "nombres",
            fallbackKey: "first_name",
        },
        {
            label: "Apellidos",
            currentKey: "last_name",
            modifiedKey: "apellidos",
            fallbackKey: "last_name",
        },
        {
            label: "No. Empleado",
            currentKey: "employee_no",
            modifiedKey: "noEmpleado",
            fallbackKey: "employee_no",
        },
        {
            label: "Dependencia",
            currentKey: "dependency",
            modifiedKey: "dependency",
        },
        {
            label: "Área / Equipo",
            currentKey: "area",
            modifiedKey: "areaEquipo",
            fallbackKey: "area",
        },
        {
            label: "Puesto / Función",
            currentKey: "position",
            modifiedKey: "puestoFuncion",
            fallbackKey: "position",
        },
        { label: "Edificio", currentKey: "building", modifiedKey: "edificio" },
        {
            label: "Piso Base",
            currentKey: "floor",
            modifiedKey: "pisoBase",
            fallbackKey: "floor",
        },
        { label: "Email", currentKey: "email", modifiedKey: "email" },
    ];

    function getValue(obj: any, key: string, fallbackKey?: string): string {
        if (!obj) return "—";
        const val = obj[key] ?? (fallbackKey ? obj[fallbackKey] : undefined);
        if (val === null || val === undefined || val === "") return "—";
        return String(val);
    }

    function isChanged(currentVal: string, modifiedVal: string): boolean {
        return currentVal !== modifiedVal && modifiedVal !== "—";
    }

    // Floor array comparison helpers
    function getFloorChanges(
        currentFloors: string[],
        modifiedFloors: string[],
    ) {
        const added = modifiedFloors.filter((f) => !currentFloors.includes(f));
        const removed = currentFloors.filter(
            (f) => !modifiedFloors.includes(f),
        );
        const kept = modifiedFloors.filter((f) => currentFloors.includes(f));
        return { added, removed, kept };
    }

    function getCurrentFloors(key: string): string[] {
        if (!currentPerson) return [];
        return (currentPerson as any)[key] || [];
    }

    function getModifiedFloors(key: string, fallbackKey?: string): string[] {
        if (!modifiedData) return [];
        return (
            modifiedData[key] ||
            (fallbackKey ? modifiedData[fallbackKey] : []) ||
            []
        );
    }

    // Schedule comparison
    function getCurrentScheduleEntry(): string {
        return currentPerson?.schedule?.entry || "—";
    }
    function getCurrentScheduleExit(): string {
        return currentPerson?.schedule?.exit || "—";
    }
    function getModifiedEntry(): string {
        return modifiedData?.entry_time || modifiedData?.horaEntrada || "—";
    }
    function getModifiedExit(): string {
        return modifiedData?.exit_time || modifiedData?.horaSalida || "—";
    }

    async function handleConfirm() {
        if (isSubmitting || !ticket || !currentPerson) return;
        isSubmitting = true;

        try {
            // Build the save payload from modified data
            const saveData = {
                id: currentPerson.id,
                ...modifiedData,
            };

            await personnelService.save(saveData);

            // Delete the ticket
            await ticketService.delete(
                ticket.id,
                `Modificación aprobada: ${ticket.description}`,
            );

            // Log the modification approval
            await HistoryService.log(
                "PERSONNEL",
                currentPerson.id,
                "APPLY_MODIFICATION",
                {
                    message: `Modificación de datos aprobada para ${currentPerson.name}`,
                },
            );

            // Refresh data
            const [updatedPersonnel, updatedCards] = await Promise.all([
                personnelService.fetchAll(),
                cardService.fetchExtra(),
            ]);
            personnelState.setPersonnel(updatedPersonnel);
            personnelState.setCards(updatedCards);

            toast.success("Cambios aplicados", {
                description: "Los datos de la persona han sido actualizados.",
            });

            isOpen = false;
            onComplete?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al aplicar cambios");
        } finally {
            isSubmitting = false;
        }
    }

    async function handleReject() {
        if (isSubmitting || !ticket) return;
        isSubmitting = true;

        try {
            await ticketService.delete(
                ticket.id,
                `Modificación rechazada: ${ticket.description}`,
            );

            // Log the rejection
            await HistoryService.log(
                "PERSONNEL",
                ticket.person_id || "",
                "REJECT_MODIFICATION",
                {
                    message: `Modificación de datos rechazada`,
                },
            );
            toast.info("Ticket rechazado", {
                description: "Los cambios no se aplicaron.",
            });
            isOpen = false;
            onComplete?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al rechazar ticket");
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title="Revisión de Modificación de Datos"
    description={ticket?.description ||
        "Comparación de datos actuales vs. propuestos"}
    size="xl"
>
    {#if currentPerson && modifiedData}
        <div class="space-y-6">
            <!-- Person Header -->
            <div
                class="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"
            >
                <div
                    class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"
                >
                    <User size={20} />
                </div>
                <div>
                    <p class="font-bold text-slate-800">{currentPerson.name}</p>
                    <p class="text-xs text-slate-500">
                        No. Empleado: {currentPerson.employee_no} · {currentPerson.dependency}
                    </p>
                </div>
            </div>

            <!-- Column Headers -->
            <div class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div class="text-center">
                    <p
                        class="text-xs font-bold text-slate-500 uppercase tracking-widest"
                    >
                        Datos Actuales
                    </p>
                </div>
                <div class="w-6"></div>
                <div class="text-center">
                    <p
                        class="text-xs font-bold text-slate-500 uppercase tracking-widest"
                    >
                        Datos Propuestos
                    </p>
                </div>
            </div>

            <!-- Text Fields Comparison -->
            <div class="space-y-2">
                {#each fieldDefs as field}
                    {@const currentVal = getValue(
                        currentPerson,
                        field.currentKey,
                    )}
                    {@const modifiedVal = getValue(
                        modifiedData,
                        field.modifiedKey,
                        field.fallbackKey,
                    )}
                    {@const changed = isChanged(currentVal, modifiedVal)}

                    <div
                        class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center"
                    >
                        <!-- Current Value -->
                        <div
                            class="p-3 rounded-lg border {changed
                                ? 'border-slate-300 bg-slate-50'
                                : 'border-slate-200 bg-white'}"
                        >
                            <p
                                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                {field.label}
                            </p>
                            <p class="text-sm text-slate-700">{currentVal}</p>
                        </div>

                        <!-- Arrow -->
                        <div class="flex items-center justify-center">
                            {#if changed}
                                <div
                                    class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"
                                >
                                    <ArrowRight
                                        size={14}
                                        class="text-amber-600"
                                    />
                                </div>
                            {:else}
                                <div
                                    class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"
                                >
                                    <span class="text-slate-300 text-xs">=</span
                                    >
                                </div>
                            {/if}
                        </div>

                        <!-- Modified Value -->
                        <div
                            class="p-3 rounded-lg border {changed
                                ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                                : 'border-slate-200 bg-white'}"
                        >
                            <p
                                class="text-[10px] font-bold {changed
                                    ? 'text-amber-600'
                                    : 'text-slate-400'} uppercase tracking-wider mb-1"
                            >
                                {field.label}
                            </p>
                            <p
                                class="text-sm {changed
                                    ? 'text-amber-900 font-semibold'
                                    : 'text-slate-700'}"
                            >
                                {modifiedVal}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Schedule Comparison -->
            {#if currentPerson && modifiedData}
                {@const entryChanged = isChanged(
                    getCurrentScheduleEntry(),
                    getModifiedEntry(),
                )}
                {@const exitChanged = isChanged(
                    getCurrentScheduleExit(),
                    getModifiedExit(),
                )}
                {#if entryChanged || exitChanged}
                    <div class="space-y-2">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1"
                        >
                            Horario
                        </p>

                        {#if entryChanged}
                            <div
                                class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center"
                            >
                                <div
                                    class="p-3 rounded-lg border border-slate-300 bg-slate-50"
                                >
                                    <p
                                        class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
                                    >
                                        Hora Entrada
                                    </p>
                                    <p class="text-sm text-slate-700">
                                        {getCurrentScheduleEntry()}
                                    </p>
                                </div>
                                <div class="flex items-center justify-center">
                                    <div
                                        class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"
                                    >
                                        <ArrowRight
                                            size={14}
                                            class="text-amber-600"
                                        />
                                    </div>
                                </div>
                                <div
                                    class="p-3 rounded-lg border border-amber-300 bg-amber-50 ring-1 ring-amber-200"
                                >
                                    <p
                                        class="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1"
                                    >
                                        Hora Entrada
                                    </p>
                                    <p
                                        class="text-sm text-amber-900 font-semibold"
                                    >
                                        {getModifiedEntry()}
                                    </p>
                                </div>
                            </div>
                        {/if}

                        {#if exitChanged}
                            <div
                                class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center"
                            >
                                <div
                                    class="p-3 rounded-lg border border-slate-300 bg-slate-50"
                                >
                                    <p
                                        class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
                                    >
                                        Hora Salida
                                    </p>
                                    <p class="text-sm text-slate-700">
                                        {getCurrentScheduleExit()}
                                    </p>
                                </div>
                                <div class="flex items-center justify-center">
                                    <div
                                        class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"
                                    >
                                        <ArrowRight
                                            size={14}
                                            class="text-amber-600"
                                        />
                                    </div>
                                </div>
                                <div
                                    class="p-3 rounded-lg border border-amber-300 bg-amber-50 ring-1 ring-amber-200"
                                >
                                    <p
                                        class="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1"
                                    >
                                        Hora Salida
                                    </p>
                                    <p
                                        class="text-sm text-amber-900 font-semibold"
                                    >
                                        {getModifiedExit()}
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            {/if}

            <!-- Floor Arrays Comparison -->
            {#each [{ label: "Pisos P2000", currentKey: "floors_p2000", modifiedKey: "pisosP2000", fallbackKey: "floors_p2000" }, { label: "Pisos Kone", currentKey: "floors_kone", modifiedKey: "pisosKone", fallbackKey: "floors_kone" }] as floorField}
                {@const currentFloors = getCurrentFloors(floorField.currentKey)}
                {@const modifiedFloors = getModifiedFloors(
                    floorField.modifiedKey,
                    floorField.fallbackKey,
                )}
                {@const changes = getFloorChanges(
                    currentFloors,
                    modifiedFloors,
                )}
                {@const hasChanges =
                    changes.added.length > 0 || changes.removed.length > 0}

                {#if hasChanges}
                    <div class="space-y-2">
                        <p
                            class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1"
                        >
                            {floorField.label}
                        </p>

                        <div
                            class="grid grid-cols-[1fr_auto_1fr] gap-4 items-start"
                        >
                            <!-- Current Floors -->
                            <div
                                class="p-3 rounded-lg border border-slate-300 bg-slate-50"
                            >
                                <div class="flex flex-wrap gap-1.5">
                                    {#each currentFloors as floor}
                                        {#if changes.removed.includes(floor)}
                                            <Badge variant="rose">
                                                <span
                                                    class="flex items-center gap-0.5"
                                                >
                                                    <Minus size={10} />
                                                    <span class="line-through"
                                                        >{floor}</span
                                                    >
                                                </span>
                                            </Badge>
                                        {:else}
                                            <Badge variant="slate"
                                                >{floor}</Badge
                                            >
                                        {/if}
                                    {/each}
                                    {#if currentFloors.length === 0}
                                        <span class="text-xs text-slate-400"
                                            >Sin pisos asignados</span
                                        >
                                    {/if}
                                </div>
                            </div>

                            <!-- Arrow -->
                            <div class="flex items-center justify-center pt-3">
                                <div
                                    class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"
                                >
                                    <ArrowRight
                                        size={14}
                                        class="text-amber-600"
                                    />
                                </div>
                            </div>

                            <!-- Modified Floors -->
                            <div
                                class="p-3 rounded-lg border border-amber-300 bg-amber-50 ring-1 ring-amber-200"
                            >
                                <div class="flex flex-wrap gap-1.5">
                                    {#each modifiedFloors as floor}
                                        {#if changes.added.includes(floor)}
                                            <Badge variant="emerald">
                                                <span
                                                    class="flex items-center gap-0.5"
                                                >
                                                    <Plus size={10} />
                                                    {floor}
                                                </span>
                                            </Badge>
                                        {:else}
                                            <Badge variant="slate"
                                                >{floor}</Badge
                                            >
                                        {/if}
                                    {/each}
                                    {#if modifiedFloors.length === 0}
                                        <span class="text-xs text-slate-400"
                                            >Sin pisos asignados</span
                                        >
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    {:else}
        <div class="p-8 text-center text-slate-500">
            No se encontraron datos para comparar.
        </div>
    {/if}

    {#snippet footer()}
        <Button variant="ghost" onclick={handleReject} disabled={isSubmitting}>
            Rechazar
        </Button>
        <Button
            variant="primary"
            onclick={handleConfirm}
            loading={isSubmitting}
        >
            Confirmar Cambios
        </Button>
    {/snippet}
</Modal>
