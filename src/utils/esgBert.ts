export type EsgPillar = 'E' | 'S' | 'G';

export type EsgBertIssue = {
  issue: string;
  score: number;
  pillar: EsgPillar | null;
};

export type EsgBertReportSummary = {
  reportKey: string;
  pillar_share: Record<EsgPillar, number>;
  top_issues: EsgBertIssue[];
};

type EsgBertDataset = {
  version: number;
  generatedAt: string;
  count: number;
  byReportId: Record<string, EsgBertReportSummary>;
};

let datasetPromise: Promise<EsgBertDataset | null> | null = null;

async function loadDataset(): Promise<EsgBertDataset | null> {
  if (datasetPromise) return datasetPromise;
  datasetPromise = (async () => {
    try {
      const res = await fetch('/data/esgbert_report_summary.v1.json', { cache: 'force-cache' });
      if (!res.ok) return null;
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') return null;
      return data as EsgBertDataset;
    } catch {
      return null;
    }
  })();
  return datasetPromise;
}

export async function getEsgBertSummary(reportId: string): Promise<EsgBertReportSummary | null> {
  const rid = String(reportId || '').trim();
  if (!rid) return null;
  const ds = await loadDataset();
  const by = ds?.byReportId && typeof ds.byReportId === 'object' ? ds.byReportId : null;
  if (!by) return null;
  return by[rid] || null;
}

