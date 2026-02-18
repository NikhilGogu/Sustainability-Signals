import { useEffect, useMemo, useState } from 'react';
import { SUSTAINABILITY_REPORTS } from '../data/reportsData';
import { fetchUploadedReports } from './uploadedReports';

const STATIC_REPORT_IDS = new Set(SUSTAINABILITY_REPORTS.map((r) => r.id));
const STATIC_REPORT_COUNT = STATIC_REPORT_IDS.size;

function formatCount(count: number): string {
  return `${count}+`;
}

function countWithUploaded(uploadedIds: string[]): number {
  const seen = new Set(STATIC_REPORT_IDS);
  for (const id of uploadedIds) seen.add(id);
  return seen.size;
}

async function fetchLiveReportsCount(): Promise<number> {
  try {
    const uploaded = await fetchUploadedReports();
    return countWithUploaded(uploaded.map((r) => r.id));
  } catch {
    // Graceful fallback when uploads endpoint is unavailable.
    return STATIC_REPORT_COUNT;
  }
}

/**
 * Returns a live report count = static index + uploaded reports (deduped by id).
 * This automatically reflects admin-side deletes because deleted uploads disappear
 * from `/api/reports/uploads`.
 */
export function useReportsCount(options: {
  autoRefresh?: boolean;
  refreshInterval?: number;
} = {}) {
  const { autoRefresh = true, refreshInterval = 60000 } = options;
  const [count, setCount] = useState<number>(STATIC_REPORT_COUNT);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const next = await fetchLiveReportsCount();
      if (!active) return;
      setCount((prev) => (prev === next ? prev : next));
    };

    void refresh();

    if (!autoRefresh) {
      return () => {
        active = false;
      };
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, Math.max(5000, refreshInterval));

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval]);

  const formatted = useMemo(() => formatCount(count), [count]);
  return { count, formatted };
}

/**
 * Lightweight static fallback (no network call).
 */
export function useReportsCountStatic() {
  return {
    count: STATIC_REPORT_COUNT,
    formatted: formatCount(STATIC_REPORT_COUNT),
  };
}

