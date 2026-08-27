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
    import FormSection from "../FormSection.svelte";
    import FormField from "../FormField.svelte";
    import DependencySelect from "../DependencySelect.svelte";
    import BuildingSelect from "../BuildingSelect.svelte";
    import ScheduleSelect from "../ScheduleSelect.svelte";

    import { personnelService, ticketService, accessAssignmentService } from "../../services";
    import { floorGroupsToIdMap, floorsForKey } from "../../services/accessAssignments";
    import { personnelState, catalogState, userState } from "../../stores";
    import PermissionGuard from "../PermissionGuard.svelte";
    import { toast } from "svelte-sonner";
    import { handleError, mediaTypeVariant, normalizeEmailText } from "../../utils";
    import { updateWithLock, fetchCurrentVersion } from "../../utils/optimisticLock";
    import { resolveFloorList } from "../../utils/floorMatch";
    import type { Person } from "../../types";
    import { personnelSchema } from "../../schemas";

    import { type Snippet } from "svelte";

    /** Mensaje cuando otro usuario modificó la persona mientras se editaba. */
    const CONFLICT_MSG =
        "Este registro fue modificado por otra persona. Recarga e inténtalo de nuevo.";

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
        disableDuplicateCheck = false,
    }: {
        /** Controla la visibilidad del modal (two-way bindable). */
        isOpen: boolean;
        /** Persona a editar (null = modo creación). */
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
            pisosPorMedio?: Record<string, string[]>;
            foliosPorMedio?: Record<string, string>;
            specialAccesses?: string[];
        } | null;
        /** If set, only these card types can be added ('P2000', 'KONE') */
        allowedCardTypes?: string[] | null;
        /** Contenido adicional en el encabezado del modal. */
        headerContent?: Snippet;
        /** Contenido adicional en el lado izquierdo del footer. */
        leftFooterContent?: Snippet;
        /** Callback al completar el guardado. */
        oncomplete?: () => void;
        /** Callback al cerrar el modal (sin guardar). */
        onclose?: () => void;
        /** If true, editing an existing person will save DIRECTLY instead of creating a ticket */
        forceDirectSave?: boolean;
        /** Si true, se salta la detección automática de duplicados (útil cuando el modal padre ya la maneja) */
        disableDuplicateCheck?: boolean;
    } = $props();

    // Catálogos
    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let schedules = $derived(catalogState.schedules);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let availableCards = $derived(personnelState.extraCards);

    // Versión (optimistic locking) de la persona al abrir el modal de edición.
    let editingUpdatedAt = $state<string | null>(null);

    // Aviso temprano de concurrencia: el registro cambió en BD desde que se cargó.
    let isStale = $state(false);

    /** Compara la versión de la lista con la actual en BD y marca si quedó obsoleta. */
    async function checkStale(id: string, loadedVersion: string | null) {
        const fresh = await fetchCurrentVersion("personnel", id);
        isStale = !!fresh && !!loadedVersion && fresh !== loadedVersion;
    }

    // Estado del formulario
    let nombres = $state("");
    let apellidos = $state("");
    let noEmpleado = $state("");
    let dependency = $state("");
    let areaEquipo = $state("");
    let puestoFuncion = $state("");
    let edificio = $state("");
    let pisoBase = $state("");
    let floorsByBuilding = $state<Record<number, Record<string, string[]>>>({});
    let diasHorario = $state("");
    let horaEntrada = $state("08:00");
    let horaSalida = $state("17:00");
    let email = $state("");
    let accesosEspeciales = $state<number[]>([]);
    let tarjetasAsignadas = $state<{ type: string; folio: string; id?: string; status?: string }[]>([]);

    // Estado del modal anidado
    let isCardModalOpen = $state(false);
    let isSubmitting = $state(false);
    let errors = $state<Record<string, string>>({});

    // Detección de duplicados
    let potentialDuplicates = $state<any[]>([]);
    let isCheckingDuplicates = $state(false);
    let lastCheckedName = $state("");

    // Pisos derivados según el edificio seleccionado
    let availableFloors = $derived.by(() => {
        const b = buildings.find((b) => b.name === edificio);
        return b?.floors || [];
    });

    let baseBuildingId = $derived.by(() => {
        const b = buildings.find((x) => x.name === edificio);
        return b ? Number(b.id) : 0;
    });

    // Medios con pisos (del catálogo), para renderizar los selectores dinámicamente.
    let floorMediaTypes = $derived.by(() => {
        const seen = new Set<string>();
        const out: { id: string; key: string; name: string }[] = [];
        for (const m of catalogState.mediaTypes) {
            if ((m as any).active === false || !(m as any).has_floors) continue;
            if (seen.has(m.key)) continue;
            seen.add(m.key);
            out.push({ id: m.id, key: m.key, name: m.name });
        }
         return out;
    });

    /** Mapa id -> medio, para resolver relaciones medio-edificio al renderizar. */
    let mediaTypeById = $derived.by(() => {
        const map: Record<string, any> = {};
        for (const m of catalogState.mediaTypes) map[m.id] = m;
        return map;
    });

    /** Pisos del edificio base para una clave de medio (ej. "p2000"). */
    function baseFloorsForKey(key: string): string[] {
        const fm = floorMediaTypes.find((f) => f.key === key);
        return fm ? (floorsByBuilding[baseBuildingId]?.[fm.id] ?? []) : [];
    }

    /** Indica si un medio aplica en un edificio (relación medio-edificio). */
    function mediaAppliesToBuilding(m: any, bid: number): boolean {
        if (!m.access_media_type_buildings) return true; // fallback: no aplicar filtro si no hay relación cargada
        return m.access_media_type_buildings.some((r: any) => Number(r.building_id) === bid);
    }

    /** Pisos base por clave de medio (dinámico, para el payload de guardado). */
    let pisosPorMedio = $derived.by(() => {
        const out: Record<string, string[]> = {};
        for (const fm of floorMediaTypes) out[fm.key] = baseFloorsForKey(fm.key);
        return out;
    });

    /** Edificios con acceso seleccionados para esta persona. */
    let selectedBuildings = $state<number[]>([]);

    function toggleBuilding(bid: number) {
        if (selectedBuildings.includes(bid)) {
            // Desmarcar descarta sus pisos y sus accesos especiales del guardado.
            const next = { ...floorsByBuilding };
            delete next[bid];
            floorsByBuilding = next;
            selectedBuildings = selectedBuildings.filter((b) => b !== bid);
            const removedIds = new Set(
                availableSpecialAccesses
                    .filter((a) => Number((a as any).building_id) === bid)
                    .map((a) => Number(a.id)),
            );
            accesosEspeciales = accesosEspeciales.filter((id) => !removedIds.has(id));
        } else {
            selectedBuildings = [...selectedBuildings, bid];
        }
    }

    function updateBuildingFloors(
        buildingId: number,
        key: string,
        value: string[],
    ) {
        const current = floorsByBuilding[buildingId] || {};
        floorsByBuilding = {
            ...floorsByBuilding,
            [buildingId]: { ...current, [key]: value },
        };
    }

    // El edificio base (radicación) es independiente de los accesos asignados:
    // solo se agrega a selectedBuildings si el usuario lo solicita, igual que los demás.

    // Accesos especiales filtrados a los edificios seleccionados.
    let availableSpecialAccesses = $derived.by(() => {
        if (selectedBuildings.length === 0) return specialAccesses;
        return specialAccesses.filter((a) => {
            const bid = (a as any).building_id;
            return bid == null || selectedBuildings.includes(Number(bid));
        });
    });

    /** Opciones de accesos especiales de un edificio: id + nombre (para mostrar). */
    function specialOptionsFor(bid: number): { id: number; name: string }[] {
        return availableSpecialAccesses
            .filter((a) => Number((a as any).building_id) === bid)
            .map((a) => ({ id: Number(a.id), name: a.name }));
    }

    /** Nombres de accesos especiales seleccionados pertenecientes a un edificio. */
    function selectedSpecialNames(bid: number): string[] {
        const opts = specialOptionsFor(bid);
        return accesosEspeciales
            .filter((id) => opts.some((o) => o.id === id))
            .map((id) => opts.find((o) => o.id === id)!.name);
    }

    /** Actualiza la selección de accesos especiales por edificio (nombres → ids). */
    function onSpecialChange(bid: number, names: string[]) {
        const opts = specialOptionsFor(bid);
        const otherIds = accesosEspeciales.filter((id) => !opts.some((o) => o.id === id));
        const newIds = names
            .map((n) => opts.find((o) => o.name === n)?.id)
            .filter((id): id is number => id !== undefined);
        accesosEspeciales = [...otherIds, ...newIds];
    }

    /** Convierte nombres de accesos especiales a sus ids (para prefill/import). */
    function namesToSpecialIds(names: string[]): number[] {
        const ids: number[] = [];
        for (const n of names) {
            const id = catalogState.specialAccesses.find((s) => s.name === n)?.id;
            if (id !== undefined) ids.push(Number(id));
        }
        return ids;
    }

    // Al cambiar de edificio, reiniciar solo el piso base (los pisos asignados
    // se seleccionan por edificio y no dependen del edificio de radicación).
    $effect(() => {
        if (edificio && !editingPerson && !prefill) {
            pisoBase = "";
        }
    });

    // Auto-mayúsculas en nombres + verificación de duplicados
    $effect(() => {
        if (nombres) nombres = nombres.toUpperCase();
        if (apellidos) apellidos = apellidos.toUpperCase();

        // Solo verificar si estamos creando una persona NUEVA o precargando
        if (!disableDuplicateCheck && (!editingPerson || prefill)) {
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
            // Usamos búsqueda difusa con umbral alto o solo coincidencia de nombre
            const results = await personnelService.searchByName(ape, nom);
            // Filtrar para encontrar coincidencias muy cercanas (insensible a acentos)
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
        } catch {
            // Manejar errores de verificación de duplicados silenciosamente (no crítico)
        } finally {
            isCheckingDuplicates = false;
        }
    }

    // Poblar formulario
    let lastLoadedPersonId = $state("");

    // Trae los pisos multi-edificio del nuevo modelo y los mezcla con el
    // fallback derivado (mientras no existan permisos para el edificio base).
    async function refreshPersonAccess(personId: string) {
        try {
            const access = await accessAssignmentService.fetchPersonAccess(
                personId,
            );
            const merged: Record<number, Record<string, string[]>> = {};
            for (const [bid, groups] of Object.entries(access.floorsByBuilding)) {
                merged[Number(bid)] = floorGroupsToIdMap(groups);
            }
            const bid =
                        Number(
                            buildings.find(
                                (b) => b.name === edificio,
                            )?.id,
                        ) || undefined;
            if (bid) {
                if (!merged[bid]) merged[bid] = {};
                for (const g of editingPerson?.floors || []) {
                    if ((merged[bid][g.mediaTypeId] || []).length === 0 && g.floors.length) {
                        merged[bid][g.mediaTypeId] = [...g.floors];
                    }
                }
            }
            floorsByBuilding = merged;
            selectedBuildings = [
                ...new Set([
                    ...selectedBuildings,
                    ...Object.keys(access.floorsByBuilding).map(Number),
                ]),
            ];
            if (access.specialAccesses.length > 0) {
                accesosEspeciales = namesToSpecialIds(access.specialAccesses);
            }
        } catch {
            // No crítico: se mantienen los valores cargados
        }
    }

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
                const bid =
                    Number(
                        buildings.find(
                            (b) => b.name === editingPerson.building,
                        )?.id,
                    ) || undefined;
                floorsByBuilding = bid
                    ? { [bid]: floorGroupsToIdMap(editingPerson.floors) }
                    : {};

                if (editingPerson.schedule) {
                    diasHorario = editingPerson.schedule.days;
                    horaEntrada = editingPerson.schedule.entry;
                    horaSalida = editingPerson.schedule.exit;
                }

                email = editingPerson.email || "";
                accesosEspeciales = namesToSpecialIds(editingPerson.specialAccesses || []);
                tarjetasAsignadas = [...(editingPerson.cards || [])];

                lastLoadedPersonId = editingPerson.id;
                editingUpdatedAt = (editingPerson as any).updated_at ?? null;
                selectedBuildings = bid ? [bid] : [];
                void checkStale(editingPerson.id, editingUpdatedAt);

                // Cargar la base multi-edificio de pisos/accesos REALES de la persona
                // y, DESPUÉS, aplicar el prefill (ticket de Alta vinculado) encima,
                // para que los pisos/accesos solicitados prevalezcan sin perder los previos.
                void (async () => {
                    await refreshPersonAccess(editingPerson.id);

                    if (prefill) {
                        if (prefill.pisosPorMedio) {
                            const pid =
                                Number(
                                    buildings.find(
                                        (b) => b.name === prefill.edificio,
                                    )?.id,
                                ) || undefined;
                            if (pid) {
                                const merged = {
                                    ...(floorsByBuilding[pid] ?? {}),
                                };
                                for (const fm of floorMediaTypes) {
                                    const wanted =
                                        !allowedCardTypes ||
                                        allowedCardTypes.includes(fm.name);
                                    if (wanted && prefill.pisosPorMedio[fm.key]) {
                                        merged[fm.id] = [
                                            ...prefill.pisosPorMedio[fm.key],
                                        ];
                                    }
                                }
                                floorsByBuilding = {
                                    ...floorsByBuilding,
                                    [pid]: merged,
                                };
                            }
                        }

                        if (
                            prefill.specialAccesses &&
                            prefill.specialAccesses.length > 0
                        ) {
                            accesosEspeciales = namesToSpecialIds(prefill.specialAccesses);
                        } else if (prefill.specialAccesses) {
                            accesosEspeciales = [];
                        }

                        if (prefill.edificio) edificio = prefill.edificio;
                        if (prefill.pisoBase) pisoBase = prefill.pisoBase;
                        if (prefill.horario) diasHorario = prefill.horario;
                        if (prefill.horaEntrada) horaEntrada = prefill.horaEntrada;
                        if (prefill.horaSalida) horaSalida = prefill.horaSalida;

                        if (prefill.foliosPorMedio) {
                            for (const [key, folio] of Object.entries(prefill.foliosPorMedio)) {
                                if (!folio) continue;
                                const mediaName =
                                    catalogState.mediaTypes.find(
                                        (m: any) => m.key === key,
                                    )?.name ?? key;
                                if (
                                    !tarjetasAsignadas.some(
                                        (c) =>
                                            c.type === mediaName &&
                                            c.folio === folio,
                                    )
                                ) {
                                    tarjetasAsignadas = [
                                        ...tarjetasAsignadas,
                                        { type: mediaName, folio },
                                    ];
                                }
                            }
                        }
                    }
                })();
            });
        } else if (
            isOpen &&
            !editingPerson &&
            prefill &&
            lastLoadedPersonId !== "__prefill__"
        ) {
            // Precarga para una persona NUEVA desde un ticket importado
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
                email = normalizeEmailText(prefill.correo);
                const prefillBid =
                    Number(
                        buildings.find((b) => b.name === prefill.edificio)?.id,
                    ) || undefined;
                floorsByBuilding = prefillBid
                    ? {
                          [prefillBid]: Object.fromEntries(
                              floorMediaTypes.map((fm) => [
                                  fm.id,
                                  prefill.pisosPorMedio?.[fm.key] ?? [],
                              ]),
                          ),
                      }
                    : {};
                // El edificio de radicación (base) se considera seleccionado aunque
                // el usuario no marcara edificios: si trae pisos/accesos, debe
                // mostrarse activo en el listado.
                selectedBuildings = prefillBid ? [prefillBid] : [];
                accesosEspeciales = namesToSpecialIds(prefill.specialAccesses ?? []);
                tarjetasAsignadas = [];
                if (prefill.foliosPorMedio) {
                    for (const [key, folio] of Object.entries(prefill.foliosPorMedio)) {
                        if (!folio) continue;
                        const mediaName =
                            catalogState.mediaTypes.find(
                                (m: any) => m.key === key,
                            )?.name ?? key;
                        tarjetasAsignadas.push({ type: mediaName, folio });
                    }
                }
                lastLoadedPersonId = "__prefill__";
                editingUpdatedAt = null;
                isStale = false;
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

    function addCard(card: { type: string; folio: string; id?: string; status?: string }) {
        tarjetasAsignadas = [...tarjetasAsignadas, card];
    }

    function removeCard(index: number) {
        tarjetasAsignadas = tarjetasAsignadas.filter((_, i) => i !== index);
    }

    /**
     * Valida que cada piso de cada edificio seleccionado exista en ese edificio,
     * y que el edificio base de radicación esté en el catálogo. Devuelve los
     * problemas para impedir el guardado.
     */
    function validateFloors(): { ok: boolean; unresolved: string[] } {
        const unresolved: string[] = [];
        for (const [bidStr, typeMap] of Object.entries(floorsByBuilding)) {
            const bid = Number(bidStr);
            const b = buildings.find((x) => Number(x.id) === bid);
            if (!b) {
                unresolved.push(`Edificio no reconocido (id ${bid})`);
                continue;
            }
            const canonical = b.floors || [];
            for (const list of Object.values(typeMap || {})) {
                const { unresolved: bad } = resolveFloorList(list, canonical);
                if (bad.length) {
                    unresolved.push(...bad.map((x) => `${x} (${b.name})`));
                }
            }
        }
        if (unresolved.length === 0) return { ok: true, unresolved: [] };
        return { ok: false, unresolved };
    }

    async function handleSave() {
        if (isSubmitting) return;
        errors = {};

        // Validar que los pisos seleccionados existan en su edificio. Si alguno
        // no se reconoce, se bloquea el guardado para evitar pisos "null".
        const floorCheck = validateFloors();
        if (!floorCheck.ok) {
            const details = floorCheck.unresolved
                .slice(0, 6)
                .map((f) => `"${f}"`)
                .join(", ");
            errors.floor = "Hay pisos que no existen en el edificio seleccionado.";
            toast.error("Pisos no reconocidos", {
                description: `No se guardó la persona. Pisos inválidos: ${details}. Ajusta los pisos en el selector antes de continuar.`,
            });
            return;
        }

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
                pisosPorMedio,
                first_name: nombres,
                last_name: apellidos,
                employee_no: noEmpleado,
                email: normalizeEmailText(email),
                floor: pisoBase,
                floorsByBuilding,
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
                    pisosPorMedio: (() => {
                        const out: Record<string, string[]> = {};
                        for (const fm of floorMediaTypes) {
                            out[fm.key] = floorsForKey(editingPerson.floors, fm.key);
                        }
                        return out;
                    })(),
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
                // Optimistic locking: solo en guardado directo (no ticket). Si la
                // fila cambió desde que se abrió, abortamos sin sobrescribir.
                if (editingPerson && editingUpdatedAt) {
                    const personRowPayload = {
                        first_name: nombres,
                        last_name: apellidos,
                        employee_no: (noEmpleado || "").trim() || null,
                        area: areaEquipo || null,
                        position: puestoFuncion || null,
                        dependency_id: dependencies.find((d) => d.name === dependency)?.id ?? null,
                        building_id: buildings.find((b) => b.name === edificio)?.id ?? null,
                        floor: pisoBase || null,
                        schedule_id: schedules.find((s) => s.name === diasHorario)?.id ?? null,
                        entry_time: horaEntrada || null,
                        exit_time: horaSalida || null,
                        email: normalizeEmailText(email) || null,
                        status: editingPerson?.status_raw || "active",
                    };
                    const lock = await updateWithLock(
                        "personnel",
                        editingPerson.id,
                        personRowPayload,
                        editingUpdatedAt,
                    );
                    if (!lock.ok) {
                        toast.error(CONFLICT_MSG);
                        return;
                    }
                }
                if (editingPerson) {
                    await personnelService.save(data);
                } else {
                    // Alta nueva: atómica (persona + tarjetas + permisos).
                    await personnelService.createWithAccess(data);
                }
                const updated = await personnelService.fetchAll();
                personnelState.pagination.setItems(updated.data, updated.count);
                toast.success("Personal Registrado");
            }

            oncomplete?.();
            resetAndClose();
        } catch (e) {
            handleError(e, "Guardar Personal");
        } finally {
            isSubmitting = false;
        }
    }

    function resetForm() {
        editingUpdatedAt = null;
        isStale = false;
        nombres = "";
        apellidos = "";
        noEmpleado = "";
        dependency = "";
        areaEquipo = "";
        puestoFuncion = "";
        edificio = "";
        pisoBase = "";
        floorsByBuilding = {};
        selectedBuildings = [];
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
        {#if isStale}
            <div
                class="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-xs font-semibold"
            >
                ⚠️ Este registro fue modificado por otra persona luego de que lo
                abriste. Puedes seguir editando; al guardar se validará la
                versión.
            </div>
        {/if}

        {#if headerContent}
            {@render headerContent()}
        {/if}

        <!-- SECTION: Personal Info -->
        <FormSection title="Datos Personales" disabled={!userState.canEdit}>
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
                <FormField label="Nombres" for="nombres" error={errors.first_name}>
                    <Input
                        id="nombres"
                        bind:value={nombres}
                        placeholder="Juan Carlos"
                        class={isDifferent(comparisonFields[0])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[0])}
                </FormField>
                <FormField label="Apellidos" for="apellidos" error={errors.last_name}>
                    <Input
                        id="apellidos"
                        bind:value={apellidos}
                        placeholder="Pérez García"
                        class={isDifferent(comparisonFields[1])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[1])}
                </FormField>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <FormField label="No. Empleado" for="noEmpleado">
                    <Input
                        id="noEmpleado"
                        bind:value={noEmpleado}
                        placeholder="EMP-001"
                        class={isDifferent(comparisonFields[2])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[2])}
                </FormField>
                <div class="md:col-span-2">
                    <FormField label="Dependencia" for="dependencia" error={errors.dependency}>
                        <DependencySelect
                            id="dependencia"
                            bind:value={dependency}
                            class={isDifferent(comparisonFields[3])
                                ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                                : ""}
                        />
                        {@render DiffIndicator(comparisonFields[3])}
                    </FormField>
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <FormField label="Área / Equipo" for="area">
                    <Input
                        id="area"
                        bind:value={areaEquipo}
                        placeholder="Sistemas"
                        class={isDifferent(comparisonFields[4])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[4])}
                </FormField>
                <FormField label="Puesto / Función" for="puesto">
                    <Input
                        id="puesto"
                        bind:value={puestoFuncion}
                        placeholder="Analista"
                        class={isDifferent(comparisonFields[5])
                            ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                            : ""}
                    />
                    {@render DiffIndicator(comparisonFields[5])}
                </FormField>
            </div>

            <FormField label="Correo Electrónico" for="email" error={errors.email}>
                <Input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="correo@ejemplo.com"
                    class={isDifferent(comparisonFields[6])
                        ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/30"
                        : ""}
                />
                {@render DiffIndicator(comparisonFields[6])}
            </FormField>
        </FormSection>

        <!-- SECTION: Location -->
        <FormSection title="Ubicación" disabled={!userState.canEdit}>
            <div class="grid gap-4 md:grid-cols-2">
                <FormField label="Edificio" for="edificio" error={errors.building}>
                    <BuildingSelect
                        id="edificio"
                        bind:value={edificio}
                        class={errors.building ? "border-red-500 ring-red-200" : ""}
                    />
                </FormField>
                <FormField label="Piso Base" for="pisoBase" error={errors.floor}>
                    <Select
                        id="pisoBase"
                        bind:value={pisoBase}
                        disabled={!edificio}
                        class={errors.floor ? "border-red-500 ring-red-200" : ""}
                    >
                        {#each availableFloors as f}
                            <option value={f}>{f}</option>
                        {/each}
                    </Select>
                </FormField>
            </div>

            {#if edificio}
                <div class="space-y-4">
                    <!-- Edificios con acceso: solo se configuran los seleccionados -->
                    <div>
                        <p class="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Edificios con acceso</p>
                        <div class="flex flex-wrap gap-2">
                            {#each buildings as b}
                                {#if (b.floors || []).length > 0 || specialOptionsFor(Number(b.id)).length > 0}
                                    {@const bid = Number(b.id)}
                                    {@const isBase = bid === baseBuildingId}
                                    <button
                                        type="button"
                                        class="px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all active:scale-95 {selectedBuildings.includes(bid)
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                            : 'border-slate-200 text-slate-500 hover:border-blue-300'}"
                                        onclick={() => toggleBuilding(bid)}
                                        title={isBase ? "Edificio de radicación (independiente del acceso; márcalo solo si solicita acceso aquí)" : undefined}
                                    >
                                        {b.name}{isBase ? " ★" : ""}
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    </div>

                    {#each buildings as b}
                        {@const bid = Number(b.id)}
                        {@const bFloors = b.floors || []}
                        {#if selectedBuildings.includes(bid) && (bFloors.length > 0 || specialOptionsFor(bid).length > 0)}
                            <div
                                class="rounded-lg border p-3 {bid ===
                                baseBuildingId
                                    ? 'border-slate-300 bg-slate-50'
                                    : 'border-slate-200 bg-white'}"
                            >
                                <div class="flex items-center justify-between mb-2">
                                    <span
                                        class="text-xs font-bold text-slate-600 uppercase tracking-widest"
                                    >
                                        {b.name}
                                        {#if bid === baseBuildingId}
                                            <span
                                                class="ml-1 normal-case text-[10px] font-medium text-blue-600"
                                            >
                                                (Edificio base)
                                            </span>
                                        {/if}
                                    </span>
                                </div>
                                <div class="space-y-4">
                                    {#each floorMediaTypes as fm}
                                        {#if mediaAppliesToBuilding(mediaTypeById[fm.id], bid)}
                                            <ToggleGroup
                                                label={`Pisos ${fm.name}`}
                                                options={bFloors}
                                                value={floorsByBuilding[bid]?.[fm.id] ?? []}
                                                onchange={(v) =>
                                                    updateBuildingFloors(bid, fm.id, v)}
                                                showSelectAll={true}
                                            />
                                        {/if}
                                    {/each}
                                    {#if specialOptionsFor(bid).length > 0}
                                        <ToggleGroup
                                            label="Accesos Especiales"
                                            options={specialOptionsFor(bid).map((o) => o.name)}
                                            value={selectedSpecialNames(bid)}
                                            onchange={(v) => onSpecialChange(bid, v)}
                                        />
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>
            {/if}
        </FormSection>

        <!-- SECTION: Schedule -->
        <FormSection title="Horario" disabled={!userState.canEdit}>
            <FormField label="Días" for="dias" error={errors.schedule_days}>
                <ScheduleSelect
                    id="dias"
                    bind:value={diasHorario}
                    class={errors.schedule_days ? "border-red-500 ring-red-200" : ""}
                />
            </FormField>

            <div class="grid gap-4 md:grid-cols-2">
                <FormField label="Entrada" for="entrada">
                    <Input id="entrada" type="time" bind:value={horaEntrada} />
                </FormField>
                <FormField label="Salida" for="salida">
                    <Input id="salida" type="time" bind:value={horaSalida} />
                </FormField>
            </div>
        </FormSection>

        <!-- SECTION: Cards -->
        {#if !editingPerson || prefill}
            <FormSection title="Gestión de Tarjetas">
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
                                    <Badge variant={mediaTypeVariant(card.type)}>{card.type}</Badge
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
            </FormSection>
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
                                ? "Vincular Alta a Persona"
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
