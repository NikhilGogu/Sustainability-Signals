// List uploaded report records.
// GET /api/reports/uploads

import { safeString } from "../../_lib/utils.js";
import { ErrorCode, errorResponse } from "../../_lib/errors.js";
import {
  listUploadedReportRecords,
  uploadedRecordToUiReport,
} from "../../_lib/reports-upload.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)");
  }

  const url = new URL(context.request.url);
  const slug = safeString(url.searchParams.get("slug")).trim();
  const reportId = safeString(url.searchParams.get("reportId")).trim();
  const limitRaw = Number.parseInt(safeString(url.searchParams.get("limit")), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 1000)) : 500;

  const records = await listUploadedReportRecords(bucket, { limit });
  let reports = records.map(uploadedRecordToUiReport).filter(Boolean);

  if (slug) {
    reports = reports.filter((r) => {
      const legacySlug = safeString(r?.legacySlug).trim();
      return r.slug === slug || legacySlug === slug;
    });
  }
  if (reportId) reports = reports.filter((r) => r.id === reportId);

  reports.sort((a, b) => {
    const ta = Date.parse(safeString(a.createdAt || ""));
    const tb = Date.parse(safeString(b.createdAt || ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
    return safeString(a.id).localeCompare(safeString(b.id));
  });

  return new Response(
    JSON.stringify({ ok: true, count: reports.length, reports }),
    { headers: { "Content-Type": "application/json" } }
  );
}
