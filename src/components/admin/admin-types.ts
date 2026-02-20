import type { UploadedReport } from '../../utils/uploadedReports';

/* ------------------------------------------------------------------ */
/*  Core domain types                                                  */
/* ------------------------------------------------------------------ */

export type DisclosureQualityBand = 'high' | 'medium' | 'low';
export type DQStatus = 'idle' | 'queued' | 'running' | 'cached' | 'computed' | 'error';

export type EntityStatus = 'unknown' | 'done' | 'none';

export type DQFilterValue = 'all' | 'scored' | 'unscored';
export type EntityFilterValue = 'all' | 'done' | 'none';

export interface DisclosureQualitySubscores {
  completeness: number;
  consistency: number;
  assurance: number;
  transparency: number;
}

export interface DisclosureQualityScore {
  version: number;
  generatedAt: string | null;
  report: {
    id: string;
    key: string;
    company: string;
    year: number | null;
  };
  score: number | null;
  band: DisclosureQualityBand | null;
  subscores: DisclosureQualitySubscores | null;
  featureCount?: number;
  featureTotal?: number;
  features?: Record<string, boolean>;
  featureDepth?: Record<string, { occurrences: number; pages: number }>;
  evidence?: Record<string, string[]>;
  evidenceQuotes?: Record<
    string,
    Array<{ text: string; page: number | null; heading: string | null }>
  >;
  recommendations?: string[];
  quantitativeProfile?: {
    percentageCount: number;
    tableRows: number;
    kpiNumbers: number;
    distinctYears: number;
    numericDensity: number;
  };
  method?: Record<string, unknown>;
  topicProfile?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Admin report wrapper                                               */
/* ------------------------------------------------------------------ */

export interface AdminReport extends UploadedReport {
  source: 'index' | 'uploaded' | 'merged';
  canDelete: boolean;
}

/* ------------------------------------------------------------------ */
/*  DQ entry per report                                                */
/* ------------------------------------------------------------------ */

export interface DQEntry {
  status: DQStatus;
  summary: DisclosureQualityScore | null;
  detail: DisclosureQualityScore | null;
  error: string | null;
  updatedAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export interface DQSettings {
  version: number;
  concurrency: number;
  limit: number;
  skipCached: boolean;
  forceRecompute: boolean;
}

/* ------------------------------------------------------------------ */
/*  Run tracking                                                       */
/* ------------------------------------------------------------------ */

export interface RunProgress {
  running: boolean;
  total: number;
  completed: number;
  queued: number;
  cachedHits: number;
  success: number;
  errors: number;
  cancelled: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  currentReportId: string | null;
}

export interface RunErrorRow {
  reportId: string;
  company: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Scored result row                                                   */
/* ------------------------------------------------------------------ */

export interface ScoredRow {
  report: AdminReport;
  summary: DisclosureQualityScore;
  detail: DisclosureQualityScore | null;
}

/* ------------------------------------------------------------------ */
/*  Diagnostics rows                                                   */
/* ------------------------------------------------------------------ */

export interface RegexDepthRow {
  key: string;
  label: string;
  found: boolean;
  occurrences: number;
  pages: number;
  quoteCount: number;
}

export interface ProvenanceRow {
  key: string;
  label: string;
  found: boolean;
  occurrences: number;
  pages: number;
  quotes: Array<{ text: string; page: number | null; heading: string | null }>;
  rawLines: string[];
}

/* ------------------------------------------------------------------ */
/*  Table sorting                                                      */
/* ------------------------------------------------------------------ */

export type SortField =
  | 'company'
  | 'year'
  | 'source'
  | 'status'
  | 'entity'
  | 'score'
  | 'created';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  dir: SortDir;
}

/* ------------------------------------------------------------------ */
/*  Tab identifiers                                                    */
/* ------------------------------------------------------------------ */

export type AdminTab = 'reports' | 'analytics' | 'diagnostics' | 'depth-analysis';

/* ------------------------------------------------------------------ */
/*  Depth analysis aggregation rows                                    */
/* ------------------------------------------------------------------ */

export interface SectorBenchmark {
  sector: string;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  avgSubscores: DisclosureQualitySubscores | null;
}

export interface YearTrend {
  year: number;
  count: number;
  avg: number;
  median: number;
  high: number;
  medium: number;
  low: number;
}

export interface FeatureCoverageRow {
  key: string;
  label: string;
  hitCount: number;
  hitRate: number; // 0-100
  avgOccurrences: number;
  avgPages: number;
}

export interface PerformerRow {
  report: AdminReport;
  score: number;
  band: DisclosureQualityBand | null;
  subscores: DisclosureQualitySubscores | null;
}

export interface CountryBucket {
  country: string;
  count: number;
  avg: number;
  median: number;
}

export interface SubscoreCorrelation {
  pair: [string, string];
  r: number; // Pearson correlation coefficient
}
