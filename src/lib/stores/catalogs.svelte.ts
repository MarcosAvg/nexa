import type { CatalogItem } from "../types";

export class CatalogState {
    dependencies = $state<CatalogItem[]>([]);
    buildings = $state<CatalogItem[]>([]);
    specialAccesses = $state<CatalogItem[]>([]);
    schedules = $state<CatalogItem[]>([]);

    setDependencies(data: CatalogItem[]) {
        this.dependencies = data;
    }

    setBuildings(data: CatalogItem[]) {
        this.buildings = data;
    }

    setSpecialAccesses(data: CatalogItem[]) {
        this.specialAccesses = data;
    }

    setSchedules(data: CatalogItem[]) {
        this.schedules = data;
    }
}

export const catalogState = new CatalogState();
