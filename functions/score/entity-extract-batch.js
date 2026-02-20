// ─── Entity Extract Batch Status Endpoint ───────────────────────────────────
// Bulk check whether entity extraction results are cached in R2.
// Accepts up to 500 report IDs, performs HEAD checks in parallel.
// Returns { results: { [id]: boolean } } — true = cached, false = not cached.

import {
  safeString,
  runPool,
  entityExtractKey,
} from "../_lib/index.js";

import { ErrorCode, errorResponse } from "../_lib/errors.js";
import { validateJsonBody, validateReportIdBatch } from "../_lib/validation.js";

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_BATCH_SIZE = 500;
const R2_CONCURRENCY = 30;

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const log = context._log || console;
  const requestId = context._requestId;
  const jsonHeaders = { "Content-Type": "application/json" };

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)", { requestId });
  }

  // Parse and validate request body
  const parsed = await validateJsonBody(context.request, { maxBytes: 500_000 });
  if (!parsed.valid) {
    return errorResponse(400, ErrorCode[parsed.code] || ErrorCode.BAD_REQUEST, parsed.error, { requestId });
  }

  const body = parsed.body;
  const version = Number.isFinite(body?.version) ? Math.max(1, Math.min(10, Math.round(body.version))) : 1;

  // Validate report IDs
  const batch = validateReportIdBatch(body?.reportIds, { maxItems: MAX_BATCH_SIZE });
  if (!batch.valid) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, batch.error, { requestId });
  }

  const ids = batch.ids;
  log.info("Batch entity status request", { count: ids.length, version });

  /** @type {Record<string, boolean>} */
  const results = {};

  await runPool(ids, R2_CONCURRENCY, async (id) => {
    const key = entityExtractKey(id, version);
    try {
      const head = await bucket.head(key);
      results[id] = head !== null;
    } catch (err) {
      log.error("R2 head failed in entity batch", { id, error: err?.message || String(err) });
      results[id] = false;
    }
  });

  log.info("Batch entity status complete", {
    requested: ids.length,
    cached: Object.values(results).filter(Boolean).length,
    missing: Object.values(results).filter((v) => !v).length,
  });

  return new Response(
    JSON.stringify({ version, count: ids.length, results }),
    { headers: jsonHeaders }
  );
}
