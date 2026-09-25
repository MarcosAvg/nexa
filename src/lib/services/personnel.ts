import { supabase } from '../supabase';
import { HistoryService } from './history';
import {
    withErrorHandling,
    withErrorHandlingSafe,
    withErrorHandlingConditional,
    withTimeout,
    dbCache,
    batchPaginate,
} from '../utils';
import { computePersonStatus } from '../utils/personStatus';
import {
    deriveAccessFromAssignments,
    buildPermissionPlan,
    accessAssignmentService,
} from './accessAssignments';
import { importedFolioLookupKey } from './cards';
import { catalogState } from '../stores/catalogs.svelte';
import { wantsCard } from '../utils/matchAnalysis';
import { parseFloors } from '../utils/xlsxFields';
import type {
    Person,
    Card,
    DashboardMetrics,
    DashboardStats,
    DashboardGrowth,
    ImportedFolioOwnership,
    ImportedFolioRequest,
    ImportedFolioStatus,
    LinkablePersonnelField,
    LinkLegacyResult,
    LinkPersonalUpdates,
} from '../types';
import { networkStore } from '../stores/network.svelte';

/** Row shape from personnel_with_status view or personnel table with joins */
interface PersonnelRow {
    id: string;
    first_name: string;
    last_name: string;
    employee_no: string;
    email?: string | null;
    area?: string | null;
    position?: string | null;
    floor?: string | null;
    status: string;
    computed_status?: string;
    entry_time?: string | null;
    exit_time?: string | null;
    building_id?: string | null;
    dependency_id?: string | null;
    building_name?: string | null;
    dependency_name?: string | null;
    photo_url?: string | null;
    schedule_id?: string | null;
    schedule_name?: string | null;
    schedules?: { name: string; default_entry?: string; default_exit?: string } | null;
    buildings?: { name: string } | null;
    dependencies?: { name: string } | null;
    access_assignments?: any[];
    cards?: {
        id: string;
        folio: string;
        type: string;
        status: string;
        programming_status: string | null;
        responsiva_status: string | null;
    }[];
}

/** Convierte filas de access_media (con access_media_types) a la forma `cards` que usa la UI. */
function toCardsShape(media: any[] | null | undefined): Card[] {
    return (media || []).map((m: any) => ({
        id: m.id,
        folio: m.identifier ?? '',
        type: m.access_media_types?.name ?? '',
        status: m.status,
        person_id: m.person_id,
        programming_status: m.programming_status,
        responsiva_status: m.responsiva_status,
        has_floors: m.access_media_types?.has_floors,
        requires_responsiva: m.access_media_types?.requires_responsiva,
    }));
}

const mapPersonRecord = (p: PersonnelRow): Person => {
    const allCards = toCardsShape((p as any).access_media);
    const access = deriveAccessFromAssignments((p as any).access_assignments);

    const displayStatus = p.computed_status || computePersonStatus(p.status, allCards, p.building_id);

    return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        name: `${p.first_name} ${p.last_name}`,
        employee_no: p.employee_no,
        email: p.email,
        area: p.area,
        position: p.position,
        floor: p.floor,
        building: p.building_name || p.buildings?.name || 'N/A',
        building_id: p.building_id ?? null,
        dependency: p.dependency_name || p.dependencies?.name || 'N/A',
        schedule: p.schedules
            ? {
                  days: p.schedules.name,
                  entry: p.entry_time || p.schedules.default_entry || '09:00',
                  exit: p.exit_time || p.schedules.default_exit || '18:00',
              }
            : p.schedule_name
              ? {
                    days: p.schedule_name,
                    entry: p.entry_time || '09:00',
                    exit: p.exit_time || '18:00',
                }
              : null,
        status_raw: p.status,
        status: displayStatus,
        cards: allCards,
        floors: access.floors,
        specialAccesses: access.specialAccesses,
    } as Person;
};

/** Resultado de resolver una fila importada contra el catálogo. */
interface ImportCatalogResolution {
    dependency?: any;
    building?: any;
    schedule?: any;
    cards: { type: string; folio: string; key: string }[];
    specialAccessIds: number[];
    floorsByBuilding: Record<number, Record<string, string[]>>;
    mediaKeyByTypeId: Record<string, string>;
}

/** Resuelve dependencia/edificio/horario/medios/accesos especiales por nombre. */
function resolveImportCatalog(fields: Record<string, string>): ImportCatalogResolution {
    const cats = catalogState;
    const norm = (s: string) =>
        s
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    const findByName = (list: any[], name: string | undefined) => {
        if (!name || !list) return undefined;
        const n = norm(name);
        return list.find((x) => norm(x?.name ?? '') === n);
    };

    const dependency = findByName(cats.dependencies, fields.dependencia);
    const building = findByName(cats.buildings, fields.edificio);
    const schedule = findByName(cats.schedules, fields.horario);

    if (fields.dependencia && !dependency)
        throw new Error(`Dependencia no encontrada: "${fields.dependencia}"`);
    if (fields.edificio && !building) throw new Error(`Edificio no encontrado: "${fields.edificio}"`);
    if (fields.horario && !schedule) throw new Error(`Horario no encontrado: "${fields.horario}"`);

    const medias = (catalogState.mediaTypes || []) as any[];
    const cards: { type: string; folio: string; key: string }[] = [];
    const specialAccessIds: number[] = [];
    const floorsByBuilding: Record<number, Record<string, string[]>> = {};
    const mediaKeyByTypeId: Record<string, string> = {};
    const buildingId = building ? Number(building.id) : null;

    for (const m of medias) {
        if (m.active === false) continue;
        mediaKeyByTypeId[m.id] = m.key;
        const mediaInfo = { key: m.key, name: m.name, has_floors: m.has_floors === true };
        if (!wantsCard(fields, mediaInfo as any)) continue;

        const folio = (fields[`${m.key}_folio`] || '').trim();
        if (folio) cards.push({ type: m.name, folio, key: m.key });

        if (m.has_floors && buildingId) {
            const floors = parseFloors(fields[`pisos_${m.key}`]);
            if (floors.length > 0) {
                if (!floorsByBuilding[buildingId]) floorsByBuilding[buildingId] = {};
                floorsByBuilding[buildingId][m.id] = floors;
            }
        }
    }

    for (const name of [fields.acceso1, fields.acceso2, fields.acceso3]) {
        const acc = findByName(cats.specialAccesses, name);
        if (acc) specialAccessIds.push(Number(acc.id));
    }

    return { dependency, building, schedule, cards, specialAccessIds, floorsByBuilding, mediaKeyByTypeId };
}

/** Solicitudes de folio con folio no vacío detectadas en una fila importada. */
export function resolveImportedFolioRequests(fields: Record<string, string>): ImportedFolioRequest[] {
    const medias = (catalogState.mediaTypes || []) as any[];
    const requests: ImportedFolioRequest[] = [];

    for (const m of medias) {
        if (m.active === false) continue;
        const mediaInfo = { key: m.key, name: m.name, has_floors: m.has_floors === true };
        if (!wantsCard(fields, mediaInfo as any)) continue;
        const folio = (fields[`${m.key}_folio`] || '').trim();
        if (!folio) continue;
        requests.push({
            rowKey: '',
            rowNumber: 0,
            mediaTypeId: m.id,
            mediaKey: m.key,
            mediaName: m.name,
            folio,
        });
    }

    return requests;
}

/**
 * Clasifica un folio solicitado contra su propiedad actual.
 * Todo medio con `person_id` cuenta como ocupado, sin importar su estado.
 */
export function classifyImportedFolio(
    ownership: ImportedFolioOwnership | undefined,
    targetPersonId: string | null,
): ImportedFolioStatus {
    if (!ownership) return 'nuevo';
    if (ownership.ownerId && targetPersonId && ownership.ownerId === targetPersonId) return 'ya_asignado';
    if (!ownership.ownerId && ownership.status === 'available') return 'disponible';
    return 'ocupado';
}

/**
 * Verifica la disponibilidad exacta de los folios que realmente se asignarán.
 * Se ejecuta justo antes de mutar datos para reducir el riesgo de revisiones obsoletas.
 */
export async function assertImportedFolios(
    fields: Record<string, string>,
    options: { targetPersonId?: string | null; excludeMediaKeys?: string[] } = {},
): Promise<void> {
    const exclude = new Set(options.excludeMediaKeys ?? []);
    const requests = resolveImportedFolioRequests(fields).filter((request) => !exclude.has(request.mediaKey));
    if (requests.length === 0) return;

    const { cardService } = await import('./cards');
    const ownership = await cardService.checkImportedFolioOwnership(requests);

    for (const request of requests) {
        const record = ownership.get(importedFolioLookupKey(request.mediaTypeId, request.folio));
        const status = classifyImportedFolio(record, options.targetPersonId ?? null);
        if (status === 'nuevo' || status === 'disponible' || status === 'ya_asignado') continue;
        const owner = record?.ownerName ? ` Está asignado a ${record.ownerName}.` : '';
        throw new Error(
            `El folio "${request.folio}" de ${request.mediaName} ya está asignado a otra persona.${owner}`,
        );
    }
}

export const LINKABLE_PERSONNEL_FIELD_DEFS: { field: LinkablePersonnelField; label: string }[] = [
    { field: 'first_name', label: 'Nombres' },
    { field: 'last_name', label: 'Apellidos' },
    { field: 'employee_no', label: 'No. empleado' },
    { field: 'dependency_id', label: 'Dependencia' },
    { field: 'building_id', label: 'Edificio' },
    { field: 'floor', label: 'Piso base' },
    { field: 'area', label: 'Área / equipo' },
    { field: 'position', label: 'Puesto / función' },
    { field: 'schedule_id', label: 'Horario' },
    { field: 'entry_time', label: 'Hora entrada' },
    { field: 'exit_time', label: 'Hora salida' },
    { field: 'email', label: 'Correo electrónico' },
];

export function proposedLinkFieldValue(
    field: LinkablePersonnelField,
    fields: Record<string, string>,
): string {
    switch (field) {
        case 'first_name':
            return fields.nombres ?? '';
        case 'last_name':
            return fields.apellidos ?? '';
        case 'employee_no':
            return fields.no_empleado ?? '';
        case 'dependency_id':
            return fields.dependencia ?? '';
        case 'building_id':
            return fields.edificio ?? '';
        case 'floor':
            return fields.piso_base ?? '';
        case 'area':
            return fields.area ?? '';
        case 'position':
            return fields.puesto ?? '';
        case 'schedule_id':
            return fields.horario ?? '';
        case 'entry_time':
            return fields.hora_entrada ?? '';
        case 'exit_time':
            return fields.hora_salida ?? '';
        case 'email':
            return fields.correo ?? '';
    }
}

export function currentLinkFieldValue(field: LinkablePersonnelField, person: Person): string {
    switch (field) {
        case 'first_name':
            return person.first_name ?? '';
        case 'last_name':
            return person.last_name ?? '';
        case 'employee_no':
            return person.employee_no ?? '';
        case 'dependency_id':
            return person.dependency ?? '';
        case 'building_id':
            return person.building ?? '';
        case 'floor':
            return person.floor ?? '';
        case 'area':
            return person.area ?? '';
        case 'position':
            return person.position ?? '';
        case 'schedule_id':
            return person.schedule?.days ?? '';
        case 'entry_time':
            return person.schedule?.entry ?? '';
        case 'exit_time':
            return person.schedule?.exit ?? '';
        case 'email':
            return person.email ?? '';
    }
}

export function linkFieldDiffers(
    field: LinkablePersonnelField,
    person: Person,
    fields: Record<string, string>,
): boolean {
    const proposed = proposedLinkFieldValue(field, fields).trim();
    if (!proposed) return false;
    const normalize = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    return normalize(currentLinkFieldValue(field, person)) !== normalize(proposed);
}

export const personnelService = {
    async fetchAll(
        page: number = 1,
        limit: number = 50,
        search: string = '',
        statusFilter: string = 'Todos',
        dependencyId: string = '',
        buildingId: string = '',
        floor: string = '',
        mediaTypeId: string = '',
    ): Promise<{ data: Person[]; count: number }> {
        return withErrorHandlingSafe(
            async () => {
                const cacheKey = `personnel_page_${page}_${statusFilter}_${dependencyId}_${buildingId}_${floor}_${mediaTypeId}_${search}`;
                if (!networkStore.isOnline) {
                    const cachedData = await dbCache.load<{ data: Person[]; count: number }>(cacheKey);
                    if (cachedData) return cachedData;
                    return { data: [], count: 0 };
                }

                const mediaRelation =
                    mediaTypeId && mediaTypeId !== '__none__'
                        ? 'access_media!inner(id, identifier, status, programming_status, responsiva_status, access_media_types(name, has_floors, requires_responsiva))'
                        : mediaTypeId === '__none__'
                          ? 'access_media!left(id, identifier, status, programming_status, responsiva_status, access_media_types(name, has_floors, requires_responsiva))'
                          : 'access_media(id, identifier, status, programming_status, responsiva_status, access_media_types(name, has_floors, requires_responsiva))';
                let query = supabase
                    .from('personnel_with_status')
                    .select(
                        `*, ${mediaRelation}, access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name)))`,
                        { count: 'exact' },
                    );

                if (search) {
                    const terms = search.trim().split(/\s+/).filter(Boolean);
                    for (const term of terms) {
                        query = query.or(
                            `first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`,
                        );
                    }
                }
                if (statusFilter === 'No Activos')
                    query = query.not(
                        'computed_status',
                        'in',
                        '("Activo/a","Parcial","Media de otro edificio")',
                    );
                else if (statusFilter !== 'Todos') query = query.eq('computed_status', statusFilter);
                if (dependencyId) query = query.eq('dependency_id', dependencyId);
                if (buildingId === '__none__') query = query.is('building_id', null);
                else if (buildingId) query = query.eq('building_id', buildingId);
                if (floor === '__none__') query = query.or('floor.is.null,floor.eq.');
                else if (floor) query = query.eq('floor', floor);
                if (mediaTypeId && mediaTypeId !== '__none__')
                    query = query.eq('access_media.media_type_id', mediaTypeId);
                else if (mediaTypeId === '__none__') query = query.is('access_media.id', null);

                const from = (page - 1) * limit;
                const { data, count, error } = await query
                    .order('first_name', { ascending: true })
                    .range(from, from + limit - 1);

                if (error) {
                    console.warn('Falling back from personnel_with_status view:', error.message);
                    return this._fetchAllFallback(
                        page,
                        limit,
                        search,
                        statusFilter,
                        dependencyId,
                        buildingId,
                        floor,
                        mediaTypeId,
                    );
                }

                const result = { data: (data || []).map((p) => mapPersonRecord(p)), count: count || 0 };
                await dbCache.save(cacheKey, result);
                return result;
            },
            'Fetch Personnel',
            { data: [], count: 0 },
        );
    },

    // Helper para lógica de fallback
    async _fetchAllFallback(
        page: number,
        limit: number,
        search: string,
        statusFilter: string,
        dependencyId: string,
        buildingId: string,
        floor: string = '',
        mediaTypeId: string = '',
    ) {
        const isComputedStatus = ['Activo/a', 'Parcial', 'Sin Acceso'].includes(statusFilter);
        const isNoActivos = statusFilter === 'No Activos';
        const dbStatusMap: Record<string, string> = {
            'Bloqueado/a': 'blocked',
            Baja: 'inactive',
        };

        // Construir query sin .range() — Supabase muta .range() in-place,
        // así que construimos una vez y encadenamos diferentes .range() por página en batchPaginate.
        const buildBaseQuery = (withCount: boolean = false): any => {
            let q: any = supabase.from('personnel');

            if (withCount) {
                q = q.select('*', { count: 'exact', head: true });
            } else {
                const mediaRelation =
                    mediaTypeId && mediaTypeId !== '__none__'
                        ? 'access_media!inner(*, access_media_types(name, has_floors, requires_responsiva))'
                        : mediaTypeId === '__none__'
                          ? 'access_media!left(*, access_media_types(name, has_floors, requires_responsiva))'
                          : 'access_media(*, access_media_types(name, has_floors, requires_responsiva))';
                q = q.select(
                    `*, ${mediaRelation}, access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name))), buildings(name), dependencies(name), schedules(*)`,
                );
            }

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                for (const term of terms) {
                    const termPattern = `%${term}%`;
                    q = q.or(
                        `first_name.ilike.${termPattern},last_name.ilike.${termPattern},employee_no.ilike.${termPattern}`,
                    );
                }
            }

            if (statusFilter !== 'Todos' && !isNoActivos) {
                if (dbStatusMap[statusFilter]) {
                    q = q.eq('status', dbStatusMap[statusFilter]);
                } else if (isComputedStatus) {
                    q = q.eq('status', 'active');
                }
            }

            if (dependencyId) q = q.eq('dependency_id', dependencyId);
            if (buildingId === '__none__') q = q.is('building_id', null);
            else if (buildingId) q = q.eq('building_id', buildingId);
            if (floor === '__none__') q = q.or('floor.is.null,floor.eq.');
            else if (floor) q = q.eq('floor', floor);
            if (mediaTypeId && mediaTypeId !== '__none__')
                q = q.eq('access_media.media_type_id', mediaTypeId);
            else if (mediaTypeId === '__none__') q = q.is('access_media.id', null);

            return q;
        };

        if (isComputedStatus || isNoActivos) {
            const allData = await batchPaginate<any>(async (from, to) => {
                return buildBaseQuery().order('first_name', { ascending: true }).range(from, to);
            });

            const allMapped = allData.map((p) => mapPersonRecord(p));
            const filtered = allMapped.filter((p) =>
                isNoActivos
                    ? !['Activo/a', 'Parcial', 'Media de otro edificio'].includes(p.status)
                    : p.status === statusFilter,
            );
            const from = (page - 1) * limit;
            return { data: filtered.slice(from, from + limit), count: filtered.length };
        } else {
            const from = (page - 1) * limit;
            const to = from + limit - 1;
            const baseQuery = buildBaseQuery();
            const { data, error } = await baseQuery.order('first_name', { ascending: true }).range(from, to);
            if (error) throw error;
            const { count, error: countError } = await buildBaseQuery(true);
            if (countError) throw countError;
            return { data: (data || []).map((p: any) => mapPersonRecord(p)), count: count || 0 };
        }
    },

    async fetchOptions(
        throwOnError: boolean = false,
    ): Promise<{ id: string; name: string; employee_no: string }[]> {
        return withErrorHandlingConditional(
            async () => {
                const { data, error } = await supabase
                    .from('personnel')
                    .select('id, first_name, last_name, employee_no')
                    .neq('status', 'inactive')
                    .order('first_name', { ascending: true });
                if (error) throw error;
                return (data || []).map((p) => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    employee_no: p.employee_no,
                }));
            },
            'Fetch Personnel Options',
            throwOnError,
            [],
        );
    },

    async fetchForExport(
        search: string = '',
        statusFilter: string = 'Todos',
        dependencyId: string = '',
        buildingId: string = '',
        floor: string = '',
        mediaTypeId: string = '',
    ): Promise<Person[]> {
        return withErrorHandlingSafe(
            async () => {
                const isComputedStatus = ['Activo/a', 'Parcial', 'Sin Acceso'].includes(statusFilter);
                const dbStatusMap: Record<string, string> = {
                    'Bloqueado/a': 'blocked',
                    Baja: 'inactive',
                };

                const allData = await batchPaginate<any>(async (from, to) => {
                    const mediaRelation =
                        mediaTypeId && mediaTypeId !== '__none__'
                            ? 'access_media!inner(*, access_media_types(name, has_floors, requires_responsiva))'
                            : mediaTypeId === '__none__'
                              ? 'access_media!left(*, access_media_types(name, has_floors, requires_responsiva))'
                              : 'access_media(*, access_media_types(name, has_floors, requires_responsiva))';
                    let q = supabase
                        .from('personnel')
                        .select(
                            `*, ${mediaRelation}, access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name))), buildings(name), dependencies(name), schedules(*)`,
                        );
                    if (search) {
                        const terms = search.trim().split(/\s+/).filter(Boolean);
                        for (const term of terms)
                            q = q.or(
                                `first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`,
                            );
                    }
                    if (statusFilter !== 'Todos')
                        q = dbStatusMap[statusFilter]
                            ? q.eq('status', dbStatusMap[statusFilter])
                            : q.eq('status', 'active');
                    if (dependencyId) q = q.eq('dependency_id', dependencyId);
                    if (buildingId === '__none__') q = q.is('building_id', null);
                    else if (buildingId) q = q.eq('building_id', buildingId);
                    if (floor === '__none__') q = q.or('floor.is.null,floor.eq.');
                    else if (floor) q = q.eq('floor', floor);
                    if (mediaTypeId && mediaTypeId !== '__none__')
                        q = q.eq('access_media.media_type_id', mediaTypeId);
                    else if (mediaTypeId === '__none__') q = q.is('access_media.id', null);
                    return q.order('first_name', { ascending: true }).range(from, to);
                });

                const mapped = allData.map((p) => mapPersonRecord(p));
                return isComputedStatus ? mapped.filter((p) => p.status === statusFilter) : mapped;
            },
            'Fetch Personnel for Export',
            [],
        );
    },

    async fetchById(id: string): Promise<Person | null> {
        return withErrorHandlingSafe(
            async () => {
                const { data, error } = await supabase
                    .from('personnel')
                    .select(
                        '*, access_media(*, access_media_types(name, has_floors, requires_responsiva)), access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name))), buildings(name), dependencies(name), schedules(*)',
                    )
                    .eq('id', id)
                    .single();
                if (error) throw error;
                return data ? mapPersonRecord(data) : null;
            },
            'Fetch Person By ID',
            null,
        );
    },

    /** Search personnel by apellidos and/or nombres (case-insensitive ilike).
     * Returns all candidates ordered by last_name. Caller decides how to handle 0/1/many results. */
    async searchByName(apellidos: string, nombres: string): Promise<Person[]> {
        return withErrorHandlingSafe(
            async () => {
                const cleanApellidos = (apellidos || '').trim();
                const cleanNombres = (nombres || '').trim();
                if (!cleanApellidos && !cleanNombres) return [];

                let peopleQuery;
                let rpcIds: string[] | null = null;

                if (!cleanApellidos || !cleanNombres) {
                    const queryStr = cleanApellidos || cleanNombres;
                    const terms = queryStr.split(/\s+/).filter(Boolean);
                    if (terms.length === 0) return [];

                    peopleQuery = supabase
                        .from('personnel')
                        .select(
                            '*, access_media(*, access_media_types(name, has_floors, requires_responsiva)), access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name))), buildings(name), dependencies(name), schedules(*)',
                        );
                    for (const term of terms)
                        peopleQuery = peopleQuery.or(
                            `first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`,
                        );
                    peopleQuery = peopleQuery.order('first_name', { ascending: true }).limit(20);
                } else {
                    const { data, error } = await supabase.rpc('search_personnel_fuzzy', {
                        p_last_name: cleanApellidos,
                        p_first_name: cleanNombres,
                        p_limit: 20,
                    });
                    if (error) throw error;
                    if (!data || data.length === 0) return [];
                    rpcIds = data.map((p: { id: string }) => p.id);
                    peopleQuery = supabase
                        .from('personnel')
                        .select(
                            '*, access_media(*, access_media_types(name, has_floors, requires_responsiva)), access_assignments(media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name))), buildings(name), dependencies(name), schedules(*)',
                        )
                        .in('id', rpcIds ?? []);
                }

                const { data: fullPeople, error: fetchError } = await peopleQuery;
                if (fetchError) throw fetchError;

                let orderedPeople = fullPeople || [];
                if (rpcIds) {
                    const idToData = Object.fromEntries(fullPeople.map((p) => [p.id, p]));
                    orderedPeople = rpcIds.map((id) => idToData[id]).filter(Boolean);
                }

                return orderedPeople.map((p) => {
                    const access = deriveAccessFromAssignments(p.access_assignments);
                    return {
                        id: p.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        name: `${p.first_name} ${p.last_name}`,
                        employee_no: p.employee_no,
                        email: p.email,
                        area: p.area,
                        position: p.position,
                        floor: p.floor,
                        building: p.buildings?.name || 'N/A',
                        dependency: p.dependencies?.name || 'N/A',
                        building_id: p.building_id,
                        dependency_id: p.dependency_id,
                        schedule: p.schedules
                            ? {
                                  days: p.schedules.name,
                                  entry: p.entry_time || p.schedules.default_entry || '09:00',
                                  exit: p.exit_time || p.schedules.default_exit || '18:00',
                              }
                            : null,
                        status_raw: p.status,
                        status: p.status,
                        cards: toCardsShape(p.access_media),
                        floors: access.floors,
                        specialAccesses: access.specialAccesses,
                    } as Person;
                });
            },
            'Search Personnel by Name (Fuzzy)',
            [],
        );
    },

    /**
     * Alta atómica: crea persona + tarjetas + asignaciones + permisos en un solo
     * RPC transaccional (create_person_with_access). Solo aplica a personas
     * nuevas (sin `id`). Devuelve el id de la persona creada.
     */
    async createWithAccess(data: {
        first_name?: string;
        last_name?: string;
        nombres?: string;
        apellidos?: string;
        employee_no?: string;
        noEmpleado?: string;
        email?: string | null;
        area?: string;
        areaEquipo?: string;
        position?: string;
        puestoFuncion?: string;
        dependency_id?: string;
        building_id?: string;
        floor?: string;
        pisoBase?: string;
        schedule_id?: string;
        entry_time?: string | null;
        exit_time?: string | null;
        status?: string;
        cards?: any[];
        specialAccesses?: number[];
        floorsByBuilding?: Record<number, Record<string, string[]>>;
        /** Si es true, los medios se crean como legacy (sin firma ni programación pendiente). */
        legacy?: boolean;
        [key: string]: unknown;
    }): Promise<string> {
        return withErrorHandling(async () => {
            const first = data.first_name || data.nombres || '';
            const last = data.last_name || data.apellidos || '';
            if (!first || !last) throw new Error('Nombre y apellidos son requeridos');

            const legacy = data.legacy === true;

            // Resolver media_type_id por cada tarjeta y construir p_media.
            const medias = catalogState.mediaTypes as any[];
            const mediaTypeIds: string[] = [];
            const p_media: any[] = [];
            for (const card of data.cards || []) {
                const media = medias.find(
                    (m) => (m.key && m.key === card.type) || (m.name && m.name === card.type),
                );
                if (!media) continue;
                const requiresProgramming = media.requires_programming !== false;
                let cardId: string | undefined = (card as any).id || undefined;
                const folio = (card.folio || '').trim();
                // Resolver folio existente disponible -> inyectar id para que el RPC asigne
                if (!cardId && folio) {
                    const { data: existing } = await supabase
                        .from('access_media')
                        .select('id, status, media_type_id')
                        .eq('media_type_id', media.id)
                        .eq('identifier', folio)
                        .maybeSingle();
                    if (existing) {
                        if (existing.status === 'available') {
                            cardId = existing.id;
                        } else {
                            // Bloqueo si el tipo no coincide o no está disponible: el RPC también bloqueará
                            const { data: other } = await supabase
                                .from('access_media')
                                .select('id, media_type_id')
                                .eq('identifier', folio)
                                .neq('media_type_id', media.id)
                                .limit(1)
                                .maybeSingle();
                            if (other) {
                                throw new Error(
                                    `El folio "${folio}" ya existe para otro tipo de medio y no coincide con "${media.name}"`,
                                );
                            }
                        }
                    }
                }
                p_media.push({
                    id: cardId,
                    media_type_id: media.id,
                    identifier: folio,
                    status: (card as any).status || 'active',
                    programming_status: legacy ? 'done' : requiresProgramming ? 'pending' : 'done',
                    responsiva_status: legacy ? 'legacy' : 'unsigned',
                });
                mediaTypeIds.push(media.id);
            }

            // Construir p_permissions (plan con assignment_index).
            const floorsByBuilding = (data as any).floorsByBuilding || {};
            const specialAccessIds = (data.specialAccesses as number[]) || [];
            const plan = await buildPermissionPlan(mediaTypeIds, floorsByBuilding, specialAccessIds, {
                buildingId: Number((data as any).building_id) || null,
                floor: (data as any).floor || null,
            });

            const p_person = {
                first_name: first,
                last_name: last,
                employee_no: (data.employee_no || data.noEmpleado || '').trim() || null,
                dependency_id: data.dependency_id ?? '',
                building_id: data.building_id ?? '',
                floor: data.floor || data.pisoBase || '',
                email: data.email || '',
                area: data.area || data.areaEquipo || '',
                position: data.position || data.puestoFuncion || '',
                schedule_id: data.schedule_id ?? '',
                entry_time: data.entry_time || '',
                exit_time: data.exit_time || '',
                status: data.status || 'active',
            };

            const { data: personId, error } = await supabase.rpc('create_person_with_access', {
                p_person,
                p_media,
                p_permissions: plan,
            });
            if (error) throw error;
            return personId as string;
        }, 'Create Person With Access');
    },

    /**
     * Alta directa de un registro importado (hoja ALTAS) en modo legacy:
     * crea la persona y asigna/crea los medios con folio como
     * `programming_status='done'` y `responsiva_status='legacy'` (sin tickets).
     * Resuelve los nombres del catálogo (dependencia, edificio, horario, medios,
     * accesos especiales) a sus ids.
     */
    async importDirectLegacy(
        fields: Record<string, string>,
        options: { excludeMediaKeys?: string[] } = {},
    ): Promise<string> {
        return withErrorHandling(async () => {
            const resolved = resolveImportCatalog(fields);
            const exclude = new Set(options.excludeMediaKeys ?? []);
            await assertImportedFolios(fields, { targetPersonId: null, excludeMediaKeys: [...exclude] });
            const cards = resolved.cards.filter((card) => !exclude.has(card.key));
            const floorsByBuilding: Record<number, Record<string, string[]>> = {};
            for (const [buildingId, mediaFloors] of Object.entries(resolved.floorsByBuilding)) {
                const building = Number(buildingId);
                for (const [mediaTypeId, floors] of Object.entries(mediaFloors)) {
                    const mediaKey = resolved.mediaKeyByTypeId[mediaTypeId];
                    if (mediaKey && exclude.has(mediaKey)) continue;
                    if (!floorsByBuilding[building]) floorsByBuilding[building] = {};
                    floorsByBuilding[building][mediaTypeId] = floors;
                }
            }
            return await this.createWithAccess({
                first_name: fields.nombres,
                last_name: fields.apellidos,
                employee_no: fields.no_empleado,
                dependency_id: resolved.dependency ? String(resolved.dependency.id) : '',
                building_id: resolved.building ? String(resolved.building.id) : '',
                floor: fields.piso_base,
                area: fields.area,
                position: fields.puesto,
                schedule_id: resolved.schedule ? String(resolved.schedule.id) : '',
                entry_time: fields.hora_entrada || null,
                exit_time: fields.hora_salida || null,
                email: fields.correo || null,
                status: 'active',
                cards,
                specialAccesses: resolved.specialAccessIds,
                floorsByBuilding,
                legacy: true,
            });
        }, 'Import Registro Directo (Legacy)');
    },

    /**
     * Vincula un registro importado a una persona existente: aplica únicamente
     * los campos personales seleccionados, asigna los folios no excluidos como
     * legacy y suma los pisos/accesos especiales importados a los actuales.
     */
    async linkLegacyToExisting(
        personId: string,
        fields: Record<string, string>,
        excludeMediaKeys: string[] = [],
        options: { personalUpdates?: LinkPersonalUpdates } = {},
    ): Promise<LinkLegacyResult> {
        return withErrorHandling(async () => {
            return HistoryService.withFlow(async () => {
                const personalUpdates = options.personalUpdates ?? {};
                const unknownFields = Object.keys(personalUpdates).filter(
                    (field) =>
                        !LINKABLE_PERSONNEL_FIELD_DEFS.some((definition) => definition.field === field),
                );
                if (unknownFields.length > 0) {
                    throw new Error(`Campos no permitidos para vinculación: ${unknownFields.join(', ')}`);
                }

                const resolved = resolveImportCatalog(fields);
                const fresh = await this.fetchById(personId);
                if (!fresh) throw new Error('La persona vinculada ya no existe');
                const exclude = new Set(excludeMediaKeys);
                await assertImportedFolios(fields, {
                    targetPersonId: personId,
                    excludeMediaKeys: [...exclude],
                });

                const payload: Record<string, string | number | null> = {};
                const updatedFields: LinkablePersonnelField[] = [];
                const fieldChanges: Record<string, { from: string; to: string }> = {};

                for (const definition of LINKABLE_PERSONNEL_FIELD_DEFS) {
                    const requested = personalUpdates[definition.field];
                    if (requested === undefined) continue;
                    const proposed = requested.trim();
                    if (!proposed) {
                        throw new Error(`Seleccionaste "${definition.label}", pero la fila no tiene valor.`);
                    }
                    if (!linkFieldDiffers(definition.field, fresh, fields)) continue;

                    switch (definition.field) {
                        case 'dependency_id': {
                            if (!resolved.dependency)
                                throw new Error(`Dependencia no encontrada: "${fields.dependencia}"`);
                            payload.dependency_id = Number(resolved.dependency.id);
                            fieldChanges.dependency_id = {
                                from: fresh.dependency,
                                to: fields.dependencia.trim(),
                            };
                            updatedFields.push(definition.field);
                            break;
                        }
                        case 'building_id': {
                            if (!resolved.building)
                                throw new Error(`Edificio no encontrado: "${fields.edificio}"`);
                            payload.building_id = Number(resolved.building.id);
                            fieldChanges.building_id = { from: fresh.building, to: fields.edificio.trim() };
                            updatedFields.push(definition.field);
                            break;
                        }
                        case 'schedule_id': {
                            if (!resolved.schedule)
                                throw new Error(`Horario no encontrado: "${fields.horario}"`);
                            payload.schedule_id = Number(resolved.schedule.id);
                            fieldChanges.schedule_id = {
                                from: fresh.schedule?.days ?? '',
                                to: fields.horario.trim(),
                            };
                            updatedFields.push(definition.field);
                            break;
                        }
                        default: {
                            payload[definition.field] = proposed;
                            fieldChanges[definition.field] = {
                                from: currentLinkFieldValue(definition.field, fresh),
                                to: proposed,
                            };
                            updatedFields.push(definition.field);
                        }
                    }
                }

                if (payload.employee_no) {
                    const { data: duplicate, error: duplicateError } = await supabase
                        .from('personnel')
                        .select('id')
                        .eq('employee_no', payload.employee_no)
                        .neq('id', personId)
                        .maybeSingle();
                    if (duplicateError) throw duplicateError;
                    if (duplicate) {
                        throw new Error(
                            `El número de empleado "${payload.employee_no}" ya está asignado a otra persona.`,
                        );
                    }
                }

                if (Object.keys(payload).length > 0) {
                    const { error: updateError } = await withTimeout(
                        supabase.from('personnel').update(payload).eq('id', personId),
                    );
                    if (updateError) throw updateError;
                    await HistoryService.log('PERSONNEL', personId, 'UPDATE', {
                        message: `Vinculación desde importación de registros: ${updatedFields.join(', ')}`,
                        fields: fieldChanges,
                        linked: true,
                        origin: 'Importación de registros',
                        entityName: `${fresh.first_name} ${fresh.last_name}`,
                    });
                }

                const { cardService } = await import('./cards');
                const assignedFolios: { type: string; folio: string }[] = [];

                for (const card of resolved.cards) {
                    if (exclude.has(card.key)) continue;
                    await cardService.save({
                        type: card.type,
                        folio: card.folio,
                        person_id: personId,
                        programming_status: 'done',
                        responsiva_status: 'legacy',
                    });
                    assignedFolios.push({ type: card.type, folio: card.folio });
                }

                const current = await accessAssignmentService.fetchPersonAccess(personId);
                const merged: Record<number, Record<string, string[]>> = {};

                for (const [bidStr, groups] of Object.entries(current.floorsByBuilding)) {
                    const bid = Number(bidStr);
                    if (!Number.isFinite(bid)) continue;
                    if (!merged[bid]) merged[bid] = {};
                    for (const g of groups) {
                        if (!merged[bid][g.mediaTypeId]) merged[bid][g.mediaTypeId] = [];
                        for (const f of g.floors) {
                            if (!merged[bid][g.mediaTypeId].includes(f)) merged[bid][g.mediaTypeId].push(f);
                        }
                    }
                }
                for (const [bid, typeMap] of Object.entries(resolved.floorsByBuilding)) {
                    const b = Number(bid);
                    if (!Number.isFinite(b)) continue;
                    if (!merged[b]) merged[b] = {};
                    for (const [typeId, floors] of Object.entries(typeMap)) {
                        const mediaKey = resolved.mediaKeyByTypeId[typeId];
                        if (mediaKey && exclude.has(mediaKey)) continue;
                        if (!merged[b][typeId]) merged[b][typeId] = [];
                        for (const f of floors) {
                            if (!merged[b][typeId].includes(f)) merged[b][typeId].push(f);
                        }
                    }
                }

                const { data: specials } = await supabase.from('special_accesses').select('id, name');
                const idByName = new Map<string, number>((specials || []).map((s: any) => [s.name, s.id]));
                const currentSpecialIds = current.specialAccesses
                    .map((n) => idByName.get(n))
                    .filter((id): id is number => id !== undefined);
                const mergedSpecialIds = [...new Set([...currentSpecialIds, ...resolved.specialAccessIds])];

                const updatedBuildingId =
                    payload.building_id !== undefined
                        ? Number(payload.building_id)
                        : (fresh.building_id ?? null);
                const updatedFloor =
                    payload.floor !== undefined ? String(payload.floor) : (fresh.floor ?? null);
                const base = {
                    buildingId: updatedBuildingId,
                    floor: updatedFloor,
                };

                await accessAssignmentService.savePersonAccess(personId, merged, mergedSpecialIds, base);
                // Verificación: detectar pisos solicitados que no quedaron escritos
                // (medio que no aplica al edificio o label que no resolvió a floor_id).
                // Antes se omitían en silencio y había que quitar/reponer edificios
                // y pisos a mano; ahora quedan registrados en el historial.
                try {
                    const written = await accessAssignmentService.fetchPersonAccess(personId);
                    const writtenSet = new Set<string>();
                    for (const [bidStr, groups] of Object.entries(written.floorsByBuilding)) {
                        for (const g of groups) {
                            for (const f of g.floors) {
                                writtenSet.add(`${bidStr}:${g.mediaTypeId}:${f}`);
                            }
                        }
                    }
                    const omitted: { building_id: number; media_type_id: string; floor: string }[] = [];
                    for (const [bidStr, typeMap] of Object.entries(merged)) {
                        for (const [typeId, floors] of Object.entries(typeMap)) {
                            for (const f of floors) {
                                if (!writtenSet.has(`${bidStr}:${typeId}:${f}`)) {
                                    omitted.push({
                                        building_id: Number(bidStr),
                                        media_type_id: typeId,
                                        floor: f,
                                    });
                                }
                            }
                        }
                    }
                    if (omitted.length > 0) {
                        await HistoryService.log('PERSON', personId, 'UPDATE', {
                            message: `Vinculación desde importación: ${omitted.length} piso(s) omitidos (no aplican al edificio o no existen en catálogo)`,
                            omitted_floors: omitted,
                            origin: 'Importación de registros',
                            entityName: `${fresh.first_name} ${fresh.last_name}`,
                        });
                    }
                } catch {
                    // La verificación es informativa: no debe revertir la vinculación.
                }
                return { updatedFields, assignedFolios };
            });
        }, 'Link Registro Legacy a Existente');
    },

    /**
     * Alta directa en lote (legacy). Crea cada registro individualmente y
     * devuelve el conteo de creados y los errores por fila.
     */
    async importRegistros(
        rows: { fields: Record<string, string>; rowNumber: number }[],
    ): Promise<{ creados: number; errores: { index: number; rowNumber: number; message: string }[] }> {
        const errores: { index: number; rowNumber: number; message: string }[] = [];
        let creados = 0;
        // Pre-chequeo: el mismo folio para el mismo medio en dos filas del lote
        // choca en el RPC (asignación única por medio). Fallar temprano con
        // mensaje por fila en vez de dejar el duplicado genérico de BD.
        const seenFolios = new Map<string, number>();
        const skipped = new Set<number>();
        rows.forEach((row, i) => {
            for (const [key, value] of Object.entries(row.fields)) {
                if (!key.endsWith('_folio')) continue;
                const folio = (value || '').trim().toLowerCase();
                if (!folio) continue;
                const mapKey = `${key}:${folio}`;
                const first = seenFolios.get(mapKey);
                if (first !== undefined) {
                    errores.push({
                        index: i,
                        rowNumber: row.rowNumber,
                        message: `Folio duplicado en el archivo (también en fila ${rows[first].rowNumber}): "${(value || '').trim()}"`,
                    });
                    skipped.add(i);
                    break;
                }
                seenFolios.set(mapKey, i);
            }
        });
        for (let i = 0; i < rows.length; i++) {
            if (skipped.has(i)) continue;
            try {
                await this.importDirectLegacy(rows[i].fields);
                creados++;
            } catch (e) {
                errores.push({
                    index: i,
                    rowNumber: rows[i].rowNumber,
                    message: e instanceof Error ? e.message : 'Error desconocido',
                });
            }
        }
        return { creados, errores };
    },

    /** Input shape for creating/updating a personnel record */
    async save(data: {
        id?: string;
        first_name?: string;
        last_name?: string;
        nombres?: string;
        apellidos?: string;
        employee_no?: string;
        noEmpleado?: string;
        email?: string | null;
        area?: string;
        areaEquipo?: string;
        position?: string;
        puestoFuncion?: string;
        dependency_id?: string;
        dependencyId?: string;
        building_id?: string;
        buildingId?: string;
        floor?: string;
        pisoBase?: string;
        schedule_id?: string;
        scheduleId?: string;
        entry_time?: string | null;
        exit_time?: string | null;
        specialAccesses?: number[];
        special_accesses?: string[];
        status?: string;
        cards?: any[];
        [key: string]: unknown;
    }) {
        return withErrorHandling(async () => {
            return HistoryService.withFlow(async () => {
                if (!data.id) {
                    const results = await this.searchByName(
                        data.apellidos || data.last_name || '',
                        data.nombres || data.first_name || '',
                    );
                    const isDuplicate = results.some((r) => {
                        const norm = (s: string) =>
                            s
                                .toLowerCase()
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '');
                        return (
                            norm(r.first_name + ' ' + r.last_name) ===
                            norm(
                                (data.nombres || data.first_name || '') +
                                    ' ' +
                                    (data.apellidos || data.last_name || ''),
                            )
                        );
                    });
                    if (isDuplicate)
                        throw new Error(
                            `Ya existe un registro activo con el nombre "${data.nombres || data.first_name} ${data.apellidos || data.last_name}".`,
                        );
                }

                const payload = {
                    first_name: data.first_name || data.nombres,
                    last_name: data.last_name || data.apellidos,
                    employee_no: (data.employee_no || data.noEmpleado)?.trim() || null,
                    area: data.area || data.areaEquipo,
                    position: data.position || data.puestoFuncion,
                    dependency_id: data.dependency_id || data.dependencyId,
                    building_id: data.building_id || data.buildingId,
                    floor: data.floor || data.pisoBase,
                    schedule_id: data.schedule_id || data.scheduleId,
                    entry_time: data.entry_time || null,
                    exit_time: data.exit_time || null,
                    email: data.email || null,
                    status: data.status || 'active',
                };

                let personId = data.id;
                if (personId) {
                    const { error } = await withTimeout(
                        supabase.from('personnel').update(payload).eq('id', personId),
                    );
                    if (error) throw error;
                    await HistoryService.log('PERSONNEL', personId, 'UPDATE', {
                        message: `Actualización de ${payload.first_name}`,
                        entityName: `${payload.first_name} ${payload.last_name}`,
                    });
                } else {
                    const { data: newPerson, error } = await withTimeout(
                        supabase.from('personnel').insert([payload]).select().single(),
                    );
                    if (error) throw error;
                    personId = newPerson.id;
                    await HistoryService.log('PERSONNEL', personId, 'CREATE', {
                        message: `Registro de ${payload.first_name}`,
                        entityName: `${payload.first_name} ${payload.last_name}`,
                    });
                }

                const cards = data.cards || [];
                if (cards.length > 0) {
                    const { cardService } = await import('./cards');
                    for (const card of cards) await cardService.save({ ...card, person_id: personId });
                }

                // Reconciliar permisos (pisos + accesos especiales) directamente sobre
                // el modelo nuevo, sin depender de columnas legacy ni triggers.
                const { accessAssignmentService } = await import('./accessAssignments');
                let specialAccesses: number[];
                if (Array.isArray(data.specialAccesses)) {
                    specialAccesses = data.specialAccesses;
                } else {
                    // fallback: nombres legacy -> ids del catálogo
                    const names = (data.special_accesses || []) as string[];
                    const { data: rows } = await supabase.from('special_accesses').select('id, name');
                    const idByName = new Map((rows || []).map((r: any) => [r.name, r.id]));
                    specialAccesses = names
                        .map((n) => idByName.get(n))
                        .filter((id): id is number => id !== undefined);
                }
                const floorsByBuilding = (data as any).floorsByBuilding || {};
                await accessAssignmentService.savePersonAccess(
                    String(personId),
                    floorsByBuilding,
                    specialAccesses,
                    {
                        buildingId: Number((data as any).building_id) || null,
                        floor: (data as any).floor || null,
                    },
                );
            });
        }, 'Save Personnel');
    },

    async updateStatus(id: string, status: string) {
        return withErrorHandling(async () => {
            const { error } = await withTimeout(
                supabase.rpc('update_person_status', {
                    p_person_id: id,
                    p_status: status,
                }),
            );
            if (error) throw error;
        }, 'Update Personnel Status');
    },

    async delete(id: string, cardActionMap?: Record<string, 'delete' | 'keep'>) {
        return withErrorHandling(async () => {
            return HistoryService.withFlow(async () => {
                const { data: person } = await supabase
                    .from('personnel')
                    .select('first_name, last_name')
                    .eq('id', id)
                    .single();
                const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${id})`;

                if (cardActionMap) {
                    for (const [cardId, action] of Object.entries(cardActionMap)) {
                        if (action === 'delete')
                            await supabase.from('access_media').delete().eq('id', cardId);
                        else if (action === 'keep')
                            await supabase
                                .from('access_media')
                                .update({
                                    person_id: null,
                                    status: 'available',
                                    responsiva_status: 'unsigned',
                                    programming_status: 'pending',
                                })
                                .eq('id', cardId);
                    }
                }

                await HistoryService.log('PERSONNEL', id, 'DELETE', {
                    message: `Registro eliminado permanentemente${cardActionMap ? ' (con gestión de tarjetas)' : ''}`,
                    entityName: personName,
                });

                const { error } = await supabase.from('personnel').delete().eq('id', id);
                if (error) throw error;
            });
        }, 'Delete Personnel');
    },

    async fetchDashboardStats(): Promise<DashboardStats> {
        return withErrorHandlingSafe(
            async () => {
                // RPC genérica: stock por tipo de medio (sin hardcodes).
                const { data, error } = await supabase.rpc('get_dashboard_stats');
                if (error) throw error;
                return data as DashboardStats;
            },
            'Fetch Dashboard Stats',
            { activePersonnel: 0, stock: [] },
        );
    },

    async fetchDashboardMetrics(): Promise<DashboardMetrics> {
        return withErrorHandlingSafe(
            async () => {
                const { data, error } = await supabase.rpc('get_dashboard_metrics');
                if (error) throw error;
                return data as DashboardMetrics;
            },
            'Fetch Dashboard Metrics (RPC)',
            {
                totalPersonnel: 0,
                statusCounts: {
                    activo: 0,
                    parcial: 0,
                    en_proceso: 0,
                    media_otro_edificio: 0,
                    media_otro_edificio_pendiente: 0,
                    sin_acceso: 0,
                    bloqueado: 0,
                    baja: 0,
                },
                cardCoverage: [],
                operativos: 0,
                noActivos: 0,
                topDependencies: [],
                topBuildings: [],
                buildingFloors: [],
                dataQuality: { sinEmail: 0, sinSchedule: 0, sinPosition: 0, sinArea: 0, total: 0 },
            },
        );
    },

    async fetchDashboardGrowth(startDate: string | null, endDate: string | null): Promise<DashboardGrowth> {
        return withErrorHandlingSafe(
            async () => {
                const { data, error } = await supabase.rpc('get_dashboard_growth', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                });
                if (error) throw error;
                return data as DashboardGrowth;
            },
            'Fetch Dashboard Growth (RPC)',
            {
                startDate: null,
                endDate: null,
                minCreatedAt: null,
                totals: { initial: 0, final: 0, increment: 0, percent: null },
                byDependency: [],
                byBuilding: [],
                byFloor: [],
            },
        );
    },

    subscribeToChanges(
        callback: (payload: {
            eventType: string;
            new: Record<string, unknown>;
            old: Record<string, unknown>;
        }) => void,
    ) {
        return supabase
            .channel('personnel-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel' }, (payload) =>
                callback(payload),
            )
            .subscribe();
    },
};
