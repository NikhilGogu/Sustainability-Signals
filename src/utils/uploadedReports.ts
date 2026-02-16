import type { SustainabilityReport } from '../types';

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

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function toUploadedReport(raw: unknown): UploadedReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const id = asString(obj.id).trim();
  const slug = asString(obj.slug).trim();
  const company = asString(obj.company).trim();
  const country = asString(obj.country).trim();
  const sector = asString(obj.sector).trim();
  const industry = asString(obj.industry).trim();
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
    sourceSector: asString(obj.sourceSector).trim() || undefined,
    sourceIndustry: asString(obj.sourceIndustry).trim() || undefined,
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

export async function fetchUploadedReports(params: { slug?: string; reportId?: string } = {}): Promise<UploadedReport[]> {
  const url = new URL('/api/reports/uploads', window.location.origin);
  if (params.slug) url.searchParams.set('slug', params.slug);
  if (params.reportId) url.searchParams.set('reportId', params.reportId);

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
