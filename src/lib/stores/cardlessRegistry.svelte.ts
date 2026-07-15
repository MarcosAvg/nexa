import type { CardlessRegistry } from "../types";

export type CardlessRegistryFilters = {
    startDate: string;
    endDate: string;
    reason: string;
    search: string;
    dependencyId: string;
};

export class CardlessRegistryState {
    registries = $state<CardlessRegistry[]>([]);
    totalCount = $state(0);
    currentPage = $state(1);
    pageSize = $state(50);
    isLoading = $state(false);

    startDate = $state("");
    endDate = $state("");
    reasonFilter = $state("");
    searchFilter = $state("");
    dependencyIdFilter = $state("");

    setRegistries(data: CardlessRegistry[], count: number) {
        this.registries = data;
        this.totalCount = count;
    }

    setLoading(loading: boolean) {
        this.isLoading = loading;
    }

    setPage(page: number) {
        this.currentPage = page;
    }

    /** Returns true if filters changed (and page was reset). */
    setFilters(filters: Partial<CardlessRegistryFilters>): boolean {
        let changed = false;

        if (filters.startDate !== undefined && filters.startDate !== this.startDate) {
            this.startDate = filters.startDate;
            changed = true;
        }
        if (filters.endDate !== undefined && filters.endDate !== this.endDate) {
            this.endDate = filters.endDate;
            changed = true;
        }
        if (filters.reason !== undefined && filters.reason !== this.reasonFilter) {
            this.reasonFilter = filters.reason;
            changed = true;
        }
        if (filters.search !== undefined && filters.search !== this.searchFilter) {
            this.searchFilter = filters.search;
            changed = true;
        }
        if (filters.dependencyId !== undefined && filters.dependencyId !== this.dependencyIdFilter) {
            this.dependencyIdFilter = filters.dependencyId;
            changed = true;
        }

        if (changed) {
            this.currentPage = 1;
        }

        return changed;
    }

    get currentFilters(): CardlessRegistryFilters {
        return {
            startDate: this.startDate,
            endDate: this.endDate,
            reason: this.reasonFilter,
            search: this.searchFilter,
            dependencyId: this.dependencyIdFilter
        };
    }
}

export const cardlessRegistryState = new CardlessRegistryState();
