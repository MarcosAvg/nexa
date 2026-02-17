import { HistoryService } from "../services/history";

export class HistoryState {
    historyLogs = $state<any[]>([]);
    isLoading = $state(false);
    currentPage = $state(1);
    pageSize = $state(50);
    totalRecords = $state(0);

    filters = $state({
        person: "",
        cardType: "Todos",
        folio: "",
        action: "Todas"
    });

    setHistory(data: any[], count: number) {
        this.historyLogs = data;
        this.totalRecords = count;
    }

    addLog(log: any) {
        // Optimistically add to top, but real source of truth is server
        this.historyLogs.unshift(log);
        this.totalRecords++;
    }

    async refresh(page: number = 1) {
        this.isLoading = true;
        this.currentPage = page;
        try {
            const { data, count } = await HistoryService.fetchAll(
                this.currentPage,
                this.pageSize,
                this.filters
            );
            this.setHistory(data, count);
        } finally {
            this.isLoading = false;
        }
    }

    async nextPage() {
        if (this.currentPage * this.pageSize < this.totalRecords) {
            await this.refresh(this.currentPage + 1);
        }
    }

    async prevPage() {
        if (this.currentPage > 1) {
            await this.refresh(this.currentPage - 1);
        }
    }

    async goToPage(page: number) {
        if (
            page >= 1 &&
            page <= Math.ceil(this.totalRecords / this.pageSize)
        ) {
            await this.refresh(page);
        }
    }
}

export const historyState = new HistoryState();
