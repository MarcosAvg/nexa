export class HistoryState {
    filteredHistoryLogs = $state<any[]>([]);

    setHistory(data: any[]) {
        this.filteredHistoryLogs = data;
    }

    addLog(log: any) {
        this.filteredHistoryLogs.unshift(log);
    }
}

export const historyState = new HistoryState();
