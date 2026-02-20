// ─── Request validation helpers ─────────────────────────────────────────────
// Centralized input validation for API endpoints.

import { safeString } from "./utils.js";

/** Validates a report ID format: "report-<digits>" */
const REPORT_ID_PATTERN = /^report-\d+$/;

/**
 * Validate a reportId string.
 * @param {string} reportId
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateReportId(reportId) {
  const id = safeString(reportId).trim();
  if (!id) return { valid: false, error: "Missing reportId" };
  if (!REPORT_ID_PATTERN.test(id)) return { valid: false, error: "Invalid reportId (expected report-<number>)" };
  return { valid: true };
}

/**
 * Validate that the request body is valid JSON and within size limits.
 * @param {Request} request
 * @param {{ maxBytes?: number }} [opts]
 * @returns {Promise<{ valid: boolean; body?: any; error?: string; code?: string }>}
 */
export async function validateJsonBody(request, { maxBytes = 5_000_000 } = {}) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
    // Be lenient: attempt to parse even without content-type header
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    return { valid: false, error: `Request body too large (max ${maxBytes} bytes)`, code: "PAYLOAD_TOO_LARGE" };
  }

  try {
    const body = await request.json();
    return { valid: true, body };
  } catch {
    return { valid: false, error: "Invalid JSON in request body", code: "INVALID_JSON" };
  }
}

/**
 * Validate an array of report IDs (for batch endpoints).
 * @param {unknown} reportIds
 * @param {{ maxItems?: number }} [opts]
 * @returns {{ valid: boolean; ids?: string[]; error?: string }}
 */
export function validateReportIdBatch(reportIds, { maxItems = 5000 } = {}) {
  if (!Array.isArray(reportIds)) {
    return { valid: false, error: "reportIds must be an array" };
  }

  const ids = [];
  const seen = new Set();
  for (const x of reportIds) {
    const id = safeString(x).trim();
    if (!id) continue;
    if (seen.has(id)) continue;

    const check = validateReportId(id);
    if (!check.valid) continue; // Skip invalid IDs silently in batch

    seen.add(id);
    ids.push(id);
    if (ids.length >= maxItems) break;
  }

  return { valid: true, ids };
}
