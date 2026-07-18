/**
 * Versión simplificada para casos donde solo se necesita el handler
 * sin estado reactivo inline:
 *
 *   const debouncedSearch = createSimpleDebounce((value: string) => {
 *       refreshData(value);
 *   }, 300);
 *
 *   // En el template:
 *   <input oninput={(e) => debouncedSearch(e.target.value)} />
 */
export function createSimpleDebounce<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300,
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            callback(...args);
        }, delay);
    };
}


