import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Seo } from '../components/seo';
import { Button, PageHero } from '../components/ui';
import { SUSTAINABILITY_REPORTS } from '../data/reportsData';
import type { SustainabilityReport } from '../types';
import {
  deleteUploadedReport,
  fetchUploadedReports,
  type UploadedReport,
} from '../utils/uploadedReports';

const ADMIN_KEY_STORAGE = 'ss_admin_api_key';
const DQ_SETTINGS_STORAGE = 'ss_admin_dq_settings';
const BATCH_ENDPOINT_LIMIT = 200;
const PROVENANCE_ROW_LIMIT = 24;
const REGEX_DEPTH_ROW_LIMIT = 80;

type DisclosureQualityBand = 'high' | 'medium' | 'low';
type DQStatus = 'idle' | 'queued' | 'running' | 'cached' | 'computed' | 'error';

interface DisclosureQualitySubscores {
  completeness: number;
  consistency: number;
  assurance: number;
  transparency: number;
}

interface DisclosureQualityScore {
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
  evidenceQuotes?: Record<string, Array<{ text: string; page: number | null; heading: string | null }>>;
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

interface AdminReport extends UploadedReport {
  source: 'index' | 'uploaded' | 'merged';
  canDelete: boolean;
}

interface DQEntry {
  status: DQStatus;
  summary: DisclosureQualityScore | null;
  detail: DisclosureQualityScore | null;
  error: string | null;
  updatedAt: string | null;
}

interface DQSettings {
  version: number;
  concurrency: number;
  limit: number;
  skipCached: boolean;
  forceRecompute: boolean;
}

interface RunProgress {
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

interface RunErrorRow {
  reportId: string;
  company: string;
  message: string;
}

interface ScoredRow {
  report: AdminReport;
  summary: DisclosureQualityScore;
  detail: DisclosureQualityScore | null;
}

interface RegexDepthRow {
  key: string;
  label: string;
  found: boolean;
  occurrences: number;
  pages: number;
  quoteCount: number;
}

interface ProvenanceRow {
  key: string;
  label: string;
  found: boolean;
  occurrences: number;
  pages: number;
  quotes: Array<{ text: string; page: number | null; heading: string | null }>;
  rawLines: string[];
}

const DEFAULT_SETTINGS: DQSettings = {
  version: 1,
  concurrency: 3,
  limit: 120,
  skipCached: true,
  forceRecompute: false,
};

const EMPTY_PROGRESS: RunProgress = {
  running: false,
  total: 0,
  completed: 0,
  queued: 0,
  cachedHits: 0,
  success: 0,
  errors: 0,
  cancelled: false,
  startedAt: null,
  finishedAt: null,
  currentReportId: null,
};

function toEpoch(value?: string | null): number {
  const ts = Date.parse(value ?? '');
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fmtDate(value?: string | null): string {
  if (!value) return '-';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '-';
  return new Date(ts).toLocaleString();
}

function asObj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function clampInt(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function bandFrom(value: unknown): DisclosureQualityBand | null {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

function featureLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractReportKeyFromUrl(reportUrl: string | null | undefined): string | null {
  if (typeof reportUrl !== 'string') return null;
  const trimmed = reportUrl.trim();
  if (!trimmed.startsWith('/r2/')) return null;
  const key = trimmed.slice('/r2/'.length).trim();
  return key || null;
}

function reportSearchBlob(report: AdminReport): string {
  return normalizeSearchText(
    [
      report.company,
      report.id,
      report.slug,
      report.reportKey,
      report.sector,
      report.country,
      String(report.publishedYear),
      report.source,
      report.uploadName ?? '',
    ].join(' ')
  );
}

function toAdminStaticReport(report: SustainabilityReport): AdminReport | null {
  const reportKey = extractReportKeyFromUrl(report.reportUrl);
  if (!reportKey) return null;

  return {
    ...report,
    reportUrl: report.reportUrl ?? `/r2/${reportKey}`,
    reportKey,
    createdAt: report.createdAt,
    uploadName: undefined,
    source: 'index',
    canDelete: false,
  };
}

const STATIC_ADMIN_REPORTS: AdminReport[] = SUSTAINABILITY_REPORTS.map(toAdminStaticReport).filter(
  (report): report is AdminReport => report !== null
);

function compareReports(a: AdminReport, b: AdminReport): number {
  const createdDiff = toEpoch(b.createdAt) - toEpoch(a.createdAt);
  if (createdDiff !== 0) return createdDiff;
  if (a.publishedYear !== b.publishedYear) return b.publishedYear - a.publishedYear;
  return a.company.localeCompare(b.company);
}

function mergeReports(uploadedReports: UploadedReport[]): AdminReport[] {
  const byId = new Map<string, AdminReport>();
  for (const report of STATIC_ADMIN_REPORTS) byId.set(report.id, report);

  for (const uploaded of uploadedReports) {
    const existing = byId.get(uploaded.id);
    if (existing) {
      byId.set(uploaded.id, {
        ...existing,
        ...uploaded,
        source: 'merged',
        canDelete: true,
      });
      continue;
    }

    byId.set(uploaded.id, {
      ...uploaded,
      source: 'uploaded',
      canDelete: true,
    });
  }

  return Array.from(byId.values()).sort(compareReports);
}

function toScore(payload: unknown, fallback: AdminReport): DisclosureQualityScore | null {
  const obj = asObj(payload);
  if (!obj) return null;

  const score = toNum(obj.score);
  const band = bandFrom(obj.band);

  const subObj = asObj(obj.subscores);
  const completeness = toNum(subObj?.completeness);
  const consistency = toNum(subObj?.consistency);
  const assurance = toNum(subObj?.assurance);
  const transparency = toNum(subObj?.transparency);

  const subscores =
    completeness === null || consistency === null || assurance === null || transparency === null
      ? null
      : { completeness, consistency, assurance, transparency };

  if (score === null && band === null && !subscores) return null;

  const reportObj = asObj(obj.report);
  const report = {
    id: typeof reportObj?.id === 'string' && reportObj.id.trim() ? reportObj.id : fallback.id,
    key:
      typeof reportObj?.key === 'string' && reportObj.key.trim() ? reportObj.key : fallback.reportKey,
    company:
      typeof reportObj?.company === 'string' && reportObj.company.trim()
        ? reportObj.company
        : fallback.company,
    year: toNum(reportObj?.year) ?? fallback.publishedYear,
  };

  const out: DisclosureQualityScore = {
    version: clampInt(toNum(obj.version) ?? 1, 1, 1, 10),
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : null,
    report,
    score,
    band,
    subscores,
  };

  const featureCount = toNum(obj.featureCount);
  const featureTotal = toNum(obj.featureTotal);
  if (featureCount !== null) out.featureCount = featureCount;
  if (featureTotal !== null) out.featureTotal = featureTotal;

  const featuresObj = asObj(obj.features);
  if (featuresObj) {
    const features: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(featuresObj)) features[key] = toBool(value);
    out.features = features;
  }

  const featureDepthObj = asObj(obj.featureDepth);
  if (featureDepthObj) {
    const featureDepth: Record<string, { occurrences: number; pages: number }> = {};
    for (const [key, value] of Object.entries(featureDepthObj)) {
      const item = asObj(value);
      if (!item) continue;
      const occurrences = toNum(item.occurrences);
      const pages = toNum(item.pages);
      if (occurrences === null || pages === null) continue;
      featureDepth[key] = { occurrences, pages };
    }
    if (Object.keys(featureDepth).length > 0) out.featureDepth = featureDepth;
  }

  const evidenceObj = asObj(obj.evidence);
  if (evidenceObj) {
    const evidence: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(evidenceObj)) {
      if (!Array.isArray(value)) continue;
      const lines = value
        .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
        .filter(Boolean);
      if (lines.length > 0) evidence[key] = lines;
    }
    if (Object.keys(evidence).length > 0) out.evidence = evidence;
  }

  const evidenceQuotesObj = asObj(obj.evidenceQuotes);
  if (evidenceQuotesObj) {
    const evidenceQuotes: Record<
      string,
      Array<{ text: string; page: number | null; heading: string | null }>
    > = {};
    for (const [key, value] of Object.entries(evidenceQuotesObj)) {
      if (!Array.isArray(value)) continue;
      const rows: Array<{ text: string; page: number | null; heading: string | null }> = [];
      for (const raw of value) {
        const item = asObj(raw);
        if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
        rows.push({
          text: item.text.trim(),
          page: toNum(item.page),
          heading: typeof item.heading === 'string' && item.heading.trim() ? item.heading.trim() : null,
        });
      }
      if (rows.length > 0) evidenceQuotes[key] = rows;
    }
    if (Object.keys(evidenceQuotes).length > 0) out.evidenceQuotes = evidenceQuotes;
  }

  if (Array.isArray(obj.recommendations)) {
    const recommendations = obj.recommendations
      .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter(Boolean);
    if (recommendations.length > 0) out.recommendations = recommendations;
  }

  const quantObj = asObj(obj.quantitativeProfile);
  const percentageCount = toNum(quantObj?.percentageCount);
  const tableRows = toNum(quantObj?.tableRows);
  const kpiNumbers = toNum(quantObj?.kpiNumbers);
  const distinctYears = toNum(quantObj?.distinctYears);
  const numericDensity = toNum(quantObj?.numericDensity);
  if (
    percentageCount !== null &&
    tableRows !== null &&
    kpiNumbers !== null &&
    distinctYears !== null &&
    numericDensity !== null
  ) {
    out.quantitativeProfile = {
      percentageCount,
      tableRows,
      kpiNumbers,
      distinctYears,
      numericDensity,
    };
  }

  const methodObj = asObj(obj.method);
  if (methodObj) out.method = methodObj;

  const topicObj = asObj(obj.topicProfile);
  if (topicObj) out.topicProfile = topicObj;

  return out;
}

function statusClass(status: DQStatus): string {
  if (status === 'computed') {
    return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800/50';
  }
  if (status === 'cached') {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/50';
  }
  if (status === 'running') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50';
  }
  if (status === 'queued') {
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60';
  }
  if (status === 'error') {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50';
  }
  return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/60';
}

function statusLabel(status: DQStatus): string {
  if (status === 'computed') return 'Computed';
  if (status === 'cached') return 'Cached';
  if (status === 'running') return 'Running';
  if (status === 'queued') return 'Queued';
  if (status === 'error') return 'Error';
  return 'Idle';
}

function bandClass(band: DisclosureQualityBand | null): string {
  if (band === 'high') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50';
  }
  if (band === 'medium') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50';
  }
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50';
}

function emptyEntry(): DQEntry {
  return { status: 'idle', summary: null, detail: null, error: null, updatedAt: null };
}

function splitChunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

async function parseHttpError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  const raw = await res.text().catch(() => '');
  if (!raw.trim()) return fallback;

  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // ignore json parse failures
  }

  return `${fallback}: ${raw.replace(/\s+/g, ' ').trim().slice(0, 240)}`;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const count = Math.max(1, Math.min(concurrency, items.length));

  async function runner() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: count }, () => runner()));
}

function hasNumericScore(score: DisclosureQualityScore | null | undefined): score is DisclosureQualityScore {
  return !!score && typeof score.score === 'number' && Number.isFinite(score.score);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return (part / whole) * 100;
}

function fmtCompact(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

export function Admin() {
  const [adminApiKey, setAdminApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  });

  const [dqSettings, setDqSettings] = useState<DQSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const raw = sessionStorage.getItem(DQ_SETTINGS_STORAGE);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<DQSettings>;
      const next: DQSettings = {
        version: clampInt(toNum(parsed.version) ?? DEFAULT_SETTINGS.version, DEFAULT_SETTINGS.version, 1, 10),
        concurrency: clampInt(
          toNum(parsed.concurrency) ?? DEFAULT_SETTINGS.concurrency,
          DEFAULT_SETTINGS.concurrency,
          1,
          12
        ),
        limit: clampInt(toNum(parsed.limit) ?? DEFAULT_SETTINGS.limit, DEFAULT_SETTINGS.limit, 1, 2000),
        skipCached:
          parsed.skipCached === undefined ? DEFAULT_SETTINGS.skipCached : Boolean(parsed.skipCached),
        forceRecompute:
          parsed.forceRecompute === undefined ? DEFAULT_SETTINGS.forceRecompute : Boolean(parsed.forceRecompute),
      };
      if (next.forceRecompute) next.skipCached = false;
      return next;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dqById, setDqById] = useState<Record<string, DQEntry>>({});
  const [run, setRun] = useState<RunProgress>(EMPTY_PROGRESS);
  const [runInfo, setRunInfo] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<RunErrorRow[]>([]);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);

  const runTokenRef = useRef(0);
  const controllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = adminApiKey.trim();
      if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      else sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      // ignore
    }
  }, [adminApiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(DQ_SETTINGS_STORAGE, JSON.stringify(dqSettings));
    } catch {
      // ignore
    }
  }, [dqSettings]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      runTokenRef.current += 1;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  const refreshReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    let uploaded: UploadedReport[] = [];
    let uploadError: string | null = null;

    try {
      uploaded = await fetchUploadedReports({ all: true, limit: 1000 });
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err);
    }

    const next = mergeReports(uploaded);
    setReports(next);

    const validIds = new Set(next.map((report) => report.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    setActiveDetailId((prev) => (prev && validIds.has(prev) ? prev : null));
    setDqById((prev) => {
      const out: Record<string, DQEntry> = {};
      for (const [id, entry] of Object.entries(prev)) {
        if (validIds.has(id)) out[id] = entry;
      }
      return out;
    });

    if (uploadError) {
      setLoadError(`Could not load uploaded reports (${uploadError}). Loaded index reports only.`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  const searchTokens = useMemo(() => {
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return [];
    return normalized.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const filtered = useMemo(() => {
    if (searchTokens.length === 0) return reports;
    return reports.filter((report) => {
      const haystack = reportSearchBlob(report);
      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [reports, searchTokens]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedReports = useMemo(
    () => reports.filter((report) => selectedSet.has(report.id)),
    [reports, selectedSet]
  );

  const allFilteredSelected = useMemo(
    () => filtered.length > 0 && filtered.every((report) => selectedSet.has(report.id)),
    [filtered, selectedSet]
  );

  const runScopeBase = selectedReports.length > 0 ? selectedReports : filtered;
  const runScope = useMemo(() => {
    const limit = clampInt(dqSettings.limit, DEFAULT_SETTINGS.limit, 1, 2000);
    return runScopeBase.slice(0, limit);
  }, [dqSettings.limit, runScopeBase]);

  const runScopeLabel = selectedReports.length > 0 ? 'selected reports' : 'filtered reports';
  const runPct = run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;

  const scoredRows = useMemo<ScoredRow[]>(() => {
    return runScope.flatMap((report) => {
      const entry = dqById[report.id];
      const summary = entry?.summary;
      if (!hasNumericScore(summary)) return [];
      return [{ report, summary, detail: entry?.detail ?? null }];
    });
  }, [dqById, runScope]);

  const missingDetailCount = useMemo(
    () => scoredRows.filter((row) => row.detail === null).length,
    [scoredRows]
  );

  const summaryStats = useMemo(() => {
    const coverage = Math.round(pct(scoredRows.length, runScope.length));
    if (scoredRows.length === 0) {
      return {
        coverage,
        avg: null as number | null,
        median: null as number | null,
        high: 0,
        medium: 0,
        low: 0,
        detailLoaded: 0,
        avgSubscores: null as DisclosureQualitySubscores | null,
      };
    }

    let high = 0;
    let medium = 0;
    let low = 0;

    const values: number[] = [];
    const subValues: Array<DisclosureQualitySubscores> = [];
    for (const row of scoredRows) {
      const score = row.summary.score ?? 0;
      values.push(score);

      if (row.summary.band === 'high') high += 1;
      else if (row.summary.band === 'medium') medium += 1;
      else low += 1;

      if (row.summary.subscores) subValues.push(row.summary.subscores);
    }

    const avgSubscores =
      subValues.length > 0
        ? {
            completeness: subValues.reduce((sum, item) => sum + item.completeness, 0) / subValues.length,
            consistency: subValues.reduce((sum, item) => sum + item.consistency, 0) / subValues.length,
            assurance: subValues.reduce((sum, item) => sum + item.assurance, 0) / subValues.length,
            transparency: subValues.reduce((sum, item) => sum + item.transparency, 0) / subValues.length,
          }
        : null;

    return {
      coverage,
      avg: avg(values),
      median: median(values),
      high,
      medium,
      low,
      detailLoaded: scoredRows.filter((row) => row.detail !== null).length,
      avgSubscores,
    };
  }, [runScope.length, scoredRows]);

  const activeReport = useMemo(
    () => reports.find((report) => report.id === activeDetailId) ?? null,
    [reports, activeDetailId]
  );

  const activeEntry = activeDetailId ? dqById[activeDetailId] ?? null : null;
  const activeSummary = activeEntry?.summary ?? null;
  const activeDetail = activeEntry?.detail ?? null;
  const activeMethod = useMemo(() => asObj(activeDetail?.method), [activeDetail]);

  const activeRegexDepthRows = useMemo<RegexDepthRow[]>(() => {
    if (!activeDetail) return [];

    const features = activeDetail.features ?? {};
    const depth = activeDetail.featureDepth ?? {};
    const quotes = activeDetail.evidenceQuotes ?? {};

    const keys = new Set<string>([
      ...Object.keys(features),
      ...Object.keys(depth),
      ...Object.keys(quotes),
    ]);

    const rows = Array.from(keys)
      .map((key) => {
        const d = depth[key];
        const quoteCount = Array.isArray(quotes[key]) ? quotes[key].length : 0;
        return {
          key,
          label: featureLabel(key),
          found: Boolean(features[key]),
          occurrences: d ? Math.max(0, Math.round(d.occurrences)) : 0,
          pages: d ? Math.max(0, Math.round(d.pages)) : 0,
          quoteCount,
        };
      })
      .filter((row) => row.found || row.occurrences > 0 || row.quoteCount > 0);

    rows.sort((a, b) => {
      if (a.found !== b.found) return a.found ? -1 : 1;
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
      if (a.pages !== b.pages) return b.pages - a.pages;
      if (a.quoteCount !== b.quoteCount) return b.quoteCount - a.quoteCount;
      return a.label.localeCompare(b.label);
    });

    return rows;
  }, [activeDetail]);

  const activeProvenanceRows = useMemo<ProvenanceRow[]>(() => {
    if (!activeDetail) return [];

    const features = activeDetail.features ?? {};
    const depth = activeDetail.featureDepth ?? {};
    const quotesByFeature = activeDetail.evidenceQuotes ?? {};
    const rawByFeature = activeDetail.evidence ?? {};

    const keys = new Set<string>([
      ...Object.keys(features).filter((key) => Boolean(features[key])),
      ...Object.keys(depth),
      ...Object.keys(quotesByFeature),
      ...Object.keys(rawByFeature),
    ]);

    const rows: ProvenanceRow[] = [];
    for (const key of keys) {
      const quoteRows = Array.isArray(quotesByFeature[key])
        ? quotesByFeature[key].filter((row) => typeof row.text === 'string' && row.text.trim())
        : [];
      const rawLines = Array.isArray(rawByFeature[key])
        ? rawByFeature[key]
            .map((line) => (typeof line === 'string' ? line.trim() : String(line).trim()))
            .filter(Boolean)
        : [];

      const depthRow = depth[key];
      const pageSet = new Set<number>();
      for (const quote of quoteRows) {
        if (typeof quote.page === 'number' && Number.isFinite(quote.page)) {
          pageSet.add(quote.page);
        }
      }

      const pages = depthRow ? Math.max(0, Math.round(depthRow.pages)) : pageSet.size;
      const occurrences = depthRow
        ? Math.max(0, Math.round(depthRow.occurrences))
        : Math.max(quoteRows.length, rawLines.length);

      if (quoteRows.length === 0 && rawLines.length === 0 && !features[key]) continue;

      rows.push({
        key,
        label: featureLabel(key),
        found: Boolean(features[key]),
        occurrences,
        pages,
        quotes: quoteRows.slice(0, 6),
        rawLines: rawLines.slice(0, 6),
      });
    }

    rows.sort((a, b) => {
      if (a.found !== b.found) return a.found ? -1 : 1;
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
      if (a.quotes.length !== b.quotes.length) return b.quotes.length - a.quotes.length;
      return a.label.localeCompare(b.label);
    });

    return rows;
  }, [activeDetail]);

  const stopRun = useCallback(() => {
    runTokenRef.current += 1;
    for (const controller of controllersRef.current) controller.abort();
    controllersRef.current.clear();

    setRun((prev) => ({
      ...prev,
      running: false,
      cancelled: true,
      finishedAt: new Date().toISOString(),
      currentReportId: null,
    }));
    setRunInfo('Batch run stopped.');
  }, []);

  const toggleSelectReport = useCallback((reportId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(reportId)) return prev.filter((id) => id !== reportId);
      return [...prev, reportId];
    });
  }, []);

  const toggleSelectFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const filteredSet = new Set(filtered.map((report) => report.id));
      const isAll = filtered.every((report) => prev.includes(report.id));
      if (isAll) return prev.filter((id) => !filteredSet.has(id));
      const next = new Set(prev);
      for (const report of filtered) next.add(report.id);
      return Array.from(next);
    });
  }, [filtered]);

  const clearResults = useCallback(() => {
    if (run.running) return;
    setDqById({});
    setRun(EMPTY_PROGRESS);
    setRunErrors([]);
    setRunInfo(null);
    setDetailError(null);
    setActiveDetailId(null);
  }, [run.running]);

  const runBatch = useCallback(async () => {
    const targets = runScope.filter((report) => report.reportKey && report.reportKey.trim());
    if (targets.length === 0) {
      setRunInfo('No reports in the current run scope.');
      return;
    }

    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    for (const controller of controllersRef.current) controller.abort();
    controllersRef.current.clear();

    setRunInfo(null);
    setRunErrors([]);
    setDetailError(null);

    setRun({
      running: true,
      total: targets.length,
      completed: 0,
      queued: targets.length,
      cachedHits: 0,
      success: 0,
      errors: 0,
      cancelled: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentReportId: null,
    });

    setDqById((prev) => {
      const next = { ...prev };
      for (const report of targets) {
        const row = next[report.id] ?? emptyEntry();
        next[report.id] = {
          ...row,
          status: 'queued',
          error: null,
          updatedAt: new Date().toISOString(),
        };
      }
      return next;
    });

    let completed = 0;
    let cachedHits = 0;
    let success = 0;
    let errors = 0;
    let queue = targets;

    try {
      if (dqSettings.skipCached && !dqSettings.forceRecompute) {
        const reportById = new Map(targets.map((report) => [report.id, report]));
        const cachedIds = new Set<string>();
        const cachedScores: Record<string, DisclosureQualityScore> = {};

        for (const chunk of splitChunks(
          targets.map((report) => report.id),
          BATCH_ENDPOINT_LIMIT
        )) {
          if (token !== runTokenRef.current) return;

          const controller = new AbortController();
          controllersRef.current.add(controller);

          let results: Record<string, unknown> = {};
          try {
            const res = await fetch('/score/disclosure-quality-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reportIds: chunk,
                version: dqSettings.version,
                summaryOnly: true,
              }),
              signal: controller.signal,
            });
            if (!res.ok) throw new Error(await parseHttpError(res));
            const payload = (await res.json()) as { results?: unknown };
            results = asObj(payload.results) ?? {};
          } finally {
            controllersRef.current.delete(controller);
          }

          for (const reportId of chunk) {
            const report = reportById.get(reportId);
            if (!report) continue;
            const score = toScore(results[reportId], report);
            if (!score) continue;
            cachedIds.add(reportId);
            cachedScores[reportId] = score;
          }
        }

        if (token !== runTokenRef.current) return;

        queue = targets.filter((report) => !cachedIds.has(report.id));
        cachedHits = cachedIds.size;
        completed = cachedHits;

        setDqById((prev) => {
          const next = { ...prev };
          for (const [id, score] of Object.entries(cachedScores)) {
            const row = next[id] ?? emptyEntry();
            next[id] = {
              ...row,
              status: 'cached',
              summary: score,
              error: null,
              updatedAt: new Date().toISOString(),
            };
          }
          return next;
        });

        setRun((prev) => ({ ...prev, completed, cachedHits, queued: queue.length }));
      }

      if (token !== runTokenRef.current) return;

      const concurrency = clampInt(
        dqSettings.concurrency,
        DEFAULT_SETTINGS.concurrency,
        1,
        12
      );

      await runPool(queue, concurrency, async (report) => {
        if (token !== runTokenRef.current) return;

        setRun((prev) => ({ ...prev, currentReportId: report.id }));
        setDqById((prev) => {
          const row = prev[report.id] ?? emptyEntry();
          return {
            ...prev,
            [report.id]: {
              ...row,
              status: 'running',
              error: null,
              updatedAt: new Date().toISOString(),
            },
          };
        });

        const controller = new AbortController();
        controllersRef.current.add(controller);

        try {
          const res = await fetch('/score/disclosure-quality', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta: {
                reportId: report.id,
                reportKey: report.reportKey,
                company: report.company,
                publishedYear: report.publishedYear,
              },
              options: {
                version: dqSettings.version,
                force: dqSettings.forceRecompute,
                store: true,
              },
            }),
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(await parseHttpError(res));

          const payload = (await res.json()) as unknown;
          const score = toScore(payload, report);
          if (!score) throw new Error(`Invalid score payload for ${report.id}`);

          success += 1;
          completed += 1;

          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return {
              ...prev,
              [report.id]: {
                ...row,
                status: 'computed',
                summary: score,
                detail: score,
                error: null,
                updatedAt: new Date().toISOString(),
              },
            };
          });
        } catch (err) {
          if (controller.signal.aborted || token !== runTokenRef.current) return;

          errors += 1;
          completed += 1;

          const message = err instanceof Error ? err.message : String(err);
          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return {
              ...prev,
              [report.id]: {
                ...row,
                status: 'error',
                error: message,
                updatedAt: new Date().toISOString(),
              },
            };
          });
          setRunErrors((prev) =>
            [...prev, { reportId: report.id, company: report.company, message }].slice(-40)
          );
        } finally {
          controllersRef.current.delete(controller);
          if (token === runTokenRef.current) {
            setRun((prev) => ({
              ...prev,
              completed,
              cachedHits,
              success,
              errors,
            }));
          }
        }
      });

      if (token !== runTokenRef.current) return;

      setRun((prev) => ({
        ...prev,
        running: false,
        finishedAt: new Date().toISOString(),
        currentReportId: null,
      }));

      if (errors > 0) setRunInfo(`Batch run finished with ${errors} error(s).`);
      else if (cachedHits > 0 && success === 0) setRunInfo('All reports already had cached scores.');
      else setRunInfo('Batch run finished successfully.');
    } catch (err) {
      if (token !== runTokenRef.current) return;
      setRun((prev) => ({
        ...prev,
        running: false,
        finishedAt: new Date().toISOString(),
        currentReportId: null,
      }));
      setRunInfo(err instanceof Error ? err.message : String(err));
    }
  }, [dqSettings, runScope]);

  const loadDetail = useCallback(
    async (report: AdminReport) => {
      setActiveDetailId(report.id);
      setDetailError(null);

      const cached = dqById[report.id]?.detail;
      if (cached) return;

      setDetailLoadingId(report.id);
      const controller = new AbortController();
      controllersRef.current.add(controller);

      try {
        const url = `/score/disclosure-quality?reportId=${encodeURIComponent(report.id)}&version=${dqSettings.version}&refine=1&_ts=${Date.now()}`;
        const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(await parseHttpError(res));

        const payload = (await res.json()) as unknown;
        const score = toScore(payload, report);
        if (!score) throw new Error(`Detailed score is unavailable for ${report.id}`);

        setDqById((prev) => {
          const row = prev[report.id] ?? emptyEntry();
          return {
            ...prev,
            [report.id]: {
              ...row,
              status: row.status === 'error' ? 'computed' : row.status,
              summary: score,
              detail: score,
              error: null,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          setDetailError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        controllersRef.current.delete(controller);
        setDetailLoadingId((prev) => (prev === report.id ? null : prev));
      }
    },
    [dqById, dqSettings.version]
  );

  const onDelete = useCallback(
    async (report: AdminReport) => {
      if (!report.canDelete) {
        setDeleteError('Only uploaded reports can be deleted from Admin.');
        return;
      }

      const key = adminApiKey.trim();
      if (!key) {
        setDeleteError('Enter a valid admin API key first.');
        return;
      }

      const shouldDelete = window.confirm(
        `Delete "${report.company} (${report.publishedYear})"? This removes uploaded PDF and cached artifacts.`
      );
      if (!shouldDelete) return;

      setBusyDeleteId(report.id);
      setDeleteError(null);
      setDeleteInfo(null);

      try {
        const result = await deleteUploadedReport({ reportId: report.id, apiKey: key });

        setSelectedIds((prev) => prev.filter((id) => id !== report.id));
        setDqById((prev) => {
          const next = { ...prev };
          delete next[report.id];
          return next;
        });
        setActiveDetailId((prev) => (prev === report.id ? null : prev));
        setDeleteInfo(
          `Deleted ${report.company} (${report.publishedYear}) - removed ${result.deletedCount} objects.`
        );
        await refreshReports();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyDeleteId(null);
      }
    },
    [adminApiKey, refreshReports]
  );

  const visibleRegexDepthRows = activeRegexDepthRows.slice(0, REGEX_DEPTH_ROW_LIMIT);
  const visibleProvenanceRows = activeProvenanceRows.slice(0, PROVENANCE_ROW_LIMIT);

  return (
    <>
      <Seo
        title="Admin DQ Lineage Console | Sustainability Signals"
        description="Admin console for report loading, batch DQ scoring, regex-depth diagnostics, and evidence-line provenance."
        path="https://admin.sustainabilitysignals.com/"
        noindex
      />

      <PageHero
        label="Admin Console"
        tone="signal"
        title={
          <>
            DQ Lineage <span className="gradient-text">Workbench</span>
          </>
        }
        description="Load the full report universe, run DQ at scale, and inspect regex depth and evidence-line provenance for every feature."
      />

      <section className="cv-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="glass-panel-strong rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/30">
            <div className="grid xl:grid-cols-[1.2fr_1fr_auto] gap-4 items-end">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Admin API Key
                <input
                  type="password"
                  value={adminApiKey}
                  onChange={(event) => setAdminApiKey(event.target.value)}
                  placeholder="Paste API key"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Search
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Company, report ID, key, country, sector, year..."
                  className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
                />
                <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {loading
                    ? 'Loading reports...'
                    : searchTokens.length > 0
                      ? `Showing ${filtered.length} of ${reports.length} reports`
                      : `${reports.length} reports loaded (index + uploads)`}
                </div>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void refreshReports()} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  disabled={loading || !searchQuery.trim()}
                >
                  Clear Search
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdminApiKey('')}
                  disabled={loading || !adminApiKey.trim()}
                >
                  Clear Key
                </Button>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60">
            <div className="grid xl:grid-cols-[auto_auto_auto_auto_auto_1fr] gap-3 items-end">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Version
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={dqSettings.version}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setDqSettings((prev) => ({ ...prev, version: clampInt(parsed, prev.version, 1, 10) }));
                  }}
                  className="mt-1.5 w-24 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Concurrency
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={dqSettings.concurrency}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setDqSettings((prev) => ({
                      ...prev,
                      concurrency: clampInt(parsed, prev.concurrency, 1, 12),
                    }));
                  }}
                  className="mt-1.5 w-28 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </label>

              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Max Reports
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={dqSettings.limit}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setDqSettings((prev) => ({ ...prev, limit: clampInt(parsed, prev.limit, 1, 2000) }));
                  }}
                  className="mt-1.5 w-28 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2.5">
                <input
                  type="checkbox"
                  checked={dqSettings.skipCached}
                  disabled={dqSettings.forceRecompute}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDqSettings((prev) => ({
                      ...prev,
                      skipCached: prev.forceRecompute ? false : checked,
                    }));
                  }}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                Skip cached hits
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2.5">
                <input
                  type="checkbox"
                  checked={dqSettings.forceRecompute}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDqSettings((prev) => ({
                      ...prev,
                      forceRecompute: checked,
                      skipCached: checked ? false : prev.skipCached,
                    }));
                  }}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                Force recompute
              </label>

              <div className="flex items-center justify-start xl:justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => void runBatch()} disabled={run.running || runScope.length === 0}>
                  {run.running ? 'Running...' : 'Run DQ Batch'}
                </Button>
                <Button variant="ghost" size="sm" onClick={stopRun} disabled={!run.running}>
                  Stop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearResults}
                  disabled={run.running || Object.keys(dqById).length === 0}
                >
                  Clear Results
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span>
                Scope: <span className="font-semibold">{runScope.length}</span> {runScopeLabel}
              </span>
              <span className="text-gray-400 dark:text-gray-500">|</span>
              <span>
                Selected: <span className="font-semibold">{selectedIds.length}</span>
              </span>
              <span className="text-gray-400 dark:text-gray-500">|</span>
              <span>
                Missing deep detail: <span className="font-semibold">{missingDetailCount}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={toggleSelectFiltered}>
                {allFilteredSelected ? 'Unselect Filtered' : 'Select Filtered'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0}
              >
                Clear Selection
              </Button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
                <span>
                  Progress: {run.completed}/{run.total} ({runPct}%)
                </span>
                <span>
                  cached {run.cachedHits} | computed {run.success} | errors {run.errors}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${runPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                {run.startedAt && <span>Started: {fmtDate(run.startedAt)}</span>}
                {run.finishedAt && <span>Finished: {fmtDate(run.finishedAt)}</span>}
                {run.currentReportId && <span>Current: {run.currentReportId}</span>}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/30 dark:bg-gray-900/20">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Coverage</p>
                <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                  {summaryStats.coverage}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {scoredRows.length} scored of {runScope.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Avg / Median DQ
                </p>
                <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                  {fmtCompact(summaryStats.avg, 0)} / {fmtCompact(summaryStats.median, 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Detail loaded: {summaryStats.detailLoaded}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Band Distribution</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-md border px-2 py-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50">
                    High {summaryStats.high}
                  </span>
                  <span className="rounded-md border px-2 py-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50">
                    Medium {summaryStats.medium}
                  </span>
                  <span className="rounded-md border px-2 py-1 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50">
                    Low {summaryStats.low}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg Subscores</p>
                {summaryStats.avgSubscores ? (
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>Completeness</span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(summaryStats.avgSubscores.completeness)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consistency</span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(summaryStats.avgSubscores.consistency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assurance</span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(summaryStats.avgSubscores.assurance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transparency</span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(summaryStats.avgSubscores.transparency)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No subscore data yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loadError && (
              <div className="mb-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 rounded-lg p-3">
                {loadError}
              </div>
            )}
            {runInfo && (
              <div className="mb-3 text-xs text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border border-sky-200/70 dark:border-sky-800/40 rounded-lg p-3">
                {runInfo}
              </div>
            )}
            {deleteError && (
              <div className="mb-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                {deleteError}
              </div>
            )}
            {deleteInfo && (
              <div className="mb-3 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-lg p-3">
                {deleteInfo}
              </div>
            )}
            {runErrors.length > 0 && (
              <div className="mb-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                <p className="font-semibold mb-1">Recent batch errors ({runErrors.length})</p>
                <div className="space-y-1">
                  {runErrors.slice(-6).map((row) => (
                    <p key={`${row.reportId}:${row.message}`}>
                      {row.company} ({row.reportId}): {row.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800/60">
                    <th className="text-left px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectFiltered}
                        className="rounded border-gray-300 dark:border-gray-700"
                        aria-label="Select filtered reports"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      Company
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      Report
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      DQ Status
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      Score
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {filtered.map((report) => {
                    const entry = dqById[report.id];
                    const summary = entry?.summary ?? null;
                    const score = summary && typeof summary.score === 'number' ? Math.round(summary.score) : null;
                    const subscores = summary?.subscores;
                    const active = activeDetailId === report.id;

                    return (
                      <tr
                        key={report.id}
                        className={`align-top ${active ? 'bg-sky-50/40 dark:bg-sky-900/10' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(report.id)}
                            onChange={() => toggleSelectReport(report.id)}
                            className="rounded border-gray-300 dark:border-gray-700"
                            aria-label={`Select ${report.company}`}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{report.company}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {report.country} | {report.sector} | {report.publishedYear}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400">ID: {report.id}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">{report.reportKey}</div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                            Uploaded: {fmtDate(report.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
                              report.source === 'merged'
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800/50'
                                : report.source === 'uploaded'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/50'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60'
                            }`}
                          >
                            {report.source === 'merged'
                              ? 'Index + Upload'
                              : report.source === 'uploaded'
                                ? 'Upload'
                                : 'Index'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(
                              entry?.status ?? 'idle'
                            )}`}
                          >
                            {statusLabel(entry?.status ?? 'idle')}
                          </span>
                          {entry?.updatedAt && (
                            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                              {fmtDate(entry.updatedAt)}
                            </div>
                          )}
                          {entry?.error && (
                            <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 max-w-[260px] break-words">
                              {entry.error}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {score !== null ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
                                  {score}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${bandClass(
                                    summary?.band ?? null
                                  )}`}
                                >
                                  {summary?.band ?? 'low'}
                                </span>
                              </div>
                              {subscores && (
                                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  C {Math.round(subscores.completeness)} | K {Math.round(subscores.consistency)} | A{' '}
                                  {Math.round(subscores.assurance)} | T {Math.round(subscores.transparency)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 dark:text-gray-500">No score</div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={detailLoadingId === report.id}
                              onClick={() => void loadDetail(report)}
                            >
                              {detailLoadingId === report.id
                                ? 'Loading...'
                                : entry?.detail
                                  ? 'View Detail'
                                  : 'Load Detail'}
                            </Button>

                            {report.canDelete ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyDeleteId === report.id}
                                onClick={() => void onDelete(report)}
                                className="text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                              >
                                {busyDeleteId === report.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            ) : (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 py-1.5">
                                Index-only
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length === 0 && (
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                No reports match the current search.
              </div>
            )}

            <div className="mt-6 rounded-xl border border-gray-100 dark:border-gray-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/60 dark:bg-gray-900/40">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Deep DQ Diagnostics</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Feature-by-feature regex depth and line provenance for the active report.
                </p>
              </div>

              <div className="p-4">
                {!activeReport && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Select a report and click Load Detail.
                  </div>
                )}

                {activeReport && (
                  <div className="space-y-4">
                    {detailError && (
                      <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                        {detailError}
                      </div>
                    )}

                    {activeSummary ? (
                      <>
                        <div className="grid lg:grid-cols-[auto_1fr] gap-4 items-start">
                          <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4 min-w-[220px]">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">DQ Score</p>
                            <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                              {activeSummary.score !== null ? Math.round(activeSummary.score) : '-'}
                            </p>
                            <span
                              className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${bandClass(
                                activeSummary.band
                              )}`}
                            >
                              {activeSummary.band ?? 'unclassified'}
                            </span>
                            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                              Updated: {fmtDate(activeSummary.generatedAt)}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              Report: {activeReport.id}
                            </p>
                          </div>

                          <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">Subscores</p>
                            {activeSummary.subscores ? (
                              <div className="grid sm:grid-cols-2 gap-3">
                                {[
                                  {
                                    label: 'Completeness',
                                    value: activeSummary.subscores.completeness,
                                    bar: 'from-emerald-500 to-teal-500',
                                  },
                                  {
                                    label: 'Consistency',
                                    value: activeSummary.subscores.consistency,
                                    bar: 'from-sky-500 to-blue-500',
                                  },
                                  {
                                    label: 'Assurance',
                                    value: activeSummary.subscores.assurance,
                                    bar: 'from-amber-500 to-orange-500',
                                  },
                                  {
                                    label: 'Transparency',
                                    value: activeSummary.subscores.transparency,
                                    bar: 'from-violet-500 to-indigo-500',
                                  },
                                ].map((item) => (
                                  <div key={item.label}>
                                    <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                                      <span>{item.label}</span>
                                      <span className="font-semibold tabular-nums">
                                        {Math.round(item.value)}
                                      </span>
                                    </div>
                                    <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                      <div
                                        className={`h-full bg-gradient-to-r ${item.bar}`}
                                        style={{
                                          width: `${Math.max(0, Math.min(100, Math.round(item.value)))}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Subscores are not available.
                              </p>
                            )}
                          </div>
                        </div>

                        {activeDetail && (
                          <>
                            <div className="grid lg:grid-cols-2 gap-4">
                              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                  Method and Processing Overview
                                </h4>
                                <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Method kind</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                      {typeof activeMethod?.kind === 'string' ? activeMethod.kind : 'unknown'}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Blocks analyzed</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {fmtCompact(toNum(activeMethod?.blocks), 0)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Pages detected</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {fmtCompact(toNum(activeMethod?.pagesDetected), 0)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Corpus chars</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {fmtCompact(toNum(activeMethod?.corpusChars), 0)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Feature coverage</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {activeDetail.featureCount ?? '-'} / {activeDetail.featureTotal ?? '-'}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Evidence refined by AI</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                      {fmtCompact(toNum(activeMethod?.evidenceRefinedByAI), 0)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Corpus sampled</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                      {toBool(activeMethod?.corpusSampled) ? 'yes' : 'no'}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                    <p className="text-gray-500 dark:text-gray-400">Text provided</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                      {toBool(activeMethod?.textProvided) ? 'yes' : 'no'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                  Quantitative Profile
                                </h4>
                                {activeDetail.quantitativeProfile ? (
                                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">Numeric density</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {fmtCompact(activeDetail.quantitativeProfile.numericDensity, 2)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">Percentages</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {fmtCompact(activeDetail.quantitativeProfile.percentageCount, 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">Table rows</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {fmtCompact(activeDetail.quantitativeProfile.tableRows, 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">KPI numbers</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {fmtCompact(activeDetail.quantitativeProfile.kpiNumbers, 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">Distinct years</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {fmtCompact(activeDetail.quantitativeProfile.distinctYears, 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5">
                                      <p className="text-gray-500 dark:text-gray-400">Evidence families</p>
                                      <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                        {Object.keys(activeDetail.evidenceQuotes ?? {}).length}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Quantitative profile data is not available.
                                  </p>
                                )}

                                {activeDetail.topicProfile && (
                                  <div className="mt-3 rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5 text-xs text-gray-600 dark:text-gray-300">
                                    <p className="text-gray-500 dark:text-gray-400">Topic profile model</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                      {typeof activeDetail.topicProfile.model === 'string'
                                        ? activeDetail.topicProfile.model
                                        : 'n/a'}
                                    </p>
                                    <p className="mt-1">
                                      ESG relevant blocks:{' '}
                                      <span className="font-semibold tabular-nums">
                                        {fmtCompact(toNum(activeDetail.topicProfile.esg_relevant_blocks), 0)}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                Regex Depth Overview
                              </h4>
                              {activeRegexDepthRows.length > 0 ? (
                                <>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[720px]">
                                      <thead>
                                        <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/70">
                                          <th className="text-left py-2 pr-2">Feature</th>
                                          <th className="text-right py-2 px-2">Found</th>
                                          <th className="text-right py-2 px-2">Occurrences</th>
                                          <th className="text-right py-2 px-2">Pages</th>
                                          <th className="text-right py-2 pl-2">Evidence lines</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
                                        {visibleRegexDepthRows.map((row) => (
                                          <tr key={row.key} className="text-gray-700 dark:text-gray-200">
                                            <td className="py-1.5 pr-2">{row.label}</td>
                                            <td className="py-1.5 px-2 text-right">
                                              <span
                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                                  row.found
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60'
                                                }`}
                                              >
                                                {row.found ? 'yes' : 'no'}
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-2 text-right tabular-nums">{row.occurrences}</td>
                                            <td className="py-1.5 px-2 text-right tabular-nums">{row.pages}</td>
                                            <td className="py-1.5 pl-2 text-right tabular-nums">{row.quoteCount}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {activeRegexDepthRows.length > visibleRegexDepthRows.length && (
                                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                      Showing top {visibleRegexDepthRows.length} of {activeRegexDepthRows.length} feature rows.
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  No regex depth data available for this report.
                                </p>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                Evidence Line Provenance
                              </h4>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                Each block below shows the detected feature, regex depth, and the exact evidence lines used in scoring.
                              </p>

                              {activeProvenanceRows.length > 0 ? (
                                <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                                  {visibleProvenanceRows.map((row) => (
                                    <div
                                      key={row.key}
                                      className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2 justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                            {row.label}
                                          </span>
                                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                            ({row.key})
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                          <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300">
                                            found: {row.found ? 'yes' : 'no'}
                                          </span>
                                          <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300 tabular-nums">
                                            occurrences: {row.occurrences}
                                          </span>
                                          <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300 tabular-nums">
                                            pages: {row.pages}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-2 space-y-2">
                                        {row.quotes.length > 0 ? (
                                          row.quotes.map((quote, index) => (
                                            <div
                                              key={`${row.key}:quote:${index}`}
                                              className="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-2.5 py-2"
                                            >
                                              <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                                <span className="font-semibold text-gray-600 dark:text-gray-300">
                                                  Line {index + 1}
                                                </span>
                                                <span>page {quote.page ?? '-'}</span>
                                                <span>heading {quote.heading ?? '-'}</span>
                                              </div>
                                              <p className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                                                {quote.text}
                                              </p>
                                            </div>
                                          ))
                                        ) : row.rawLines.length > 0 ? (
                                          row.rawLines.map((line, index) => (
                                            <div
                                              key={`${row.key}:raw:${index}`}
                                              className="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-2.5 py-2"
                                            >
                                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Raw line {index + 1}
                                              </div>
                                              <p className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                                                {line}
                                              </p>
                                            </div>
                                          ))
                                        ) : (
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            No evidence lines were returned for this feature.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  No evidence-line provenance is available yet. Load detail after a DQ run.
                                </p>
                              )}

                              {activeProvenanceRows.length > visibleProvenanceRows.length && (
                                <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                  Showing top {visibleProvenanceRows.length} of {activeProvenanceRows.length} provenance groups.
                                </p>
                              )}
                            </div>

                            {activeDetail.recommendations && activeDetail.recommendations.length > 0 && (
                              <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-4">
                                <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                                  Improvement Recommendations
                                </h4>
                                <div className="space-y-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                                  {activeDetail.recommendations.map((recommendation) => (
                                    <p key={recommendation}>- {recommendation}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3 text-xs text-gray-500 dark:text-gray-400">
                        No DQ summary yet for this report. Include it in a batch run.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
