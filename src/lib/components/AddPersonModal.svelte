<script lang="ts">
    import Modal from "./Modal.svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import Input from "./Input.svelte";
    import ToggleGroup from "./ToggleGroup.svelte";
    import AddCardModal from "./AddCardModal.svelte";
    import Select from "./Select.svelte";
    import { Plus, CreditCard, Trash2 } from "lucide-svelte";

    import { ticketService } from "../services/data";
    import { toast } from "svelte-sonner";

    type Props = {
        isOpen: boolean;
        initialData?: any;
        buildings: any[];
        dependencies: any[];
        specialAccesses: any[];
        schedules: any[];
        availableCards?: any[];
        onSave?: (data: any) => void;
        onSuccess?: () => void | Promise<void>;
        onclose?: () => void;
    };

    let {
        isOpen = $bindable(),
        initialData = null,
        buildings = [],
        dependencies = [],
        specialAccesses = [],
        schedules = [],
        availableCards = [],
        onSave,
        onSuccess,
        onclose,
    }: Props = $props();

    // Form state
    let nombres = $state("");
    let apellidos = $state("");
    let noEmpleado = $state("");
    let dependency = $state("");
    let areaEquipo = $state("");
    let puestoFuncion = $state("");
    let edificio = $state("");
    let pisoBase = $state("");
    let pisosP2000 = $state<string[]>([]);
    let pisosKone = $state<string[]>([]);
    let diasHorario = $state("");
    let horaEntrada = $state("08:00");
    let horaSalida = $state("17:00");
    let email = $state("");
    let accesosEspeciales = $state<string[]>([]);
    let tarjetasAsignadas = $state<{ type: string; folio: string }[]>([]);

    // Nested modal state
    let isCardModalOpen = $state(false);
    let isSubmitting = $state(false);

    // Derived floors based on selected building
    let availableFloors = $derived.by(() => {
        const b = buildings.find(
            (b) => b.id === edificio || b.name === edificio,
        );
        return b?.floors || [];
    });

    // When building changes, reset floor selections
    $effect(() => {
        if (edificio && !initialData) {
            // Only reset if not loading initial data
            pisoBase = "";
            pisosP2000 = [];
            pisosKone = [];
        }
    });

    // Auto-assign base floor to both access systems
    $effect(() => {
        if (pisoBase && !initialData) {
            if (!pisosP2000.includes(pisoBase)) {
                pisosP2000 = [...pisosP2000, pisoBase];
            }
            if (!pisosKone.includes(pisoBase)) {
                pisosKone = [...pisosKone, pisoBase];
            }
        }
    });

    const dayRanges = [
        "Lunes a Viernes",
        "Lunes a Sábado",
        "Lunes a Domingo",
        "Sábado y Domingo",
        "Personalizado",
    ];

    $effect(() => {
        if (isOpen && initialData) {
            nombres = initialData.first_name || "";
            apellidos = initialData.last_name || "";
            noEmpleado = initialData.employeeNo;
            dependency = initialData.dependency;
            areaEquipo = initialData.area || "";
            puestoFuncion = initialData.position || "";
            edificio = initialData.building;
            pisoBase = initialData.floor;
            pisosP2000 = initialData.floors_p2000 || [];
            pisosKone = initialData.floors_kone || [];
            if (initialData.schedule) {
                diasHorario = initialData.schedule.days;
                horaEntrada = initialData.schedule.entry;
                horaSalida = initialData.schedule.exit;
            }
            email = initialData.email || "";
            accesosEspeciales = (initialData.specialAccesses || []).map(
                (s: string) => s.trim(),
            );
            tarjetasAsignadas = initialData.cards || [];
        } else if (isOpen && !initialData) {
            resetForm();
        }
    });

    function addCard(card: { type: string; folio: string }) {
        tarjetasAsignadas = [...tarjetasAsignadas, card];
    }

    function removeCard(index: number) {
        tarjetasAsignadas = tarjetasAsignadas.filter((_, i) => i !== index);
    }

    async function handleSave() {
        if (isSubmitting) return;
        isSubmitting = true;

        try {
            const data = {
                id: initialData?.id,
                nombres,
                apellidos,
                noEmpleado,
                areaEquipo,
                puestoFuncion,
                dependency, // Include the name for better display/comparison
                dependencyId: dependencies.find((d) => d.name === dependency)
                    ?.id,
                edificio,
                buildingId: buildings.find((b) => b.name === edificio)?.id,
                pisoBase,
                pisosP2000,
                pisosKone,
                scheduleId: schedules.find((s) => s.name === diasHorario)?.id,
                horario: {
                    dias: diasHorario,
                    entrada: horaEntrada,
                    salida: horaSalida,
                },
                email,
                accesosEspeciales,
                tarjetas: tarjetasAsignadas,
                status: initialData?.status || "Activo/a", // Use display string to match normalizedOriginal
            };

            // INTERCEPTION LOGIC
            if (initialData) {
                // Normalize original data to match the "modified" structure
                const normalizedOriginal = {
                    id: initialData.id,
                    nombres: initialData.first_name || "",
                    apellidos: initialData.last_name || "",
                    noEmpleado: initialData.employeeNo,
                    areaEquipo: initialData.area || "",
                    puestoFuncion: initialData.position || "",
                    dependency: initialData.dependency,
                    edificio: initialData.building,
                    pisoBase: initialData.floor,
                    pisosP2000: initialData.floors_p2000 || [],
                    pisosKone: initialData.floors_kone || [],
                    horario: initialData.schedule
                        ? {
                              dias: initialData.schedule.days,
                              entrada: initialData.schedule.entry,
                              salida: initialData.schedule.exit,
                          }
                        : null,
                    accesosEspeciales: initialData.specialAccesses || [],
                    tarjetas: initialData.cards || [],
                    status: initialData.status,
                    email: initialData.email || "",
                };

                // It's an EDIT -> Create Ticket
                const ticketPayload = {
                    original: normalizedOriginal,
                    modified: data,
                };

                await ticketService.create({
                    title: "Modificación de Datos Personales",
                    description: `Solicitud de cambio de datos para ${nombres} ${apellidos} (${noEmpleado})`,
                    type: "Modificación de Datos",
                    priority: "Media",
                    person_id: initialData.id,
                    payload: ticketPayload,
                });

                toast.success("Solicitud Enviada", {
                    description:
                        "Los cambios se han enviado a aprobación y no se aplicarán inmediatamente.",
                });
                await onSuccess?.();
            } else {
                // It's a NEW RECORD -> Save immediately
                await onSave?.(data);
                await onSuccess?.();
            }

            resetAndClose();
        } catch (e) {
            console.error(e);
            toast.error("Error", {
                description: "Ocurrió un error al procesar la solicitud.",
            });
        } finally {
            isSubmitting = false;
        }
    }

    function resetForm() {
        nombres = "";
        apellidos = "";
        noEmpleado = "";
        dependency = "";
        areaEquipo = "";
        puestoFuncion = "";
        edificio = "";
        pisoBase = "";
        pisosP2000 = [];
        pisosKone = [];
        diasHorario = "";
        horaEntrada = "08:00";
        horaSalida = "17:00";
        email = "";
        accesosEspeciales = [];
        tarjetasAsignadas = [];
    }

    function resetAndClose() {
        resetForm();
        isOpen = false;
        onclose?.();
    }
</script>

<Modal
    bind:isOpen
    title="Nueva Alta de Personal"
    description="Complete la información para registrar una nueva persona."
    size="xl"
    onclose={resetAndClose}
>
    <form
        class="space-y-8"
        onsubmit={(e) => {
            e.preventDefault();
            handleSave();
        }}
    >
        <!-- SECTION: Personal Info -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Datos Personales
            </legend>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="nombres"
                        class="text-xs font-bold text-slate-600 block"
                        >Nombres</label
                    >
                    <input
                        id="nombres"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        placeholder="Juan Carlos"
                        bind:value={nombres}
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="apellidos"
                        class="text-xs font-bold text-slate-600 block"
                        >Apellidos</label
                    >
                    <input
                        id="apellidos"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        placeholder="Pérez García"
                        bind:value={apellidos}
                    />
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <div class="space-y-1.5">
                    <label
                        for="noEmpleado"
                        class="text-xs font-bold text-slate-600 block"
                        >No. Empleado</label
                    >
                    <input
                        id="noEmpleado"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        placeholder="EMP-001"
                        bind:value={noEmpleado}
                    />
                </div>

                <div class="md:col-span-2 space-y-1.5">
                    <label
                        for="dependencia"
                        class="text-xs font-bold text-slate-600 block"
                        >Dependencia</label
                    >
                    <Select id="dependencia" bind:value={dependency}>
                        {#each dependencies as dep}
                            <option value={dep.name}>{dep.name}</option>
                        {/each}
                    </Select>
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="areaEquipo"
                        class="text-xs font-bold text-slate-600 block"
                        >Área / Equipo</label
                    >
                    <input
                        id="areaEquipo"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        placeholder="Sistemas"
                        bind:value={areaEquipo}
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="puestoFuncion"
                        class="text-xs font-bold text-slate-600 block"
                        >Puesto / Función</label
                    >
                    <input
                        id="puestoFuncion"
                        type="text"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                        placeholder="Analista de Sistemas"
                        bind:value={puestoFuncion}
                    />
                </div>
            </div>

            <div class="space-y-1.5 pt-2">
                <label
                    for="email"
                    class="text-xs font-bold text-slate-600 block"
                    >Correo Electrónico</label
                >
                <input
                    id="email"
                    type="email"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                    placeholder="ejemplo@correo.com"
                    bind:value={email}
                />
            </div>
        </fieldset>

        <!-- SECTION: Building & Floors -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Ubicación
            </legend>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="edificio"
                        class="text-xs font-bold text-slate-600 block"
                        >Edificio</label
                    >
                    <Select id="edificio" bind:value={edificio}>
                        {#each buildings as b}
                            <option value={b.name}>{b.name}</option>
                        {/each}
                    </Select>
                </div>
                <div class="space-y-1.5">
                    <label
                        for="pisoBase"
                        class="text-xs font-bold text-slate-600 block"
                        >Piso Base</label
                    >
                    <Select
                        id="pisoBase"
                        bind:value={pisoBase}
                        disabled={!edificio}
                    >
                        {#each availableFloors as floor}
                            <option value={floor}>{floor}</option>
                        {/each}
                    </Select>
                </div>
            </div>

            {#if edificio}
                <div class="space-y-4">
                    <ToggleGroup
                        label="Pisos Asignados P2000 (Puertas)"
                        options={availableFloors}
                        bind:value={pisosP2000}
                    />
                    <ToggleGroup
                        label="Pisos Asignados KONE (Elevadores)"
                        options={availableFloors}
                        bind:value={pisosKone}
                    />
                </div>
            {/if}
        </fieldset>

        <!-- SECTION: Schedule -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Horario
            </legend>

            <div class="space-y-1.5">
                <label
                    for="diasHorario"
                    class="text-xs font-bold text-slate-600 block">Días</label
                >
                <Select id="diasHorario" bind:value={diasHorario}>
                    {#each schedules as s}
                        <option value={s.name}>{s.name}</option>
                    {/each}
                </Select>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="horaEntrada"
                        class="text-xs font-bold text-slate-600 block"
                        >Hora de Entrada</label
                    >
                    <input
                        id="horaEntrada"
                        type="time"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        bind:value={horaEntrada}
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="horaSalida"
                        class="text-xs font-bold text-slate-600 block"
                        >Hora de Salida</label
                    >
                    <input
                        id="horaSalida"
                        type="time"
                        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                        bind:value={horaSalida}
                    />
                </div>
            </div>
        </fieldset>

        <!-- SECTION: Special Access -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Accesos Especiales
            </legend>

            <ToggleGroup
                label=""
                options={specialAccesses.map((a) => a.name)}
                bind:value={accesosEspeciales}
            />
        </fieldset>

        <!-- SECTION: Cards (Only for new persons) -->
        {#if !initialData}
            <fieldset
                class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            >
                <legend
                    class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >
                    Gestión de Tarjetas
                </legend>

                {#if tarjetasAsignadas.length > 0}
                    <div class="space-y-2">
                        {#each tarjetasAsignadas as card, index}
                            <div
                                class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                            >
                                <div class="flex items-center gap-3">
                                    <CreditCard
                                        size={18}
                                        class="text-slate-400"
                                    />
                                    <Badge
                                        variant={card.type === "KONE"
                                            ? "blue"
                                            : "amber"}
                                    >
                                        {card.type}
                                    </Badge>
                                    <span
                                        class="text-sm font-bold text-slate-700"
                                        >{card.folio}</span
                                    >
                                </div>
                                <button
                                    type="button"
                                    class="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    onclick={() => removeCard(index)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}

                <Button
                    type="button"
                    variant="outline"
                    class="w-full"
                    onclick={() => (isCardModalOpen = true)}
                >
                    <Plus size={16} />
                    Asignar Tarjeta Inicial
                </Button>
            </fieldset>
        {/if}
    </form>

    {#snippet footer()}
        <Button variant="ghost" onclick={resetAndClose}>Cancelar</Button>
        <Button variant="primary" onclick={handleSave} loading={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Alta"}
        </Button>
    {/snippet}
</Modal>

<!-- Nested Card Modal -->
<AddCardModal bind:isOpen={isCardModalOpen} {availableCards} onSave={addCard} />
