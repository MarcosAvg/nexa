<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import Input from "../Input.svelte";
    import ToggleGroup from "../ToggleGroup.svelte";
    import AddCardModal from "./AddCardModal.svelte";
    import Select from "../Select.svelte";
    import { Plus, CreditCard, Trash2, AlertTriangle } from "lucide-svelte";
    import { untrack } from "svelte";

    import { personnelService, ticketService } from "../../services";
    import { personnelState, catalogState, userState } from "../../stores";
    import PermissionGuard from "../PermissionGuard.svelte";
    import { toast } from "svelte-sonner";
    import type { Person } from "../../types";
    import { personnelSchema } from "../../schemas";

    import { type Snippet } from "svelte";

    let {
        isOpen = $bindable(false),
        editingPerson = null,
        prefill = null,
        allowedCardTypes = null,
        headerContent,
        leftFooterContent,
        oncomplete,
        onclose,
        forceDirectSave = false,
    }: {
        isOpen: boolean;
        editingPerson?: Person | null;
        /** Pre-fill form fields for a NEW person (no id) from an imported ticket */
        prefill?: {
            nombres?: string;
            apellidos?: string;
            noEmpleado?: string;
            dependencia?: string;
            edificio?: string;
            pisoBase?: string;
            area?: string;
            puesto?: string;
            horario?: string;
            horaEntrada?: string;
            horaSalida?: string;
            correo?: string;
            pisosP2000?: string[];
            pisosKone?: string[];
            specialAccesses?: string[];
        } | null;
        /** If set, only these card types can be added ('P2000', 'KONE') */
        allowedCardTypes?: string[] | null;
        headerContent?: Snippet;
        leftFooterContent?: Snippet;
        oncomplete?: () => void;
        onclose?: () => void;
        /** If true, editing an existing person will save DIRECTLY instead of creating a ticket */
        forceDirectSave?: boolean;
    } = $props();

    // Catalogs
    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let schedules = $derived(catalogState.schedules);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let availableCards = $derived(personnelState.extraCards);

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
    let errors = $state<Record<string, string>>({});

    // Duplicate detection
    let potentialDuplicates = $state<any[]>([]);
    let isCheckingDuplicates = $state(false);
    let lastCheckedName = $state("");

    // Derived floors based on selected building
    let availableFloors = $derived.by(() => {
        const b = buildings.find((b) => b.name === edificio);
        return b?.floors || [];
    });

    // When building changes, reset floor selections
    $effect(() => {
        if (edificio && !editingPerson && !prefill) {
            // Only reset if not loading initial data (editing or prefilling)
            pisoBase = "";
            pisosP2000 = [];
            pisosKone = [];
        }
    });

    // Auto-uppercase names + Duplicate check
    $effect(() => {
        if (nombres) nombres = nombres.toUpperCase();
        if (apellidos) apellidos = apellidos.toUpperCase();

        // Only check if we are creating a NEW person or prefilling
        if (!editingPerson || prefill) {
            const fullName = `${nombres.trim()} ${apellidos.trim()}`.trim();
            if (
                nombres.trim().length >= 3 &&
                apellidos.trim().length >= 2 &&
                fullName !== lastCheckedName
            ) {
                lastCheckedName = fullName;
                checkDuplicates(nombres.trim(), apellidos.trim());
            } else if (
                nombres.trim().length < 3 ||
                apellidos.trim().length < 2
            ) {
                potentialDuplicates = [];
                lastCheckedName = "";
            }
        }
    });

    async function checkDuplicates(nom: string, ape: string) {
        isCheckingDuplicates = true;
        try {
            // We use the fuzzy search but with a high threshold or just name matching
            const results = await personnelService.searchByName(ape, nom);
            // Filter to find very close matches (insensitive to accents)
            potentialDuplicates = results.filter((p) => {
                const n1 = (p.first_name + " " + p.last_name)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                const n2 = (nom + " " + ape)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                return n1.includes(n2) || n2.includes(n1);
            });
        } catch (e) {
            console.error(e);
        } finally {
            isCheckingDuplicates = false;
        }
    }

    // Populate form
    let lastLoadedPersonId = $state("");

    $effect(() => {
        if (
            isOpen &&
            editingPerson &&
            lastLoadedPersonId !== editingPerson.id
        ) {
            untrack(() => {
                nombres = editingPerson.first_name || "";
                apellidos = editingPerson.last_name || "";
                noEmpleado = editingPerson.employee_no;
                dependency = editingPerson.dependency;
                areaEquipo = (editingPerson as any).area || "";
                puestoFuncion = (editingPerson as any).position || "";
                edificio = editingPerson.building;
                pisoBase = editingPerson.floor || "";
                pisosP2000 = [...(editingPerson.floors_p2000 || [])];
                pisosKone = [...(editingPerson.floors_kone || [])];

                if (editingPerson.schedule) {
                    diasHorario = editingPerson.schedule.days;
                    horaEntrada = editingPerson.schedule.entry;
                    horaSalida = editingPerson.schedule.exit;
                }

                email = editingPerson.email || "";
                accesosEspeciales = [...(editingPerson.specialAccesses || [])];
                tarjetasAsignadas = [...(editingPerson.cards || [])];

                // If we also have a prefill (linking an Alta ticket), overwrite the requested data selectivly
                if (prefill) {
                    const wantsP2000 =
                        !allowedCardTypes || allowedCardTypes.includes("P2000");
                    const wantsKONE =
                        !allowedCardTypes || allowedCardTypes.includes("KONE");

                    if (wantsP2000) {
                        if (
                            prefill.pisosP2000 &&
                            prefill.pisosP2000.length > 0
                        ) {
                            pisosP2000 = [...prefill.pisosP2000];
                        } else if (prefill.pisosP2000) {
                            pisosP2000 = [];
                        }
                    }

                    if (wantsKONE) {
                        if (prefill.pisosKone && prefill.pisosKone.length > 0) {
                            pisosKone = [...prefill.pisosKone];
                        } else if (prefill.pisosKone) {
                            pisosKone = [];
                        }
                    }

                    if (
                        prefill.specialAccesses &&
                        prefill.specialAccesses.length > 0
                    ) {
                        accesosEspeciales = [...prefill.specialAccesses];
                    } else if (prefill.specialAccesses) {
                        accesosEspeciales = [];
                    }

                    // Also overwrite building, base floor and schedule as they are part of the "access" profile
                    if (prefill.edificio) edificio = prefill.edificio;
                    if (prefill.pisoBase) pisoBase = prefill.pisoBase;
                    if (prefill.horario) diasHorario = prefill.horario;
                    if (prefill.horaEntrada) horaEntrada = prefill.horaEntrada;
                    if (prefill.horaSalida) horaSalida = prefill.horaSalida;
                }

                lastLoadedPersonId = editingPerson.id;
            });
        } else if (
            isOpen &&
            !editingPerson &&
            prefill &&
            lastLoadedPersonId !== "__prefill__"
        ) {
            // Pre-fill for a NEW person from an imported ticket
            untrack(() => {
                const cat = catalogState;
                nombres = prefill.nombres ?? "";
                apellidos = prefill.apellidos ?? "";
                noEmpleado = prefill.noEmpleado ?? "";
                dependency = prefill.dependencia ?? "";
                edificio = prefill.edificio ?? "";
                pisoBase = prefill.pisoBase ?? "";
                areaEquipo = prefill.area ?? "";
                puestoFuncion = prefill.puesto ?? "";

                const schedObj = cat.schedules.find(
                    (s) => s.name === prefill.horario,
                );
                diasHorario = schedObj ? prefill.horario! : "";
                horaEntrada = prefill.horaEntrada ?? "08:00";
                horaSalida = prefill.horaSalida ?? "17:00";
                email = prefill.correo ?? "";
                pisosP2000 = prefill.pisosP2000 ?? [];
                pisosKone = prefill.pisosKone ?? [];
                accesosEspeciales = prefill.specialAccesses ?? [];
                lastLoadedPersonId = "__prefill__";
            });
        } else if (
            isOpen &&
            !editingPerson &&
            !prefill &&
            lastLoadedPersonId !== "new"
        ) {
            resetForm();
            lastLoadedPersonId = "new";
        } else if (!isOpen) {
            lastLoadedPersonId = "";
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
        errors = {};

        const dataToValidate = {
            first_name: nombres,
            last_name: apellidos,
            dependency,
            building: edificio,
            floor: pisoBase,
            schedule_days: diasHorario,
            entry_time: horaEntrada,
            exit_time: horaSalida,
            email,
            employee_no: noEmpleado,
            area: areaEquipo,
            position: puestoFuncion,
        };

        // Solo validar esquema si es una nueva alta
        if (!editingPerson) {
            const result = personnelSchema.safeParse(dataToValidate);

            if (!result.success) {
                const newErrors: Record<string, string> = {};
                result.error.issues.forEach((issue) => {
                    if (issue.path[0])
                        newErrors[issue.path[0].toString()] = issue.message;
                });
                errors = newErrors;
                toast.error("Error de Validación", {
                    description:
                        "Por favor corrija los campos marcados en rojo.",
                });
                return;
            }
        }

        isSubmitting = true;

        try {
            const data = {
                id: editingPerson?.id,
                nombres,
                apellidos,
                noEmpleado,
                areaEquipo,
                puestoFuncion,
                dependency,
                dependency_id: dependencies.find((d) => d.name === dependency)
                    ?.id,
                edificio,
                building_id: buildings.find((b) => b.name === edificio)?.id,
                pisoBase,
                pisosP2000,
                pisosKone,
                first_name: nombres,
                last_name: apellidos,
                employee_no: noEmpleado,
                email: email?.replace(/^mailto:\s*/i, "").trim(),
                floor: pisoBase,
                floors_p2000: pisosP2000,
                floors_kone: pisosKone,
                schedule_id: schedules.find((s) => s.name === diasHorario)?.id,
                entry_time: horaEntrada,
                exit_time: horaSalida,
                cards: tarjetasAsignadas,
                specialAccesses: accesosEspeciales,
            };

            if (editingPerson && !forceDirectSave) {
                const normalizedOriginal = {
                    id: editingPerson.id,
                    nombres: editingPerson.first_name,
                    apellidos: editingPerson.last_name,
                    noEmpleado: editingPerson.employee_no,
                    dependency: editingPerson.dependency,
                    edificio: editingPerson.building,
                    pisosP2000: editingPerson.floors_p2000,
                    pisosKone: editingPerson.floors_kone,
                    horario: editingPerson.schedule,
                    accesosEspeciales: editingPerson.specialAccesses,
                    tarjetas: editingPerson.cards,
                    email: editingPerson.email,
                    floor: editingPerson.floor,
                };

                const ticketPayload = {
                    original: normalizedOriginal,
                    modified: data,
                };
                await ticketService.create({
                    title: "Modificación de Datos Personales",
                    description: `Solicitud de cambio de datos para ${nombres} ${apellidos} (${noEmpleado})`,
                    type: "Modificación de datos",
                    priority: "media",
                    person_id: editingPerson.id,
                    payload: ticketPayload,
                });

                toast.success("Solicitud Enviada", {
                    description: "Los cambios se han enviado a aprobación.",
                });
            } else {
                await personnelService.save(data);
                const updated = await personnelService.fetchAll();
                personnelState.setPersonnel(updated.data, updated.count);
                toast.success("Personal Registrado");
            }

            oncomplete?.();
            resetAndClose();
        } catch (e) {
            console.error(e);
            toast.error("Error", {
                description: "Ocurrió un error al guardar.",
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
        if (onclose) {
            onclose();
        } else {
            isOpen = false;
        }
    }

    // ── Comparison Logic ──────────────────────────────────
    const comparisonFields = [
        {
            key: "nombres",
            state: () => nombres,
            setter: (v: string) => (nombres = v),
            label: "Nombres",
        },
        {
            key: "apellidos",
            state: () => apellidos,
            setter: (v: string) => (apellidos = v),
            label: "Apellidos",
        },
        {
            key: "noEmpleado",
            state: () => noEmpleado,
            setter: (v: string) => (noEmpleado = v),
            label: "No. Empleado",
        },
        {
            key: "dependencia",
            state: () => dependency,
            setter: (v: string) => (dependency = v),
            label: "Dependencia",
        },
        {
            key: "area",
            state: () => areaEquipo,
            setter: (v: string) => (areaEquipo = v),
            label: "Área/Equipo",
        },
        {
            key: "puesto",
            state: () => puestoFuncion,
            setter: (v: string) => (puestoFuncion = v),
            label: "Puesto",
        },
        {
            key: "correo",
            state: () => email,
            setter: (v: string) => (email = v),
            label: "Correo",
        },
    ];

    function getTicketValue(key: string) {
        if (!prefill) return null;
        return (prefill as any)[key] || "";
    }

    function isDifferent(field: any) {
        if (!prefill || !editingPerson) return false;
        const ticketVal = getTicketValue(field.key);
        if (!ticketVal) return false;
        return (
            String(field.state()).trim().toLowerCase() !==
            String(ticketVal).trim().toLowerCase()
        );
    }
</script>

{#snippet DiffIndicator(field: any)}
    {#if isDifferent(field)}
        <div
            class="flex items-center justify-between gap-2 p-1.5 px-2 bg-amber-50 border border-amber-200 rounded text-[10px] mt-1 pulse-amber"
        >
            <span class="text-amber-700 font-medium"
                >Solicitado: <strong class="text-amber-900"
                    >{getTicketValue(field.key)}</strong
                ></span
            >
            <button
                type="button"
                class="text-amber-600 font-bold hover:text-amber-800 underline transition-colors"
                onclick={() => field.setter(getTicketValue(field.key))}
                >Aplicar</button
            >
        </div>
    {/if}
{/snippet}

<Modal
    bind:isOpen
    title={editingPerson
        ? prefill
            ? "Vincular Alta a Persona"
            : "Editar Personal"
        : "Nueva Alta de Personal"}
    description={editingPerson
        ? prefill
            ? "Se actualizarán los accesos de la persona existente directamente."
            : "Modifique los datos requeridos. Se generará un ticket."
        : "Complete la información para registrar una nueva persona."}
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
        {#if headerContent}
            {@render headerContent()}
        {/if}

        <!-- SECTION: Personal Info -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            disabled={!userState.canEdit}
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Datos Personales</legend
            >

            {#if potentialDuplicates.length > 0}
                <div
                    class="mx-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
                >
                    <div
                        class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0"
                    >
                        <AlertTriangle size={18} />
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-amber-800">
                            Posibles registros duplicados encontrados:
                        </p>
                        <div class="mt-1 space-y-1">
                            {#each potentialDuplicates as p}
                                <div
                                    class="text-[10px] text-amber-700 flex items-center gap-1"
                                >
                                    <span class="font-bold"
                                        >• {p.last_name}, {p.first_name}</span
                                    >
                                    <span class="opacity-70"
                                        >en {p.dependency || "N/A"} ({p.building ||
                                            "N/A"})</span
                                    >
                                </div>
                            {/each}
                        </div>
                        <p class="text-[9px] text-amber-600 mt-2 italic">
                            Si es la misma persona, considera actualizar su
                            registro actual en lugar de crear uno nuevo.
                        </p>
                    </div>
                </div>
            {/if}

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="nombres"
                        class="text-xs font-bold text-slate-600 block"
                        >Nombres</label
                    >
                    <Input
                        id="nombres"
                        bind:value={nombres}
                        placeholder="Juan Carlos"
                        class={(isDifferent(comparisonFields[0])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30 "
                            : "") +
                            (errors.first_name
                                ? "border-red-500 ring-red-200"
                                : "")}
                    />
                    {#if errors.first_name}
                        <p class="text-[10px] text-red-500 font-medium">
                            {errors.first_name}
                        </p>
                    {/if}
                    {@render DiffIndicator(comparisonFields[0])}
                </div>
                <div class="space-y-1.5">
                    <label
                        for="apellidos"
                        class="text-xs font-bold text-slate-600 block"
                        >Apellidos</label
                    >
                    <Input
                        id="apellidos"
                        bind:value={apellidos}
                        placeholder="Pérez García"
                        class={(isDifferent(comparisonFields[1])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30 "
                            : "") +
                            (errors.last_name
                                ? "border-red-500 ring-red-200"
                                : "")}
                    />
                    {#if errors.last_name}
                        <p class="text-[10px] text-red-500 font-medium">
                            {errors.last_name}
                        </p>
                    {/if}
                    {@render DiffIndicator(comparisonFields[1])}
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <div class="space-y-1.5">
                    <label
                        for="noEmpleado"
                        class="text-xs font-bold text-slate-600 block"
                        >No. Empleado</label
                    >
                    <Input
                        id="noEmpleado"
                        bind:value={noEmpleado}
                        placeholder="EMP-001"
                        class={isDifferent(comparisonFields[2])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[2])}
                </div>
                <div class="md:col-span-2 space-y-1.5">
                    <label
                        for="dependencia"
                        class="text-xs font-bold text-slate-600 block"
                        >Dependencia</label
                    >
                    <Select
                        id="dependencia"
                        bind:value={dependency}
                        class={(isDifferent(comparisonFields[3])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30 "
                            : "") +
                            (errors.dependency
                                ? "border-red-500 ring-red-200"
                                : "")}
                    >
                        <option value="">Seleccionar...</option>
                        {#each dependencies as dep}
                            <option value={dep.name}>{dep.name}</option>
                        {/each}
                    </Select>
                    {#if errors.dependency}
                        <p class="text-[10px] text-red-500 font-medium">
                            {errors.dependency}
                        </p>
                    {/if}
                    {@render DiffIndicator(comparisonFields[3])}
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="area"
                        class="text-xs font-bold text-slate-600 block"
                        >Área / Equipo</label
                    >
                    <Input
                        id="area"
                        bind:value={areaEquipo}
                        placeholder="Sistemas"
                        class={isDifferent(comparisonFields[4])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[4])}
                </div>
                <div class="space-y-1.5">
                    <label
                        for="puesto"
                        class="text-xs font-bold text-slate-600 block"
                        >Puesto / Función</label
                    >
                    <Input
                        id="puesto"
                        bind:value={puestoFuncion}
                        placeholder="Analista"
                        class={isDifferent(comparisonFields[5])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[5])}
                </div>
            </div>

            <div class="space-y-1.5 pt-2">
                <label
                    for="email"
                    class="text-xs font-bold text-slate-600 block"
                    >Correo Electrónico</label
                >
                <Input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="correo@ejemplo.com"
                    class={(isDifferent(comparisonFields[6])
                        ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30 "
                        : "") +
                        (errors.email ? "border-red-500 ring-red-200" : "")}
                />
                {#if errors.email}
                    <p class="text-[10px] text-red-500 font-medium">
                        {errors.email}
                    </p>
                {/if}
                {@render DiffIndicator(comparisonFields[6])}
            </div>
        </fieldset>

        <!-- SECTION: Location -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            disabled={!userState.canEdit}
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Ubicación</legend
            >

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="edificio"
                        class="text-xs font-bold text-slate-600 block"
                        >Edificio</label
                    >
                    <Select
                        id="edificio"
                        bind:value={edificio}
                        class={errors.building
                            ? "border-red-500 ring-red-200"
                            : ""}
                    >
                        <option value="">Seleccionar...</option>
                        {#each buildings as b}
                            <option value={b.name}>{b.name}</option>
                        {/each}
                    </Select>
                    {#if errors.building}
                        <p class="text-[10px] text-red-500 font-medium">
                            {errors.building}
                        </p>
                    {/if}
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
                        class={errors.floor
                            ? "border-red-500 ring-red-200"
                            : ""}
                    >
                        <option value="">Seleccionar...</option>
                        {#each availableFloors as f}
                            <option value={f}>{f}</option>
                        {/each}
                    </Select>
                    {#if errors.floor}
                        <p class="text-[10px] text-red-500 font-medium">
                            {errors.floor}
                        </p>
                    {/if}
                </div>
            </div>

            {#if edificio}
                <div class="space-y-4">
                    <ToggleGroup
                        label="Pisos Asignados P2000 (Puertas)"
                        options={availableFloors}
                        bind:value={pisosP2000}
                        showSelectAll={true}
                    />
                    <ToggleGroup
                        label="Pisos Asignados KONE (Elevadores)"
                        options={availableFloors}
                        bind:value={pisosKone}
                        showSelectAll={true}
                    />
                </div>
            {/if}
        </fieldset>

        <!-- SECTION: Schedule -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            disabled={!userState.canEdit}
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Horario</legend
            >
            <div class="space-y-1.5">
                <label for="dias" class="text-xs font-bold text-slate-600 block"
                    >Días</label
                >
                <Select
                    id="dias"
                    bind:value={diasHorario}
                    class={errors.schedule_days
                        ? "border-red-500 ring-red-200"
                        : ""}
                >
                    <option value="">Seleccionar...</option>
                    {#each schedules as s}
                        <option value={s.name}>{s.name}</option>
                    {/each}
                </Select>
                {#if errors.schedule_days}
                    <p class="text-[10px] text-red-500 font-medium">
                        {errors.schedule_days}
                    </p>
                {/if}
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                    <label
                        for="entrada"
                        class="text-xs font-bold text-slate-600 block"
                        >Entrada</label
                    >
                    <Input id="entrada" type="time" bind:value={horaEntrada} />
                </div>
                <div class="space-y-1.5">
                    <label
                        for="salida"
                        class="text-xs font-bold text-slate-600 block"
                        >Salida</label
                    >
                    <Input id="salida" type="time" bind:value={horaSalida} />
                </div>
            </div>
        </fieldset>

        <!-- SECTION: Special Access -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            disabled={!userState.canEdit}
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                >Accesos Especiales</legend
            >
            <ToggleGroup
                label=""
                options={specialAccesses.map((a) => a.name)}
                bind:value={accesosEspeciales}
            />
        </fieldset>

        <!-- SECTION: Cards -->
        {#if !editingPerson || prefill}
            <fieldset
                class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            >
                <legend
                    class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
                    >Gestión de Tarjetas</legend
                >

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
                                            : "amber"}>{card.type}</Badge
                                    >
                                    <span
                                        class="text-sm font-bold text-slate-700"
                                        >{card.folio}</span
                                    >
                                </div>
                                <button
                                    type="button"
                                    class="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                    onclick={() => removeCard(index)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}

                <PermissionGuard requireEdit disabledOnly>
                    {#snippet children({ disabled })}
                        <Button
                            type="button"
                            variant="outline"
                            class="w-full"
                            onclick={() => (isCardModalOpen = true)}
                            {disabled}
                        >
                            <Plus size={16} />
                            Asignar Tarjeta Inicial
                        </Button>
                    {/snippet}
                </PermissionGuard>
            </fieldset>
        {/if}
    </form>

    {#snippet footer()}
        <div class="flex items-center justify-between w-full">
            <div>
                {#if leftFooterContent}
                    {@render leftFooterContent()}
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Button variant="ghost" onclick={resetAndClose}>Cancelar</Button
                >
                <PermissionGuard requireEdit>
                    <Button
                        variant="primary"
                        onclick={handleSave}
                        loading={isSubmitting}
                        >{editingPerson
                            ? forceDirectSave
                                ? "Aplicar Alta a Persona"
                                : "Actualizar (Ticket)"
                            : "Guardar Alta"}</Button
                    >
                </PermissionGuard>
            </div>
        </div>
    {/snippet}
</Modal>

<AddCardModal
    bind:isOpen={isCardModalOpen}
    onSave={addCard}
    {allowedCardTypes}
/>

<style>
    @keyframes pulse-amber {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.7;
        }
    }
    .pulse-amber {
        animation: pulse-amber 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>
