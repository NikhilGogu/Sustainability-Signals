// ─── Disclosure Quality Batch Endpoint ──────────────────────────────────────
// Bulk cached DQ score fetcher. Accepts up to 200 report IDs, reads scores
// from R2 in parallel (concurrency 24), returns summary objects.

import {
  safeString,
  clampInt,
  runPool,
  disclosureScoreKey,
  getCachedText,
} from "../_lib/index.js";

import { ErrorCode, errorResponse } from "../_lib/errors.js";
import { validateJsonBody, validateReportIdBatch } from "../_lib/validation.js";

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_BATCH_SIZE = 200;
const R2_CONCURRENCY = 24;

export async function onRequest(context) {
  // Method enforcement — OPTIONS handled by global middleware
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
  const version = clampInt(body?.version, 1, { min: 1, max: 10 });
  const summaryOnly = body?.summaryOnly === undefined ? true : Boolean(body.summaryOnly);

  // Validate report IDs
  const batch = validateReportIdBatch(body?.reportIds, { maxItems: MAX_BATCH_SIZE });
  if (!batch.valid) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, batch.error, { requestId });
  }

  const ids = batch.ids;

  log.info("Batch DQ score request", { count: ids.length, version, summaryOnly });

  const results = {};

  await runPool(ids, R2_CONCURRENCY, async (id) => {
    const key = disclosureScoreKey(id, version);
    const cached = await getCachedText(bucket, key);
    if (!cached) {
      results[id] = null;
      return;
    }

    if (!summaryOnly) {
      try {
        results[id] = JSON.parse(cached);
      } catch {
        results[id] = { error: "invalid_cached_json" };
      }
      return;
    }

    try {
      const j = JSON.parse(cached);
      results[id] = {
        version: j?.version ?? version,
        generatedAt: j?.generatedAt ?? null,
        report: j?.report ?? { id },
        score: j?.score ?? null,
        band: j?.band ?? null,
        subscores: j?.subscores ?? null,
      };
    } catch {
      results[id] = { error: "invalid_cached_json" };
    }
  });

  log.info("Batch DQ score complete", {
    requested: ids.length,
    found: Object.values(results).filter((v) => v && !v?.error).length,
    missing: Object.values(results).filter((v) => v === null).length,
  });

  return new Response(
    JSON.stringify({ version, count: ids.length, summaryOnly, results }),
    { headers: jsonHeaders }
  );
}
