import { SUSTAINABILITY_REPORTS } from '../../data/reportsData';
import type { SustainabilityReport } from '../../types';
import type { UploadedReport } from '../../utils/uploadedReports';
import type {
  AdminReport,
  DQEntry,
  DQSettings,
  DisclosureQualityBand,
  DisclosureQualityScore,
  DisclosureQualitySubscores,
  EntityStatus,
  ProvenanceRow,
  RegexDepthRow,
  SortField,
  SortDir,
} from './admin-types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const ADMIN_KEY_STORAGE = 'ss_admin_api_key';
export const DQ_SETTINGS_STORAGE = 'ss_admin_dq_settings';
export const BATCH_ENDPOINT_LIMIT = 200;

export const DEFAULT_SETTINGS: DQSettings = {
  version: 1,
  concurrency: 3,
  limit: 120,
  skipCached: true,
  forceRecompute: false,
};

export const EMPTY_PROGRESS = {
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
} as const;

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

/* ------------------------------------------------------------------ */
/*  Primitive helpers                                                  */
/* ------------------------------------------------------------------ */

export function toEpoch(value?: string | null): number {
  const ts = Date.parse(value ?? '');
  return Number.isFinite(ts) ? ts : 0;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function fmtDate(value?: string | null, source?: 'index' | 'uploaded' | 'merged'): string {
  // Only show date/time for uploads with a real timestamp
  if (!value) return '';
  if (source === 'index') return '';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  return new Date(ts).toLocaleString();
}

export function asObj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function clampInt(
  value: number,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function bandFrom(value: unknown): DisclosureQualityBand | null {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

export function featureLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function fmtCompact(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

/* ------------------------------------------------------------------ */
/*  Statistics helpers                                                 */
/* ------------------------------------------------------------------ */

export function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return (part / whole) * 100;
}

export function hasNumericScore(
  score: DisclosureQualityScore | null | undefined,
): score is DisclosureQualityScore {
  return !!score && typeof score.score === 'number' && Number.isFinite(score.score);
}

/* ------------------------------------------------------------------ */
/*  Concurrency pool                                                   */
/* ------------------------------------------------------------------ */

export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
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

export function splitChunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function parseHttpError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  const raw = await res.text().catch(() => '');
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown; code?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      const code = typeof parsed.code === 'string' ? ` [${parsed.code}]` : '';
      return `${parsed.error.trim()}${code}`;
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // Not JSON — check if it's an HTML error page (e.g., Cloudflare 500/502/503)
    if (raw.trimStart().startsWith('<!') || raw.trimStart().startsWith('<html')) {
      const titleMatch = raw.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch?.[1]?.trim();
      if (title) return `${fallback} (${title})`;
      return `${fallback} (server returned HTML error page)`;
    }
  }
  // Plain text fallback — truncate safely
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned.length > 160 ? `${fallback}: ${cleaned.slice(0, 160)}...` : `${fallback}: ${cleaned}`;
}

/* ------------------------------------------------------------------ */
/*  Retry / timeout helpers                                            */
/* ------------------------------------------------------------------ */

/** Status codes that are safe to retry (transient failures). */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/** Status codes where retry is likely futile (the same report will fail again). */
const NON_RETRYABLE_SERVER = new Set([500, 413]);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOpts {
  /** Maximum number of attempts (default 3). */
  retries?: number;
  /** Base delay in ms for exponential backoff (default 2000). */
  baseDelayMs?: number;
  /** Per-request timeout in ms (default 120000 = 2 min). */
  timeoutMs?: number;
  /** Optional external AbortSignal to respect cancellation. */
  signal?: AbortSignal;
}

/**
 * Fetch with automatic retry on transient errors (429/502/503/504) and per-request timeout.
 * Non-retryable server errors (500, 413) are returned immediately since retrying
 * the same request is unlikely to succeed (e.g., CPU limit exceeded, PDF too large).
 * Uses exponential backoff with jitter.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchWithRetryOpts = {},
): Promise<Response> {
  const { retries = 3, baseDelayMs = 2000, timeoutMs = 120_000, signal } = opts;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // Respect external cancellation
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Per-attempt timeout
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(
      () => timeoutCtrl.abort(new DOMException(`Request timed out after ${(timeoutMs / 1000).toFixed(0)}s`, 'TimeoutError')),
      timeoutMs,
    );

    // Combine external signal + timeout
    const combinedSignal = signal
      ? anySignal([signal, timeoutCtrl.signal])
      : timeoutCtrl.signal;

    try {
      const res = await fetch(url, { ...init, signal: combinedSignal });
      clearTimeout(timer);

      // Non-retryable server error — return immediately (retrying won't help)
      if (NON_RETRYABLE_SERVER.has(res.status)) {
        return res;
      }

      // Success or non-retryable error — return immediately
      if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt === retries) {
        return res;
      }

      // Retryable status — apply backoff
      const retryAfter = res.headers.get('Retry-After');
      const retryMs = retryAfter
        ? Math.min(Number(retryAfter) * 1000 || baseDelayMs, 30_000)
        : baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;

      await sleep(retryMs);
    } catch (err) {
      clearTimeout(timer);

      // External abort — rethrow immediately
      if (signal?.aborted) throw err;

      // Timeout or network error — retry if we have attempts left
      if (attempt === retries) throw err;

      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError' && timeoutCtrl.signal.aborted;
      const delayMs = isTimeout
        ? baseDelayMs * Math.pow(2, attempt - 1)
        : baseDelayMs * attempt + Math.random() * 1000;

      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('fetchWithRetry exhausted all attempts');
}

/**
 * Combine multiple AbortSignals into one that fires when any of them fires.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) { ctrl.abort(s.reason); return ctrl.signal; }
    s.addEventListener('abort', () => ctrl.abort(s.reason), { once: true });
  }
  return ctrl.signal;
}

/* ------------------------------------------------------------------ */
/*  DQ entry helpers                                                   */
/* ------------------------------------------------------------------ */

export function emptyEntry(): DQEntry {
  return { status: 'idle', summary: null, detail: null, error: null, updatedAt: null };
}

/* ------------------------------------------------------------------ */
/*  Report helpers                                                     */
/* ------------------------------------------------------------------ */

function extractReportKeyFromUrl(reportUrl: string | null | undefined): string | null {
  if (typeof reportUrl !== 'string') return null;
  const trimmed = reportUrl.trim();
  if (!trimmed.startsWith('/r2/')) return null;
  const key = trimmed.slice('/r2/'.length).trim();
  return key || null;
}

export function reportSearchBlob(report: AdminReport): string {
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
    ].join(' '),
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

export const STATIC_ADMIN_REPORTS: AdminReport[] = SUSTAINABILITY_REPORTS.map(
  toAdminStaticReport,
).filter((r): r is AdminReport => r !== null);

function compareReports(a: AdminReport, b: AdminReport): number {
  const diff = toEpoch(b.createdAt) - toEpoch(a.createdAt);
  if (diff !== 0) return diff;
  if (a.publishedYear !== b.publishedYear) return b.publishedYear - a.publishedYear;
  return a.company.localeCompare(b.company);
}

export function mergeReports(uploadedReports: UploadedReport[]): AdminReport[] {
  const byId = new Map<string, AdminReport>();
  for (const r of STATIC_ADMIN_REPORTS) byId.set(r.id, r);

  for (const uploaded of uploadedReports) {
    const existing = byId.get(uploaded.id);
    if (existing) {
      byId.set(uploaded.id, { ...existing, ...uploaded, source: 'merged', canDelete: true });
      continue;
    }
    byId.set(uploaded.id, { ...uploaded, source: 'uploaded', canDelete: true });
  }

  return Array.from(byId.values()).sort(compareReports);
}

/* ------------------------------------------------------------------ */
/*  Score parser                                                       */
/* ------------------------------------------------------------------ */

export function toScore(
  payload: unknown,
  fallback: AdminReport,
): DisclosureQualityScore | null {
  const obj = asObj(payload);
  if (!obj) return null;

  const score = toNum(obj.score);
  const band = bandFrom(obj.band);

  const subObj = asObj(obj.subscores);
  const completeness = toNum(subObj?.completeness);
  const consistency = toNum(subObj?.consistency);
  const assurance = toNum(subObj?.assurance);
  const transparency = toNum(subObj?.transparency);

  const subscores: DisclosureQualitySubscores | null =
    completeness === null ||
    consistency === null ||
    assurance === null ||
    transparency === null
      ? null
      : { completeness, consistency, assurance, transparency };

  if (score === null && band === null && !subscores) return null;

  const reportObj = asObj(obj.report);
  const report = {
    id:
      typeof reportObj?.id === 'string' && reportObj.id.trim()
        ? reportObj.id
        : fallback.id,
    key:
      typeof reportObj?.key === 'string' && reportObj.key.trim()
        ? reportObj.key
        : fallback.reportKey,
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
    for (const [k, v] of Object.entries(featuresObj)) features[k] = toBool(v);
    out.features = features;
  }

  const featureDepthObj = asObj(obj.featureDepth);
  if (featureDepthObj) {
    const fd: Record<string, { occurrences: number; pages: number }> = {};
    for (const [k, v] of Object.entries(featureDepthObj)) {
      const item = asObj(v);
      if (!item) continue;
      const occ = toNum(item.occurrences);
      const pg = toNum(item.pages);
      if (occ === null || pg === null) continue;
      fd[k] = { occurrences: occ, pages: pg };
    }
    if (Object.keys(fd).length > 0) out.featureDepth = fd;
  }

  const evidenceObj = asObj(obj.evidence);
  if (evidenceObj) {
    const evidence: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(evidenceObj)) {
      if (!Array.isArray(v)) continue;
      const lines = v
        .map((i) => (typeof i === 'string' ? i.trim() : String(i).trim()))
        .filter(Boolean);
      if (lines.length > 0) evidence[k] = lines;
    }
    if (Object.keys(evidence).length > 0) out.evidence = evidence;
  }

  const eqObj = asObj(obj.evidenceQuotes);
  if (eqObj) {
    const eq: Record<
      string,
      Array<{ text: string; page: number | null; heading: string | null }>
    > = {};
    for (const [k, v] of Object.entries(eqObj)) {
      if (!Array.isArray(v)) continue;
      const rows: Array<{
        text: string;
        page: number | null;
        heading: string | null;
      }> = [];
      for (const raw of v) {
        const item = asObj(raw);
        if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
        rows.push({
          text: item.text.trim(),
          page: toNum(item.page),
          heading:
            typeof item.heading === 'string' && item.heading.trim()
              ? item.heading.trim()
              : null,
        });
      }
      if (rows.length > 0) eq[k] = rows;
    }
    if (Object.keys(eq).length > 0) out.evidenceQuotes = eq;
  }

  if (Array.isArray(obj.recommendations)) {
    const recs = obj.recommendations
      .map((i) => (typeof i === 'string' ? i.trim() : String(i).trim()))
      .filter(Boolean);
    if (recs.length > 0) out.recommendations = recs;
  }

  const qObj = asObj(obj.quantitativeProfile);
  const pc = toNum(qObj?.percentageCount);
  const tr = toNum(qObj?.tableRows);
  const kn = toNum(qObj?.kpiNumbers);
  const dy = toNum(qObj?.distinctYears);
  const nd = toNum(qObj?.numericDensity);
  if (
    pc !== null &&
    tr !== null &&
    kn !== null &&
    dy !== null &&
    nd !== null
  ) {
    out.quantitativeProfile = {
      percentageCount: pc,
      tableRows: tr,
      kpiNumbers: kn,
      distinctYears: dy,
      numericDensity: nd,
    };
  }

  const methodObj = asObj(obj.method);
  if (methodObj) out.method = methodObj;

  const topicObj = asObj(obj.topicProfile);
  if (topicObj) out.topicProfile = topicObj;

  return out;
}

/* ------------------------------------------------------------------ */
/*  CSS class helpers                                                  */
/* ------------------------------------------------------------------ */

export function statusClass(status: DQEntry['status']): string {
  const map: Record<string, string> = {
    computed:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800/50',
    cached:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/50',
    running:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50',
    queued:
      'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60',
    error:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50',
  };
  return (
    map[status] ??
    'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/60'
  );
}

export function statusLabel(status: DQEntry['status']): string {
  const labels: Record<string, string> = {
    computed: 'Computed',
    cached: 'Cached',
    running: 'Running',
    queued: 'Queued',
    error: 'Error',
  };
  return labels[status] ?? 'Idle';
}

export function bandClass(band: DisclosureQualityBand | null): string {
  if (band === 'high')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50';
  if (band === 'medium')
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50';
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50';
}

export function entityStatusClass(status: EntityStatus): string {
  if (status === 'done')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50';
  if (status === 'none')
    return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/60';
  return 'bg-gray-50 text-gray-500 border-gray-200/70 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700/40';
}

export function entityStatusLabel(status: EntityStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'none') return 'None';
  return '—';
}

/* ------------------------------------------------------------------ */
/*  Sorting comparators                                                */
/* ------------------------------------------------------------------ */

export function sortReports(
  reports: AdminReport[],
  dqById: Record<string, DQEntry>,
  field: SortField,
  dir: SortDir,
  entityById?: Record<string, EntityStatus>,
): AdminReport[] {
  const mult = dir === 'asc' ? 1 : -1;

  return [...reports].sort((a, b) => {
    switch (field) {
      case 'company':
        return mult * a.company.localeCompare(b.company);
      case 'year':
        return mult * (a.publishedYear - b.publishedYear);
      case 'source':
        return mult * a.source.localeCompare(b.source);
      case 'status': {
        const sa = dqById[a.id]?.status ?? 'idle';
        const sb = dqById[b.id]?.status ?? 'idle';
        return mult * sa.localeCompare(sb);
      }
      case 'score': {
        const va = dqById[a.id]?.summary?.score ?? -1;
        const vb = dqById[b.id]?.summary?.score ?? -1;
        return mult * (va - vb);
      }
      case 'entity': {
        const ea = entityById?.[a.id] ?? 'unknown';
        const eb = entityById?.[b.id] ?? 'unknown';
        const order: Record<string, number> = { done: 2, none: 1, unknown: 0 };
        return mult * ((order[ea] ?? 0) - (order[eb] ?? 0));
      }
      case 'created':
        return mult * (toEpoch(a.createdAt) - toEpoch(b.createdAt));
      default:
        return 0;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Diagnostics row builders                                           */
/* ------------------------------------------------------------------ */

export function buildRegexDepthRows(
  detail: DisclosureQualityScore,
): RegexDepthRow[] {
  const features = detail.features ?? {};
  const depth = detail.featureDepth ?? {};
  const quotes = detail.evidenceQuotes ?? {};

  const keys = new Set<string>([
    ...Object.keys(features),
    ...Object.keys(depth),
    ...Object.keys(quotes),
  ]);

  const rows = Array.from(keys)
    .map((key) => {
      const d = depth[key];
      const qc = Array.isArray(quotes[key]) ? quotes[key].length : 0;
      return {
        key,
        label: featureLabel(key),
        found: Boolean(features[key]),
        occurrences: d ? Math.max(0, Math.round(d.occurrences)) : 0,
        pages: d ? Math.max(0, Math.round(d.pages)) : 0,
        quoteCount: qc,
      };
    })
    .filter((r) => r.found || r.occurrences > 0 || r.quoteCount > 0);

  rows.sort((a, b) => {
    if (a.found !== b.found) return a.found ? -1 : 1;
    if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
    if (a.pages !== b.pages) return b.pages - a.pages;
    if (a.quoteCount !== b.quoteCount) return b.quoteCount - a.quoteCount;
    return a.label.localeCompare(b.label);
  });

  return rows;
}

export function buildProvenanceRows(
  detail: DisclosureQualityScore,
): ProvenanceRow[] {
  const features = detail.features ?? {};
  const depth = detail.featureDepth ?? {};
  const quotesByFeature = detail.evidenceQuotes ?? {};
  const rawByFeature = detail.evidence ?? {};

  const keys = new Set<string>([
    ...Object.keys(features).filter((k) => Boolean(features[k])),
    ...Object.keys(depth),
    ...Object.keys(quotesByFeature),
    ...Object.keys(rawByFeature),
  ]);

  const rows: ProvenanceRow[] = [];
  for (const key of keys) {
    const quoteRows = Array.isArray(quotesByFeature[key])
      ? quotesByFeature[key].filter(
          (r) => typeof r.text === 'string' && r.text.trim(),
        )
      : [];
    const rawLines = Array.isArray(rawByFeature[key])
      ? rawByFeature[key]
          .map((l) => (typeof l === 'string' ? l.trim() : String(l).trim()))
          .filter(Boolean)
      : [];

    const depthRow = depth[key];
    const pageSet = new Set<number>();
    for (const q of quoteRows) {
      if (typeof q.page === 'number' && Number.isFinite(q.page)) pageSet.add(q.page);
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
}

/* ------------------------------------------------------------------ */
/*  CSV / JSON export                                                  */
/* ------------------------------------------------------------------ */

export function exportScoredRowsCSV(rows: ScoredRow[]): void {
  const header = [
    'company',
    'report_id',
    'year',
    'source',
    'score',
    'band',
    'completeness',
    'consistency',
    'assurance',
    'transparency',
    'features_hit',
    'features_total',
    'generated_at',
  ];

  const lines = rows.map((r) => {
    const s = r.summary;
    return [
      `"${r.report.company.replace(/"/g, '""')}"`,
      r.report.id,
      r.report.publishedYear,
      r.report.source,
      s.score !== null ? Math.round(s.score) : '',
      s.band ?? '',
      s.subscores ? Math.round(s.subscores.completeness) : '',
      s.subscores ? Math.round(s.subscores.consistency) : '',
      s.subscores ? Math.round(s.subscores.assurance) : '',
      s.subscores ? Math.round(s.subscores.transparency) : '',
      s.featureCount ?? '',
      s.featureTotal ?? '',
      s.generatedAt ?? '',
    ].join(',');
  });

  const csv = [header.join(','), ...lines].join('\n');
  downloadBlob(csv, 'admin-dq-scores.csv', 'text/csv');
}

export function exportScoredRowsJSON(rows: ScoredRow[]): void {
  const data = rows.map((r) => ({
    company: r.report.company,
    reportId: r.report.id,
    year: r.report.publishedYear,
    source: r.report.source,
    score: r.summary.score,
    band: r.summary.band,
    subscores: r.summary.subscores,
    featureCount: r.summary.featureCount,
    featureTotal: r.summary.featureTotal,
    generatedAt: r.summary.generatedAt,
  }));
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, 'admin-dq-scores.json', 'application/json');
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Import for ScoredRow — re-export for convenience                   */
/* ------------------------------------------------------------------ */
import type { ScoredRow } from './admin-types';

/* ------------------------------------------------------------------ */
/*  Depth analysis: aggregation builders                               */
/* ------------------------------------------------------------------ */

import type {
  SectorBenchmark,
  YearTrend,
  FeatureCoverageRow,
  PerformerRow,
  CountryBucket,
  SubscoreCorrelation,
} from './admin-types';

/** Aggregate scored rows by GICS sector */
export function buildSectorBenchmarks(rows: ScoredRow[]): SectorBenchmark[] {
  const bySector = new Map<string, ScoredRow[]>();
  for (const r of rows) {
    const sector = r.report.sector || 'Unknown';
    const arr = bySector.get(sector) ?? [];
    arr.push(r);
    bySector.set(sector, arr);
  }

  const out: SectorBenchmark[] = [];
  for (const [sector, items] of bySector) {
    const scores = items.map((i) => i.summary.score ?? 0);
    const subValues = items
      .map((i) => i.summary.subscores)
      .filter((s): s is DisclosureQualitySubscores => s !== null);

    out.push({
      sector,
      count: items.length,
      avg: avg(scores) ?? 0,
      median: median(scores) ?? 0,
      min: Math.min(...scores),
      max: Math.max(...scores),
      avgSubscores:
        subValues.length > 0
          ? {
              completeness: subValues.reduce((s, x) => s + x.completeness, 0) / subValues.length,
              consistency: subValues.reduce((s, x) => s + x.consistency, 0) / subValues.length,
              assurance: subValues.reduce((s, x) => s + x.assurance, 0) / subValues.length,
              transparency: subValues.reduce((s, x) => s + x.transparency, 0) / subValues.length,
            }
          : null,
    });
  }

  out.sort((a, b) => b.avg - a.avg);
  return out;
}

/** Aggregate scored rows by published year */
export function buildYearTrends(rows: ScoredRow[]): YearTrend[] {
  const byYear = new Map<number, ScoredRow[]>();
  for (const r of rows) {
    const year = r.report.publishedYear;
    const arr = byYear.get(year) ?? [];
    arr.push(r);
    byYear.set(year, arr);
  }

  const out: YearTrend[] = [];
  for (const [year, items] of byYear) {
    const scores = items.map((i) => i.summary.score ?? 0);
    let high = 0, medium = 0, low = 0;
    for (const i of items) {
      if (i.summary.band === 'high') high++;
      else if (i.summary.band === 'medium') medium++;
      else low++;
    }
    out.push({
      year,
      count: items.length,
      avg: avg(scores) ?? 0,
      median: median(scores) ?? 0,
      high,
      medium,
      low,
    });
  }

  out.sort((a, b) => a.year - b.year);
  return out;
}

/** Build feature coverage rates across all scored rows with detail */
export function buildFeatureCoverage(rows: ScoredRow[]): FeatureCoverageRow[] {
  const detailRows = rows.filter((r) => r.detail !== null);
  if (detailRows.length === 0) return [];

  const featureStats = new Map<string, { hits: number; totalOcc: number; totalPages: number }>();

  for (const r of detailRows) {
    const features = r.detail!.features ?? {};
    const depth = r.detail!.featureDepth ?? {};
    const keys = new Set([...Object.keys(features), ...Object.keys(depth)]);

    for (const key of keys) {
      const stat = featureStats.get(key) ?? { hits: 0, totalOcc: 0, totalPages: 0 };
      if (features[key]) stat.hits++;
      const d = depth[key];
      if (d) {
        stat.totalOcc += d.occurrences;
        stat.totalPages += d.pages;
      }
      featureStats.set(key, stat);
    }
  }

  const total = detailRows.length;
  const out: FeatureCoverageRow[] = [];
  for (const [key, stat] of featureStats) {
    out.push({
      key,
      label: featureLabel(key),
      hitCount: stat.hits,
      hitRate: pct(stat.hits, total),
      avgOccurrences: stat.hits > 0 ? stat.totalOcc / stat.hits : 0,
      avgPages: stat.hits > 0 ? stat.totalPages / stat.hits : 0,
    });
  }

  out.sort((a, b) => b.hitRate - a.hitRate);
  return out;
}

/** Top N and bottom N performers */
export function buildPerformers(
  rows: ScoredRow[],
  n = 10,
): { top: PerformerRow[]; bottom: PerformerRow[] } {
  const sorted = [...rows].sort(
    (a, b) => (b.summary.score ?? 0) - (a.summary.score ?? 0),
  );

  const toRow = (r: ScoredRow): PerformerRow => ({
    report: r.report,
    score: r.summary.score ?? 0,
    band: r.summary.band,
    subscores: r.summary.subscores,
  });

  return {
    top: sorted.slice(0, n).map(toRow),
    bottom: sorted.slice(-n).reverse().map(toRow),
  };
}

/** Aggregate scored rows by country */
export function buildCountryBuckets(rows: ScoredRow[]): CountryBucket[] {
  const byCountry = new Map<string, number[]>();
  for (const r of rows) {
    const country = r.report.country || 'Unknown';
    const arr = byCountry.get(country) ?? [];
    arr.push(r.summary.score ?? 0);
    byCountry.set(country, arr);
  }

  const out: CountryBucket[] = [];
  for (const [country, scores] of byCountry) {
    out.push({
      country,
      count: scores.length,
      avg: avg(scores) ?? 0,
      median: median(scores) ?? 0,
    });
  }

  out.sort((a, b) => b.avg - a.avg);
  return out;
}

/** Pearson correlation between subscore pairs */
export function buildSubscoreCorrelations(rows: ScoredRow[]): SubscoreCorrelation[] {
  const withSub = rows.filter((r) => r.summary.subscores !== null);
  if (withSub.length < 3) return [];

  const dims: (keyof DisclosureQualitySubscores)[] = [
    'completeness',
    'consistency',
    'assurance',
    'transparency',
  ];

  function pearson(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 3) return 0;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx;
      const b = ys[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
  }

  const out: SubscoreCorrelation[] = [];
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      const xs = withSub.map((r) => r.summary.subscores![dims[i]]);
      const ys = withSub.map((r) => r.summary.subscores![dims[j]]);
      out.push({
        pair: [dims[i], dims[j]],
        r: pearson(xs, ys),
      });
    }
  }

  return out;
}

/** Standard deviation (population) */
export function stddev(values: number[]): number | null {
  if (values.length === 0) return null;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
