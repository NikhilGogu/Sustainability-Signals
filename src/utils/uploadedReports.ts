import type { SustainabilityReport } from '../types';
import { normalizeDisplayText } from './textNormalize';

export interface UploadedReport extends SustainabilityReport {
  reportKey: string;
  createdAt?: string;
  uploadName?: string;
}

export interface MetadataSuggestion {
  company: string;
  publishedYear: number;
  country: string;
  sector: string;
  industry: string;
  sourceSector?: string;
  sourceIndustry?: string;
  confidence?: number;
  reason?: string;
}

export interface RangeSuggestion {
  start: number;
  end: number;
}

export interface ReportSuggestionResponse {
  ok: boolean;
  token: string;
  createdAt: string;
  expiresAt: string;
  isSustainabilityReport: boolean;
  metadataSuggestion: MetadataSuggestion;
  suggestedRange: RangeSuggestion;
  inferredFullUpload: boolean;
  duplicateCheck?: {
    duplicateLikely: boolean;
    duplicateHash: boolean;
    existingCompanyYear: boolean;
    existingKey?: string;
    existingKeys?: string[];
    existingRoute?: string;
  };
  classifier?: {
    reportType?: string;
    confidence?: number | null;
    reason?: string;
  };
}

export interface FinalizeIngestRequest {
  stageToken: string;
  metadata: MetadataSuggestion;
  metadataConfirmed: true;
  options?: {
    isFullReport?: boolean;
    pageStart?: number;
    pageEnd?: number;
  };
}

export interface DeleteUploadedReportResponse {
  ok: boolean;
  reportId: string;
  reportKey: string;
  deletedCount: number;
  deletedKeys: string[];
}

export interface FetchUploadedReportsParams {
  slug?: string;
  reportId?: string;
  all?: boolean;
  limit?: number;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function toEpoch(value?: string): number {
  const ts = Date.parse(value ?? '');
  return Number.isFinite(ts) ? ts : 0;
}

function toUploadedReport(raw: unknown): UploadedReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const id = asString(obj.id).trim();
  const slug = asString(obj.slug).trim();
  const company = normalizeDisplayText(asString(obj.company));
  const country = normalizeDisplayText(asString(obj.country));
  const sector = normalizeDisplayText(asString(obj.sector));
  const industry = normalizeDisplayText(asString(obj.industry));
  const reportUrl = asString(obj.reportUrl).trim();
  const reportKey = asString(obj.reportKey).trim();
  const publishedYear = Number(asString(obj.publishedYear));

  if (!id || !slug || !company || !reportUrl || !reportKey || !Number.isFinite(publishedYear)) return null;

  return {
    id,
    slug,
    company,
    country: country || 'Unknown',
    sector: sector || 'Unclassified',
    industry: industry || 'Unclassified',
    sourceSector: normalizeDisplayText(asString(obj.sourceSector)) || undefined,
    sourceIndustry: normalizeDisplayText(asString(obj.sourceIndustry)) || undefined,
    pageStart: asNumberOrNull(obj.pageStart),
    pageEnd: asNumberOrNull(obj.pageEnd),
    reportUrl,
    reportKey,
    publishedYear: Math.trunc(publishedYear),
    createdAt: asString(obj.createdAt).trim() || undefined,
    uploadName: asString(obj.uploadName).trim() || undefined,
  };
}

async function parseError(res: Response): Promise<string> {
  let text = `HTTP ${res.status}`;
  try {
    const payload = (await res.json()) as { error?: unknown };
    if (typeof payload?.error === 'string' && payload.error.trim()) text = payload.error.trim();
  } catch {
    // ignore
  }
  return text;
}

export async function fetchUploadedReports(params: FetchUploadedReportsParams = {}): Promise<UploadedReport[]> {
  const all = Boolean(params.all);
  const limitRaw = Number(params.limit);
  const pageLimit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.trunc(limitRaw), 1000)) : 1000;

  if (all && !params.slug && !params.reportId) {
    const byId = new Map<string, UploadedReport>();
    let cursor: string | null = null;
    let safety = 0;

    for (;;) {
      const url = new URL('/api/reports/uploads', window.location.origin);
      url.searchParams.set('paginate', '1');
      url.searchParams.set('limit', String(pageLimit));
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error(await parseError(res));

      const payload = (await res.json()) as { reports?: unknown[]; nextCursor?: unknown };
      const list = Array.isArray(payload?.reports) ? payload.reports : [];
      for (const raw of list) {
        const report = toUploadedReport(raw);
        if (!report) continue;
        byId.set(report.id, report);
      }

      const nextCursor =
        typeof payload?.nextCursor === 'string' && payload.nextCursor.trim()
          ? payload.nextCursor.trim()
          : null;
      if (!nextCursor) break;

      cursor = nextCursor;
      safety += 1;
      if (safety > 1000) throw new Error('Uploads pagination did not converge');
    }

    return Array.from(byId.values()).sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
  }

  const url = new URL('/api/reports/uploads', window.location.origin);
  if (params.slug) url.searchParams.set('slug', params.slug);
  if (params.reportId) url.searchParams.set('reportId', params.reportId);
  if (Number.isFinite(limitRaw) && limitRaw > 0) url.searchParams.set('limit', String(pageLimit));

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(await parseError(res));

  const payload = (await res.json()) as { reports?: unknown[] };
  const list = Array.isArray(payload?.reports) ? payload.reports : [];
  return list.map(toUploadedReport).filter((r): r is UploadedReport => r !== null);
}

export async function requestMetadataSuggestion(file: File): Promise<ReportSuggestionResponse> {
  const form = new FormData();
  form.set('file', file);

  const res = await fetch('/api/reports/suggest-metadata', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await parseError(res));

  return (await res.json()) as ReportSuggestionResponse;
}

export async function finalizeIngest(input: FinalizeIngestRequest): Promise<UploadedReport> {
  const res = await fetch('/api/reports/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));

  const payload = (await res.json()) as { report?: unknown };
  const report = toUploadedReport(payload.report);
  if (!report) throw new Error('Invalid ingest response');
  return report;
}

export async function deleteUploadedReport(input: {
  reportId: string;
  apiKey: string;
}): Promise<DeleteUploadedReportResponse> {
  const reportId = input.reportId.trim();
  const apiKey = input.apiKey.trim();
  if (!reportId) throw new Error('Missing reportId');
  if (!apiKey) throw new Error('Missing API key');

  const url = new URL('/api/reports/uploads', window.location.origin);
  url.searchParams.set('reportId', reportId);

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(await parseError(res));

  const payload = (await res.json()) as {
    ok?: unknown;
    reportId?: unknown;
    reportKey?: unknown;
    deletedCount?: unknown;
    deletedKeys?: unknown;
  };

  return {
    ok: Boolean(payload.ok),
    reportId: asString(payload.reportId).trim() || reportId,
    reportKey: asString(payload.reportKey).trim(),
    deletedCount:
      typeof payload.deletedCount === 'number' && Number.isFinite(payload.deletedCount)
        ? Math.max(0, Math.trunc(payload.deletedCount))
        : 0,
    deletedKeys: Array.isArray(payload.deletedKeys)
      ? payload.deletedKeys.map((v) => asString(v).trim()).filter(Boolean)
      : [],
  };
}
