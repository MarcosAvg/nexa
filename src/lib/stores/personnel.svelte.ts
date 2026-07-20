import type { Person, Card, DashboardMetrics } from "../types";
import { handleError } from "../utils";
import { PaginatedListState } from "./paginatedList.svelte";

export type PersonnelFilters = {
    search: string;
    status: string;
    dependencyId: string;
    buildingId: string;
};

export class PersonnelState {
    pagination = new PaginatedListState<Person>();

    personnelOptions = $state<{ id: string, name: string, employee_no: string }[]>([]);
    selectedPersonId = $state<string | null>(null);
    extraCards = $state<Card[]>([]);
    isDetailsOpen = $state(false);
    editingPerson = $state<Person | null>(null);
    isEditModalOpen = $state(false);
    highlightedCardId = $state<string | null>(null);

    /** Filtros unificados. Las vistas pueden bindear directamente. */
    filters: PersonnelFilters = $state({
        search: "",
        status: "Todos",
        dependencyId: "",
        buildingId: "",
    });

    dashboardStats = $state({
        activePersonnel: 0,
        koneStock: 0,
        p2000Stock: 0
    });
    dashboardMetrics = $state<DashboardMetrics>({
        totalPersonnel: 0,
        statusCounts: { activo: 0, parcial: 0, inactivo: 0, bloqueado: 0, baja: 0 },
        cardCoverage: { conP2000: 0, sinP2000: 0, conKone: 0, sinKone: 0, operativos: 0 },
        topDependencies: [],
        topBuildings: [],
        dataQuality: { sinEmail: 0, sinSchedule: 0, sinPosition: 0, sinArea: 0, total: 0 },
    });
    metricsLoading = $state(false);

    setPersonnelOptions(data: { id: string, name: string, employee_no: string }[]) {
        this.personnelOptions = data;
    }

    async refreshDashboardStats() {
        try {
            const { supabase } = await import("../supabase");
            const { data, error } = await supabase.rpc('get_dashboard_stats');
            if (error) throw error;
            if (data) {
                this.dashboardStats = data;
                return;
            }
        } catch {
            // Fallback: usar implementación multi-query si la RPC aún no está disponible
        }
        try {
            const { personnelService } = await import("../services/personnel");
            const stats = await personnelService.fetchDashboardStats();
            this.dashboardStats = stats;
        } catch (error) {
            // Manejar error de actualización de estadísticas silenciosamente - reintentará
        }
    }

    async refreshDashboardMetrics() {
        this.metricsLoading = true;
        try {
            const { personnelService } = await import("../services/personnel");
            this.dashboardMetrics = await personnelService.fetchDashboardMetrics();
        } catch (error) {
            // Manejar error de actualización de métricas silenciosamente - reintentará
        } finally {
            this.metricsLoading = false;
        }
    }

    /** Carga la primera página con los filtros actuales. */
    async init() {
        await this.refresh();
    }

    /** Libera recursos (por ahora no hay suscripciones que limpiar). */
    destroy() {
        // las suscripciones Realtime se manejan en initRealtime()
    }

    async refresh(page?: number) {
        const { personnelService } = await import("../services/personnel");
        await this.pagination.fetchPage(
            (p, s) => personnelService.fetchAll(p, s, this.filters.search, this.filters.status, this.filters.dependencyId, this.filters.buildingId),
            page,
        );
    }

    async nextPage() {
        if (this.pagination.nextPage()) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    async prevPage() {
        if (this.pagination.prevPage()) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    async goToPage(page: number) {
        if (this.pagination.goToPage(page)) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    setCards(data: Card[]) {
        this.extraCards = data;
    }

    selectPerson(id: string | null) {
        this.selectedPersonId = id;
        this.isDetailsOpen = !!id;
    }

    setDetailsOpen(open: boolean) {
        this.isDetailsOpen = open;
        if (!open) this.selectedPersonId = null;
    }

    openEditModal(person: Person | null) {
        this.editingPerson = person;
        this.isEditModalOpen = true;
        this.setDetailsOpen(false);
    }

    closeEditModal() {
        this.isEditModalOpen = false;
        this.editingPerson = null;
    }

    async initRealtime() {
        try {
            const { personnelService } = await import("../services/personnel");
            personnelService.subscribeToChanges((payload) => {
                // Siempre actualizar métricas en cualquier cambio
                this.refreshDashboardMetrics();
                this.refreshDashboardStats();

                if (payload.eventType === 'UPDATE') {
                    // Actualizar el array local de personal de forma óptima
                    const newData = payload.new as Record<string, unknown>;
                    const index = this.pagination.items.findIndex(p => p.id === newData.id);
                    if (index !== -1) {
                        // Aplicar cambios optimistas para campos básicos
                        const current = this.pagination.items[index];
                        this.pagination.items[index] = {
                            ...current,
                            first_name: String(newData.first_name ?? current.first_name),
                            last_name: String(newData.last_name ?? current.last_name),
                            name: `${String(newData.first_name ?? '')} ${String(newData.last_name ?? '')}`,
                            employee_no: String(newData.employee_no ?? ''),
                            status_raw: String(newData.status ?? ''),
                            photo_url: String(newData.photo_url ?? current.photo_url ?? ''),
                        };

                        this._refreshOptimisticPerson(String(newData.id));
                    }
                } else if (payload.eventType === 'DELETE' || payload.eventType === 'INSERT') {
                    // Solo actualizar lista completa para INSERT/DELETE si estamos en página 1
                    // O si el registro que cambia es el actualmente seleccionado
                    const isRelevant =
                        this.pagination.currentPage === 1 ||
                        this.selectedPersonId === payload.new?.id ||
                        this.selectedPersonId === payload.old?.id;

                    if (isRelevant && !this.pagination.isLoading) {
                        this.refresh(this.pagination.currentPage);
                    }
                }
            });
        } catch (error) {
            console.warn("Failed to initialize Realtime:", error);
        }
    }

    async _refreshOptimisticPerson(id: string) {
        try {
            const { personnelService } = await import("../services/personnel");
            const updated = await personnelService.fetchById(id);
            if (updated) {
                const index = this.pagination.items.findIndex(p => p.id === id);
                if (index !== -1) {
                    this.pagination.items[index] = updated;
                }
                if (this.editingPerson?.id === id) {
                    this.editingPerson = { ...updated };
                }
            }
        } catch (e) {
            // fail silently on optimistic update error
        }
    }
}

export const personnelState = new PersonnelState();
