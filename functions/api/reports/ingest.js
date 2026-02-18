// Finalize an AI-suggested report ingestion.
// POST /api/reports/ingest

import { safeString, safeBool } from "../../_lib/utils.js";
import {
  putCachedMarkdown,
  putJsonSafe,
  markdownMetaKeyForReportKey,
  validateJsonBody,
  vectorizeMarkerKeyForReportId,
} from "../../_lib/index.js";
import { ErrorCode, errorResponse } from "../../_lib/errors.js";
import {
  buildUploadedSlug,
  listUploadedReportRecords,
  normalizeMetaField,
  slugifyCompanyName,
  uploadedReportRecordKey,
} from "../../_lib/reports-upload.js";
import {
  clampPage,
  extractPageRangePdf,
  isLikelyPdfBytes,
  markdownForRange,
  indexMarkdown,
  sha256Hex,
  splitMarkdownIntoPages,
} from "../../_lib/report-intake.js";
import {
  buildRequestFingerprint,
  fingerprintMatches,
  validateCoverageRequestSource,
} from "../../_lib/request-guards.js";

const STAGING_PREFIX = "ingest/staging/";
const REPORT_ID_PATTERN = /^report-(\d+)$/i;
const STAGE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9-]{15,63}$/i;
const DEFAULT_REPORT_ID_FLOOR = 10000;
const LEGACY_REPORT_ID_CUTOFF = 1_000_000;

function parseReportNumber(value) {
  const m = REPORT_ID_PATTERN.exec(safeString(value).trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 0) return null;
  // Ignore legacy timestamp-style IDs so new uploads use compact monotonic IDs.
  if (n >= LEGACY_REPORT_ID_CUTOFF) return null;
  return n;
}

function stagingPdfKey(token) {
  return `${STAGING_PREFIX}${token}.pdf`;
}

function stagingMarkdownKey(token) {
  return `${STAGING_PREFIX}${token}.md`;
}

function stagingMetaKey(token) {
  return `${STAGING_PREFIX}${token}.json`;
}

/**
 * @param {any} body
 */
function readMetadata(body) {
  const m = body?.metadata || {};
  const yearRaw = Number.parseInt(safeString(m.publishedYear), 10);
  const publishedYear = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : NaN;

  return {
    company: normalizeMetaField(m.company, { maxLen: 180 }),
    country: normalizeMetaField(m.country, { fallback: "Unknown", maxLen: 120 }),
    sector: normalizeMetaField(m.sector, { fallback: "Unclassified", maxLen: 140 }),
    industry: normalizeMetaField(m.industry, { fallback: "Unclassified", maxLen: 140 }),
    sourceSector: normalizeMetaField(m.sourceSector, { fallback: "", maxLen: 140 }),
    sourceIndustry: normalizeMetaField(m.sourceIndustry, { fallback: "", maxLen: 140 }),
    publishedYear,
  };
}

/**
 * @param {any} stage
 * @param {any} options
 * @returns {{ start:number; end:number; fullUpload:boolean }}
 */
function decideRange(stage, options) {
  const totalPages = Number(stage?.analysis?.totalPages) || 1;
  const suggestedStart = clampPage(Number(stage?.analysis?.suggestedRange?.start), 1, totalPages) || 1;
  const suggestedEnd = clampPage(Number(stage?.analysis?.suggestedRange?.end), 1, totalPages) || totalPages;

  const optionStart = clampPage(Number(options?.pageStart), 1, totalPages);
  const optionEnd = clampPage(Number(options?.pageEnd), 1, totalPages);

  let start = optionStart ?? suggestedStart;
  let end = optionEnd ?? suggestedEnd;
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }

  // Respect explicit user mode selection from finalize step.
  // Fall back to AI inference only when caller did not provide any mode.
  const hasIsFullReport = !!options && Object.prototype.hasOwnProperty.call(options, "isFullReport");
  const hasFullReport = !!options && Object.prototype.hasOwnProperty.call(options, "fullReport");
  let requestedFull = stage?.analysis?.inferredFullUpload === true;
  if (hasIsFullReport) requestedFull = safeBool(options?.isFullReport);
  else if (hasFullReport) requestedFull = safeBool(options?.fullReport);

  return { start, end, fullUpload: requestedFull };
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const sourceCheck = validateCoverageRequestSource(context.request);
  if (!sourceCheck.ok) {
    return errorResponse(
      403,
      ErrorCode.FORBIDDEN,
      safeString(sourceCheck.reason || "Upload request source is not allowed"),
      { details: sourceCheck.details }
    );
  }
  const requestFingerprint = buildRequestFingerprint(context.request);

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)");
  }
  if (!context.env.AI) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "Workers AI binding missing (AI)");
  }

  const parsed = await validateJsonBody(context.request);
  if (!parsed.valid) {
    return errorResponse(400, ErrorCode.INVALID_JSON, parsed.error || "Invalid JSON");
  }

  const body = parsed.body || {};
  const stageToken = safeString(body.stageToken).trim();
  const metadataConfirmed = body.metadataConfirmed === true;

  if (!stageToken) {
    return errorResponse(400, ErrorCode.MISSING_PARAM, "Missing stageToken");
  }
  if (!STAGE_TOKEN_PATTERN.test(stageToken)) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid stageToken format");
  }
  if (!metadataConfirmed) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "metadataConfirmed must be true before ingestion");
  }

  const metadata = readMetadata(body);
  if (!metadata.company) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Missing metadata.company");
  }
  if (!Number.isFinite(metadata.publishedYear)) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid metadata.publishedYear (expected 2000-2100)");
  }

  const stageMetaObj = await bucket.get(stagingMetaKey(stageToken));
  if (!stageMetaObj) {
    return errorResponse(404, ErrorCode.NOT_FOUND, "Staging token not found or expired");
  }

  const stage = await stageMetaObj.json().catch(() => null);
  if (!stage || typeof stage !== "object") {
    return errorResponse(500, ErrorCode.CACHE_CORRUPT, "Staging metadata is corrupted");
  }
  const stagedToken = safeString(stage?.token).trim();
  if (stagedToken && stagedToken !== stageToken) {
    return errorResponse(409, ErrorCode.CONFLICT, "Staging token mismatch. Please upload again.");
  }

  if (!fingerprintMatches(stage?.requestFingerprint, requestFingerprint)) {
    return errorResponse(403, ErrorCode.FORBIDDEN, "Staging token does not match the original upload session");
  }

  const expiresAt = Date.parse(safeString(stage.expiresAt));
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return errorResponse(410, ErrorCode.NOT_FOUND, "Staging token has expired. Please upload again.");
  }

  if (stage?.analysis?.isSustainabilityReport !== true) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "This PDF failed sustainability validation in suggestion step");
  }

  const stagedPdf = await bucket.get(stagingPdfKey(stageToken));
  if (!stagedPdf) {
    return errorResponse(404, ErrorCode.NOT_FOUND, "Staged PDF is missing. Please upload again.");
  }
  const stagedBytes = await stagedPdf.arrayBuffer();
  if (!isLikelyPdfBytes(stagedBytes)) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Staged file does not appear to be a valid PDF");
  }

  const stagedHash = await sha256Hex(stagedBytes);
  const stagedHashFromMeta = safeString(stage?.file?.sha256).toLowerCase();
  if (stagedHashFromMeta && stagedHashFromMeta !== stagedHash) {
    return errorResponse(409, ErrorCode.CONFLICT, "Staged PDF integrity check failed. Please upload again.");
  }
  const sha256 = stagedHashFromMeta || stagedHash;

  const stagedMarkdownObj = await bucket.get(stagingMarkdownKey(stageToken));
  const stagedMarkdown = stagedMarkdownObj ? await stagedMarkdownObj.text().catch(() => "") : "";
  if (!stagedMarkdown.trim()) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Staged extracted text is missing. Please upload again.");
  }

  // Duplicate guard by hash across uploaded records.
  const existingRecords = await listUploadedReportRecords(bucket, { limit: 2000 });
  const duplicateHash = existingRecords.find((r) => safeString(r?.file?.sha256).toLowerCase() === sha256);
  if (duplicateHash) {
    return errorResponse(409, ErrorCode.DUPLICATE_REPORT, "This PDF already exists in the ingestion index", {
      details: { reportId: safeString(duplicateHash?.report?.id), sha256 },
    });
  }

  // Duplicate guard by company/year path (covers static and uploaded reports stored in R2).
  const slugBase = slugifyCompanyName(metadata.company);
  if (!slugBase) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Unable to derive slug from metadata.company");
  }
  const companyYearPrefix = `reports/${metadata.publishedYear}/${slugBase}/`;
  const existingForCompanyYear = await bucket.list({ prefix: companyYearPrefix, limit: 5 });
  const existingKeys = (existingForCompanyYear.objects || [])
    .map((o) => safeString(o?.key).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (existingKeys.length > 0) {
    const existingKey = existingKeys[0];
    const existingRoute = `/reports/${slugBase}-${metadata.publishedYear}`;
    return errorResponse(
      409,
      ErrorCode.DUPLICATE_REPORT,
      `A report for this company/year already exists in coverage (${existingKey})`,
      {
        details: {
          company: metadata.company,
          publishedYear: metadata.publishedYear,
          existingKey,
          existingKeys,
          existingRoute,
        },
      }
    );
  }

  const pages = splitMarkdownIntoPages(stagedMarkdown);
  if (pages.length === 0) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Staged text does not contain valid page markers");
  }
  const { start, end, fullUpload } = decideRange(stage, body.options || {});
  const totalPages = Number(stage?.analysis?.totalPages) || Math.max(1, pages.length);
  const spanLength = end - start + 1;
  const nearlyWhole = spanLength >= Math.floor(totalPages * 0.92);

  let extracted = false;
  let storedBytes = new Uint8Array(stagedBytes);
  let pageStart = null;
  let pageEnd = null;
  let markdownForCache = stagedMarkdown;

  if (fullUpload && !nearlyWhole && totalPages > 1) {
    try {
      storedBytes = await extractPageRangePdf({ bytes: stagedBytes, startPage: start, endPage: end });
      extracted = true;
      pageStart = start;
      pageEnd = end;
      const sub = markdownForRange(pages, start, end);
      if (sub.trim()) markdownForCache = sub;
    } catch (err) {
      return errorResponse(422, ErrorCode.BAD_REQUEST, "Failed to extract selected sustainability page range", {
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // Allocate a monotonic numeric report ID (index-friendly + compact).
  const configuredFloor = Number.parseInt(safeString(context.env?.REPORT_ID_FLOOR), 10);
  const reportIdFloor =
    Number.isFinite(configuredFloor) && configuredFloor >= 1
      ? Math.trunc(configuredFloor)
      : DEFAULT_REPORT_ID_FLOOR;

  let maxNum = reportIdFloor - 1;
  for (const rec of existingRecords) {
    const n = parseReportNumber(rec?.report?.id);
    if (n != null && n > maxNum) maxNum = n;
  }

  let reportId = "";
  for (let i = 0; i < 16; i++) {
    const candidateNum = maxNum + 1 + i;
    const candidate = `report-${candidateNum}`;
    const exists = await bucket.get(uploadedReportRecordKey(candidate));
    if (!exists) {
      reportId = candidate;
      break;
    }
  }
  if (!reportId) {
    return errorResponse(500, ErrorCode.INTERNAL_ERROR, "Failed to allocate reportId");
  }

  const slug = buildUploadedSlug({
    company: metadata.company,
    year: metadata.publishedYear,
    reportId,
  });
  const fileName = extracted ? `sustainability-pp${pageStart}-${pageEnd}.pdf` : "sustainability-full.pdf";
  const reportKey = `reports/${metadata.publishedYear}/${slugBase}/${fileName}`;

  await bucket.put(reportKey, storedBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      reportId,
      company: metadata.company,
      publishedYear: String(metadata.publishedYear),
      sha256,
      source: "web-upload-finalized",
      stageToken,
    },
  });

  await putCachedMarkdown({
    bucket,
    reportKey,
    markdown: markdownForCache,
    tokens: null,
  });

  const createdAt = new Date().toISOString();
  const report = {
    id: reportId,
    slug,
    company: metadata.company,
    country: metadata.country,
    sector: metadata.sector,
    industry: metadata.industry,
    sourceSector: metadata.sourceSector || undefined,
    sourceIndustry: metadata.sourceIndustry || undefined,
    pageStart,
    pageEnd,
    reportKey,
    reportUrl: `/r2/${reportKey}`,
    publishedYear: metadata.publishedYear,
    createdAt,
  };

  const record = {
    version: 1,
    createdAt,
    finalizedByUser: true,
    stageToken,
    report,
    file: {
      name: safeString(stage?.file?.name),
      contentType: safeString(stage?.file?.contentType || "application/pdf"),
      originalBytes: Number(stage?.file?.size) || null,
      storedBytes: storedBytes.byteLength,
      sha256,
    },
    checks: {
      sustainability: stage?.analysis || null,
      extraction: {
        fullUpload,
        extracted,
        selectedStart: start,
        selectedEnd: end,
      },
      metadataSuggestion: stage?.metadataSuggestion || null,
    },
  };

  await putJsonSafe(bucket, uploadedReportRecordKey(reportId), record, `upload metadata ${reportId}`);
  await putJsonSafe(
    bucket,
    markdownMetaKeyForReportKey(reportKey),
    {
      reportKey,
      generatedAt: createdAt,
      source: "upload-ingest-finalized",
      extracted,
      pageStart,
      pageEnd,
      stageToken,
    },
    `markdown meta ${reportId}`
  );

  const backgroundJob = async () => {
    if (context.env.VECTORIZE_INDEX) {
      const embeddingModel = safeString(context.env.AI_EMBEDDING_MODEL || "@cf/baai/bge-small-en-v1.5");
      const pooling = safeString(context.env.AI_EMBEDDING_POOLING || "cls").toLowerCase() === "mean" ? "mean" : "cls";
      const markerKey = vectorizeMarkerKeyForReportId(reportId);

      let indexed = 0;
      let status = "done";
      let error = null;
      try {
        indexed = await indexMarkdown({
          ai: context.env.AI,
          vectorIndex: context.env.VECTORIZE_INDEX,
          reportId,
          markdown: markdownForCache,
          embeddingModel,
          pooling,
        });
      } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
      }

      if (markerKey) {
        try {
          await bucket.put(
            markerKey,
            JSON.stringify({
              reportId,
              reportKey,
              generatedAt: new Date().toISOString(),
              source: "upload-ingest-finalized",
              status,
              indexed,
              error,
            }),
            { httpMetadata: { contentType: "application/json; charset=utf-8" } }
          );
        } catch {
          // Marker write is best-effort.
        }
      }
    }

    // Cleanup staging artifacts regardless of indexing configuration.
    await bucket.delete(stagingPdfKey(stageToken));
    await bucket.delete(stagingMarkdownKey(stageToken));
    await bucket.delete(stagingMetaKey(stageToken));
  };

  if (typeof context.waitUntil === "function") {
    context.waitUntil(backgroundJob().catch(() => {}));
  } else {
    try {
      await backgroundJob();
    } catch {
      // Ignore best-effort background failures.
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      report,
      ingestion: {
        stageToken,
        extracted,
        reportId,
        reportKey,
        pageStart,
        pageEnd,
      },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}
