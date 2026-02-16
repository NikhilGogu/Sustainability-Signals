// Shared helpers for uploaded report ingestion/listing.

import { safeString } from "./utils.js";

export const UPLOADED_REPORT_PREFIX = "ingest/reports/";
export const UPLOADED_REPORT_VERSION = 1;

/**
 * Build the R2 key for an uploaded-report metadata record.
 * @param {string} reportId
 * @returns {string}
 */
export function uploadedReportRecordKey(reportId) {
  return `${UPLOADED_REPORT_PREFIX}${safeString(reportId).trim()}.json`;
}

/**
 * Slugify a company name for path-safe keys.
 * @param {string} value
 * @returns {string}
 */
export function slugifyCompanyName(value) {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Build a clean, stable slug for uploaded reports.
 * Duplicate company/year uploads are blocked upstream during ingest.
 * @param {{ company: string; year: number; reportId?: string }} input
 * @returns {string}
 */
export function buildUploadedSlug({ company, year }) {
  return `${slugifyCompanyName(company)}-${year}`;
}

/**
 * Normalize historical uploaded slugs to canonical form.
 * Legacy slugs had a random "-u####" suffix.
 * @param {string} slug
 * @returns {string}
 */
export function canonicalizeUploadedSlug(slug) {
  return safeString(slug).trim().toLowerCase().replace(/-u\d{4,}$/i, "");
}

/**
 * Normalize a short metadata field.
 * @param {unknown} value
 * @param {{ fallback?: string; maxLen?: number }} [opts]
 * @returns {string}
 */
export function normalizeMetaField(value, opts = {}) {
  const fallback = safeString(opts.fallback || "");
  const maxLen = Number.isFinite(opts.maxLen) ? Number(opts.maxLen) : 120;
  const s = safeString(value).trim().replace(/\s+/g, " ");
  if (!s) return fallback;
  return s.slice(0, Math.max(1, maxLen));
}

/**
 * Parse JSON safely.
 * @param {string} text
 * @returns {any|null}
 */
export function safeJsonParse(text) {
  try {
    return JSON.parse(safeString(text));
  } catch {
    return null;
  }
}

/**
 * List uploaded report records from R2.
 * @param {R2Bucket} bucket
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<any[]>}
 */
export async function listUploadedReportRecords(bucket, opts = {}) {
  if (!bucket) return [];
  const limit = Math.max(1, Math.min(Number(opts.limit) || 200, 2000));

  const out = [];
  let cursor = undefined;

  while (out.length < limit) {
    const page = await bucket.list({
      prefix: UPLOADED_REPORT_PREFIX,
      cursor,
      limit: Math.min(1000, limit - out.length),
    });

    for (const obj of page.objects || []) {
      if (out.length >= limit) break;
      const key = safeString(obj.key || "");
      if (!key.endsWith(".json")) continue;
      const raw = await bucket.get(key);
      if (!raw) continue;
      const parsed = safeJsonParse(await raw.text().catch(() => ""));
      if (!parsed || typeof parsed !== "object") continue;
      out.push(parsed);
    }

    if (!page.truncated || !page.cursor) break;
    cursor = page.cursor;
  }

  return out;
}

/**
 * Convert a stored upload record to the UI report shape.
 * @param {any} record
 * @returns {any|null}
 */
export function uploadedRecordToUiReport(record) {
  if (!record || typeof record !== "object") return null;
  const report = record.report;
  if (!report || typeof report !== "object") return null;

  const id = safeString(report.id).trim();
  const storedSlug = safeString(report.slug).trim();
  const slug = canonicalizeUploadedSlug(storedSlug) || storedSlug;
  const reportKey = safeString(report.reportKey).trim();
  if (!id || !slug || !reportKey) return null;

  return {
    id,
    slug,
    company: normalizeMetaField(report.company, { fallback: "Unknown Company", maxLen: 180 }),
    country: normalizeMetaField(report.country, { fallback: "Unknown", maxLen: 120 }),
    sector: normalizeMetaField(report.sector, { fallback: "Unclassified", maxLen: 140 }),
    industry: normalizeMetaField(report.industry, { fallback: "Unclassified", maxLen: 140 }),
    sourceSector: normalizeMetaField(report.sourceSector, { fallback: "", maxLen: 140 }) || undefined,
    sourceIndustry: normalizeMetaField(report.sourceIndustry, { fallback: "", maxLen: 140 }) || undefined,
    pageStart: Number.isFinite(report.pageStart) ? Number(report.pageStart) : null,
    pageEnd: Number.isFinite(report.pageEnd) ? Number(report.pageEnd) : null,
    reportUrl: `/r2/${reportKey}`,
    publishedYear: Number.isFinite(report.publishedYear) ? Number(report.publishedYear) : 0,
    reportKey,
    createdAt: safeString(record.createdAt || report.createdAt || ""),
    uploadName: safeString(record.file?.name || ""),
    legacySlug: storedSlug && storedSlug !== slug ? storedSlug : undefined,
  };
}
