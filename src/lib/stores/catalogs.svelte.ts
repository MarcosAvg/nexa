import type { CatalogItem } from "../types";

export class CatalogState {
    dependencies = $state<CatalogItem[]>([]);
    buildings = $state<CatalogItem[]>([]);
    specialAccesses = $state<CatalogItem[]>([]);
    schedules = $state<CatalogItem[]>([]);
    mediaTypes = $state<CatalogItem[]>([]);

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

    setMediaTypes(data: CatalogItem[]) {
        this.mediaTypes = data;
    }

    /** Nombres (distintos) de los medios de acceso activos, para desplegables/filtros. */
    activeMediaTypeNames(): string[] {
        const names = new Set<string>();
        for (const m of this.mediaTypes) {
            if ((m as any).active === false) continue;
            names.add(m.name);
        }
        return Array.from(names);
    }
}

export const catalogState = new CatalogState();
