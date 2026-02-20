// List uploaded report records.
// GET /api/reports/uploads

import { safeString } from "../../_lib/utils.js";
import { ErrorCode, errorResponse } from "../../_lib/errors.js";
import { validateAdminDeleteRequestSource } from "../../_lib/request-guards.js";
import {
  listUploadedReportRecords,
  listUploadedReportRecordsPage,
  uploadedReportRecordKey,
  uploadedRecordToUiReport,
} from "../../_lib/reports-upload.js";
import { validateReportId } from "../../_lib/validation.js";
import {
  markdownCacheKeyForReportKey,
  markdownMetaKeyForReportKey,
  normalizeReportKey,
  vectorizeMarkerKeyForReportId,
} from "../../_lib/r2.js";

const SCORE_PREFIX = "scores/disclosure_quality/";

/**
 * Gather all disclosure-quality score cache objects for a report across versions.
 * @param {R2Bucket} bucket
 * @param {string} reportId
 * @returns {Promise<string[]>}
 */
async function listScoreCacheKeysForReport(bucket, reportId) {
  if (!bucket || !reportId) return [];

  const suffix = `/${reportId}.json`;
  const out = [];
  let cursor = undefined;

  for (;;) {
    const page = await bucket.list({
      prefix: SCORE_PREFIX,
      cursor,
      limit: 1000,
    });

    for (const obj of page.objects || []) {
      const key = safeString(obj?.key);
      if (!key || !key.endsWith(suffix)) continue;
      out.push(key);
    }

    if (!page.truncated || !page.cursor) break;
    cursor = page.cursor;
  }

  return out;
}

export async function onRequest(context) {
  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)");
  }

  const url = new URL(context.request.url);
  const method = context.request.method;

  if (method === "DELETE") {
    const sourceCheck = validateAdminDeleteRequestSource(context.request);
    if (!sourceCheck.ok) {
      return errorResponse(
        403,
        ErrorCode.FORBIDDEN,
        safeString(sourceCheck.reason || "Delete request source is not allowed"),
        { details: sourceCheck.details }
      );
    }

    const reportId = safeString(url.searchParams.get("reportId")).trim();
    const idCheck = validateReportId(reportId);
    if (!idCheck.valid) {
      return errorResponse(400, ErrorCode.BAD_REQUEST, idCheck.error || "Invalid reportId");
    }

    const recordKey = uploadedReportRecordKey(reportId);
    const recordObj = await bucket.get(recordKey);
    if (!recordObj) {
      return errorResponse(404, ErrorCode.NOT_FOUND, "Uploaded report record not found");
    }

    const record = await recordObj.json().catch(() => null);
    if (!record || typeof record !== "object") {
      return errorResponse(500, ErrorCode.CACHE_CORRUPT, "Uploaded report record is corrupted");
    }

    const rawReportKey = safeString(record?.report?.reportKey).trim();
    const reportKey = normalizeReportKey(rawReportKey);
    if (!reportKey) {
      return errorResponse(500, ErrorCode.CACHE_CORRUPT, "Uploaded report record is missing a valid reportKey");
    }

    const scoreKeys = await listScoreCacheKeysForReport(bucket, reportId);
    const keys = new Set([
      recordKey,
      reportKey,
      markdownCacheKeyForReportKey(reportKey),
      markdownMetaKeyForReportKey(reportKey),
      ...scoreKeys,
    ]);

    const markerKey = vectorizeMarkerKeyForReportId(reportId);
    if (markerKey) keys.add(markerKey);

    const deletedKeys = [];
    const failedKeys = [];
    for (const key of keys) {
      try {
        await bucket.delete(key);
        deletedKeys.push(key);
      } catch {
        failedKeys.push(key);
      }
    }

    if (failedKeys.length > 0) {
      return errorResponse(500, ErrorCode.R2_ERROR, "Report deletion completed with storage errors", {
        details: {
          reportId,
          reportKey,
          deletedCount: deletedKeys.length,
          failedCount: failedKeys.length,
          failedKeys,
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reportId,
        reportKey,
        deletedCount: deletedKeys.length,
        deletedKeys,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (method !== "GET") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const slug = safeString(url.searchParams.get("slug")).trim();
  const reportId = safeString(url.searchParams.get("reportId")).trim();
  const cursor = safeString(url.searchParams.get("cursor")).trim();
  const paginate = safeString(url.searchParams.get("paginate")).trim() === "1" || Boolean(cursor);
  const limitRaw = Number.parseInt(safeString(url.searchParams.get("limit")), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 1000)) : 500;

  const sortByCreatedAt = (a, b) => {
    const ta = Date.parse(safeString(a?.createdAt || ""));
    const tb = Date.parse(safeString(b?.createdAt || ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
    return safeString(a?.id || "").localeCompare(safeString(b?.id || ""));
  };

  if (paginate && !slug && !reportId) {
    const page = await listUploadedReportRecordsPage(bucket, {
      limit,
      cursor: cursor || undefined,
    });
    const reports = page.records.map(uploadedRecordToUiReport).filter(Boolean).sort(sortByCreatedAt);

    return new Response(
      JSON.stringify({
        ok: true,
        count: reports.length,
        reports,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const scanLimit = slug || reportId ? 20000 : limit;
  const records = await listUploadedReportRecords(bucket, { limit: scanLimit });
  let reports = records.map(uploadedRecordToUiReport).filter(Boolean);

  if (slug) {
    reports = reports.filter((r) => {
      const legacySlug = safeString(r?.legacySlug).trim();
      return r.slug === slug || legacySlug === slug;
    });
  }
  if (reportId) reports = reports.filter((r) => r.id === reportId);

  reports.sort(sortByCreatedAt);

  return new Response(
    JSON.stringify({ ok: true, count: reports.length, reports }),
    { headers: { "Content-Type": "application/json" } }
  );
}
