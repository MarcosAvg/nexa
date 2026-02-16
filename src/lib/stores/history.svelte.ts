import { HistoryService } from "../services/history";

export class HistoryState {
    filteredHistoryLogs = $state<any[]>([]);
    isLoading = $state(false);

    setHistory(data: any[]) {
        this.filteredHistoryLogs = data;
    }

    addLog(log: any) {
        this.filteredHistoryLogs.unshift(log);
    }

    async refresh() {
        this.isLoading = true;
        try {
            const data = await HistoryService.fetchAll();
            this.setHistory(data);
        } finally {
            this.isLoading = false;
        }
    }
}

export const historyState = new HistoryState();
