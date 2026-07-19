import type { Person, Card, DashboardMetrics } from "../types";
import { handleError } from "../utils";

export class PersonnelState {
    personnel = $state<Person[]>([]);
    personnelOptions = $state<{ id: string, name: string, employee_no: string }[]>([]);
    selectedPersonId = $state<string | null>(null);
    extraCards = $state<Card[]>([]);
    isDetailsOpen = $state(false);
    editingPerson = $state<Person | null>(null);
    isEditModalOpen = $state(false);
    highlightedCardId = $state<string | null>(null);

    currentPage = $state(1);
    pageSize = $state(50);
    totalRecords = $state(0);
    searchQuery = $state("");
    statusFilter = $state("Todos");
    dependencyId = $state("");
    buildingId = $state("");
    isLoading = $state(false);
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

    setPersonnel(data: Person[], count: number) {
        this.personnel = data;
        this.totalRecords = count;
    }

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

    async refresh(page: number = 1, search: string = "", status: string = "Todos", depId: string = "", bldgId: string = "") {
        this.isLoading = true;
        this.currentPage = page;
        this.searchQuery = search;
        this.statusFilter = status;
        this.dependencyId = depId;
        this.buildingId = bldgId;

        try {
            const { personnelService } = await import("../services/personnel");
            const { data, count } = await personnelService.fetchAll(
                this.currentPage,
                this.pageSize,
                this.searchQuery,
                this.statusFilter,
                this.dependencyId,
                this.buildingId
            );
            this.setPersonnel(data, count);
        } finally {
            this.isLoading = false;
        }
    }

    async nextPage() {
        if (this.currentPage * this.pageSize < this.totalRecords) {
            await this.refresh(this.currentPage + 1, this.searchQuery, this.statusFilter, this.dependencyId, this.buildingId);
        }
    }

    async prevPage() {
        if (this.currentPage > 1) {
            await this.refresh(this.currentPage - 1, this.searchQuery, this.statusFilter, this.dependencyId, this.buildingId);
        }
    }

    async goToPage(page: number) {
        await this.refresh(page, this.searchQuery, this.statusFilter, this.dependencyId, this.buildingId);
    }

    async search(query: string) {
        await this.refresh(1, query, this.statusFilter, this.dependencyId, this.buildingId);
    }

    async filter(status: string, depId: string, bldgId: string = "") {
        await this.refresh(1, this.searchQuery, status, depId, bldgId);
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
                    const index = this.personnel.findIndex(p => p.id === newData.id);
                    if (index !== -1) {
                        // Aplicar cambios optimistas para campos básicos
                        const current = this.personnel[index];
                        this.personnel[index] = {
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
                        this.currentPage === 1 ||
                        this.selectedPersonId === payload.new?.id ||
                        this.selectedPersonId === payload.old?.id;

                    if (isRelevant && !this.isLoading) {
                        this.refresh(this.currentPage, this.searchQuery, this.statusFilter, this.dependencyId, this.buildingId);
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
                const index = this.personnel.findIndex(p => p.id === id);
                if (index !== -1) {
                    this.personnel[index] = updated;
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
