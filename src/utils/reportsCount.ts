/**
 * Reports Count Utility - Enhanced with Auto-refresh
 * Provides dynamic report count that auto-updates when data changes
 */

import { useState, useEffect } from 'react';
import { SUSTAINABILITY_REPORTS } from '../data/reportsData';

/**
 * Get the current count of sustainability reports
 * @returns The total number of reports in the database
 */
export function getReportsCount(): number {
    return SUSTAINABILITY_REPORTS.length;
}

/**
 * Get a formatted string of the reports count with "+" suffix
 * @returns Formatted report count string (e.g., "976+")
 */
export function getReportsCountFormatted(): string {
    return `${getReportsCount()}+`;
}

/**
 * React hook for accessing reports count with auto-refresh capability
 * This ensures components re-render if the reports data changes
 * 
 * @param options - Configuration options
 * @param options.autoRefresh - Enable auto-refresh polling (default: true)
 * @param options.refreshInterval - Interval in milliseconds for auto-refresh (default: 60000 = 1 minute)
 * @returns Object containing count and formatted count
 */
export function useReportsCount(options: {
    autoRefresh?: boolean;
    refreshInterval?: number;
} = {}) {
    const { autoRefresh = true, refreshInterval = 60000 } = options;

    const [count, setCount] = useState(getReportsCount());
    const [formatted, setFormatted] = useState(getReportsCountFormatted());

    useEffect(() => {
        // Function to refresh the count
        const refreshCount = () => {
            const newCount = getReportsCount();
            const newFormatted = getReportsCountFormatted();

            // Only update state if the count has actually changed
            if (newCount !== count) {
                setCount(newCount);
                setFormatted(newFormatted);
            }
        };

        // Set up auto-refresh interval if enabled
        if (autoRefresh) {
            const intervalId = setInterval(refreshCount, refreshInterval);

            // Cleanup interval on component unmount
            return () => clearInterval(intervalId);
        }
    }, [autoRefresh, refreshInterval, count]);

    return {
        count,
        formatted,
    };
}

/**
 * React hook for accessing reports count without auto-refresh
 * This is a lightweight alternative when auto-refresh is not needed
 * 
 * @returns Object containing count and formatted count
 */
export function useReportsCountStatic() {
    return {
        count: getReportsCount(),
        formatted: getReportsCountFormatted(),
    };
}
