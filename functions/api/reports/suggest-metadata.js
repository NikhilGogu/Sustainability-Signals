// AI metadata suggestion + staging endpoint.
// POST /api/reports/suggest-metadata

import { safeString } from "../../_lib/utils.js";
import { ErrorCode, errorResponse } from "../../_lib/errors.js";
import { convertPdfToMarkdown, putJsonSafe, putTextSafe } from "../../_lib/index.js";
import {
  MAX_UPLOAD_BYTES,
  MAX_MARKDOWN_CHARS_FOR_ANALYSIS,
  isLikelyPdfBytes,
  readPdfPageCount,
  CLASSIFIER_MODEL_DEFAULT,
  METADATA_MODEL_DEFAULT,
  splitMarkdownIntoPages,
  analyzeSustainabilityPages,
  classifyReportWithAi,
  suggestMetadataWithAi,
  clampPage,
  sha256Hex,
} from "../../_lib/report-intake.js";
import { listUploadedReportRecords, slugifyCompanyName } from "../../_lib/reports-upload.js";
import {
  buildRequestFingerprint,
  validateCoverageRequestSource,
} from "../../_lib/request-guards.js";

const STAGING_PREFIX = "ingest/staging/";
const STAGING_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MIN_UPLOAD_BYTES = 1024; // 1KB
const MIN_MARKDOWN_CHARS = 300;
const MAX_UPLOAD_PAGES_DEFAULT = 600;

/**
 * @param {string} token
 */
function stagingPdfKey(token) {
  return `${STAGING_PREFIX}${token}.pdf`;
}

/**
 * @param {string} token
 */
function stagingMarkdownKey(token) {
  return `${STAGING_PREFIX}${token}.md`;
}

/**
 * @param {string} token
 */
function stagingMetaKey(token) {
  return `${STAGING_PREFIX}${token}.json`;
}

function makeToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {any} aiVerdict
 * @param {any} heuristic
 */
function chooseSuggestedRange(aiVerdict, heuristic) {
  const totalPages = heuristic.totalPages;
  const hStart = heuristic.primarySpan?.start ?? 1;
  const hEnd = heuristic.primarySpan?.end ?? totalPages;
  const aiStart = clampPage(Number(aiVerdict?.sustainabilityStartPage), 1, totalPages);
  const aiEnd = clampPage(Number(aiVerdict?.sustainabilityEndPage), 1, totalPages);

  let start = aiStart ?? hStart;
  let end = aiEnd ?? hEnd;
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  return { start, end };
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

  let form;
  try {
    form = await context.request.formData();
  } catch {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Expected multipart/form-data");
  }

  const filePart = form.get("file");
  if (!(filePart instanceof File)) {
    return errorResponse(400, ErrorCode.MISSING_PARAM, "Missing file field");
  }

  const fileName = safeString(filePart.name).trim();
  const contentType = safeString(filePart.type).trim().toLowerCase();
  if (!fileName || !/\.pdf$/i.test(fileName)) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Only .pdf uploads are allowed");
  }
  if (contentType && contentType !== "application/pdf") {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Unsupported file content type (expected application/pdf)");
  }

  if (filePart.size < MIN_UPLOAD_BYTES || filePart.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      413,
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Invalid file size. Allowed range: ${Math.floor(MIN_UPLOAD_BYTES / 1024)}KB to ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`
    );
  }

  const fileBytes = await filePart.arrayBuffer();
  if (!isLikelyPdfBytes(fileBytes)) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Uploaded file does not appear to be a valid PDF");
  }

  const maxPagesEnv = Number.parseInt(safeString(context.env?.INGEST_MAX_UPLOAD_PAGES), 10);
  const maxUploadPages =
    Number.isFinite(maxPagesEnv) && maxPagesEnv >= 10
      ? Math.min(2000, Math.max(10, maxPagesEnv))
      : MAX_UPLOAD_PAGES_DEFAULT;
  const pageCount = await readPdfPageCount(fileBytes);
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Unable to read PDF page count");
  }
  if (pageCount > maxUploadPages) {
    return errorResponse(
      413,
      ErrorCode.PAYLOAD_TOO_LARGE,
      `PDF has too many pages (${pageCount}). Max allowed is ${maxUploadPages}.`
    );
  }

  const sha256 = await sha256Hex(fileBytes);

  const conversion = await convertPdfToMarkdown({
    ai: context.env.AI,
    pdfBlob: new Blob([fileBytes], { type: "application/pdf" }),
    name: fileName || "upload.pdf",
  });
  if (!conversion.ok || !conversion.markdown) {
    return errorResponse(
      422,
      ErrorCode.PDF_CONVERSION_ERROR,
      safeString(conversion.error || "Unable to extract text from PDF")
    );
  }

  const markdown = safeString(conversion.markdown).slice(0, MAX_MARKDOWN_CHARS_FOR_ANALYSIS);
  if (markdown.trim().length < MIN_MARKDOWN_CHARS) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Extracted PDF text is too small for ingestion");
  }
  const pages = splitMarkdownIntoPages(markdown);
  if (pages.length === 0) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Could not extract readable page text from PDF");
  }
  if (pages.length > maxUploadPages) {
    return errorResponse(
      413,
      ErrorCode.PAYLOAD_TOO_LARGE,
      `PDF page markers exceed allowed limit (${pages.length}/${maxUploadPages}).`
    );
  }

  const heuristic = analyzeSustainabilityPages(pages);
  const classifierModel = safeString(context.env.INGEST_CLASSIFIER_MODEL || CLASSIFIER_MODEL_DEFAULT).trim() || CLASSIFIER_MODEL_DEFAULT;
  const metadataModel = safeString(context.env.INGEST_METADATA_MODEL || METADATA_MODEL_DEFAULT).trim() || METADATA_MODEL_DEFAULT;

  let classifier = null;
  try {
    classifier = await classifyReportWithAi({
      ai: context.env.AI,
      model: classifierModel,
      totalPages: heuristic.totalPages,
      heuristic,
    });
  } catch {
    classifier = null;
  }

  const aiSaysSustainability = classifier?.isSustainabilityReport === true;
  const aiConfidence = Number.isFinite(classifier?.confidence) ? Number(classifier.confidence) : null;
  const isSustainabilityReport =
    heuristic.isSustainabilityByHeuristic ||
    (aiSaysSustainability && (aiConfidence == null || aiConfidence >= 0.55));

  let metadataSuggestion = null;
  try {
    metadataSuggestion = await suggestMetadataWithAi({
      ai: context.env.AI,
      model: metadataModel,
      fileName: fileName || "upload.pdf",
      totalPages: heuristic.totalPages,
      heuristic,
      classifier,
      pages,
    });
  } catch {
    metadataSuggestion = null;
  }

  const fallbackYear = new Date().getUTCFullYear() - 1;
  const companyFallback = safeString(filePart.name || "Unknown Company").replace(/\.pdf$/i, "");
  const metadata = {
    company: safeString(metadataSuggestion?.company || companyFallback).trim() || "Unknown Company",
    publishedYear: Number.isFinite(metadataSuggestion?.publishedYear) ? Number(metadataSuggestion.publishedYear) : fallbackYear,
    country: safeString(metadataSuggestion?.country || "Unknown").trim() || "Unknown",
    sector: safeString(metadataSuggestion?.sector || "Information Technology").trim() || "Information Technology",
    industry: safeString(metadataSuggestion?.industry || "Software & Services").trim() || "Software & Services",
    sourceSector: safeString(metadataSuggestion?.sourceSector || "").trim(),
    sourceIndustry: safeString(metadataSuggestion?.sourceIndustry || "").trim(),
    confidence: Number.isFinite(metadataSuggestion?.confidence) ? Math.max(0, Math.min(1, Number(metadataSuggestion.confidence))) : 0.5,
    reason: safeString(metadataSuggestion?.reason || "").trim(),
  };

  const suggestedRange = chooseSuggestedRange(classifier, heuristic);
  const inferredFullUpload =
    safeString(classifier?.reportType).toLowerCase() === "annual-with-sustainability-section" ||
    (!heuristic.looksLikeSustainabilityOnly && heuristic.totalPages >= 30);

  // Duplicate precheck for UX feedback.
  const slugBase = slugifyCompanyName(metadata.company);
  const companyYearPrefix = slugBase ? `reports/${metadata.publishedYear}/${slugBase}/` : "";
  const existingForCompanyYear = companyYearPrefix
    ? await bucket.list({ prefix: companyYearPrefix, limit: 5 })
    : { objects: [] };
  const existingKeys = (existingForCompanyYear.objects || [])
    .map((o) => safeString(o?.key).trim())
    .filter(Boolean)
    .slice(0, 3);
  const existingKey = existingKeys[0] || "";
  const existingRoute = slugBase ? `/reports/${slugBase}-${metadata.publishedYear}` : "";
  const uploadedRecords = await listUploadedReportRecords(bucket, { limit: 2000 });
  const duplicateHash = uploadedRecords.some((r) => safeString(r?.file?.sha256).toLowerCase() === sha256.toLowerCase());
  const duplicateLikely = duplicateHash || existingKeys.length > 0;

  const token = makeToken();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + STAGING_TTL_MS).toISOString();

  const stagePayload = {
    version: 1,
    token,
    createdAt,
    expiresAt,
    file: {
      name: fileName || "",
      size: filePart.size,
      contentType: filePart.type || "application/pdf",
      sha256,
    },
    requestFingerprint: {
      ipHash: requestFingerprint.ipHash,
      uaHash: requestFingerprint.uaHash,
      host: requestFingerprint.host,
      originHost: requestFingerprint.originHost,
      refererHost: requestFingerprint.refererHost,
    },
    analysis: {
      isSustainabilityReport,
      reportType: safeString(classifier?.reportType || ""),
      classifierConfidence: Number.isFinite(classifier?.confidence) ? Number(classifier.confidence) : null,
      classifierReason: safeString(classifier?.reason || ""),
      totalPages: heuristic.totalPages,
      looksLikeSustainabilityOnly: heuristic.looksLikeSustainabilityOnly,
      suggestedRange,
      inferredFullUpload,
      heuristic: {
        rawScore: heuristic.rawScore,
        candidatePages: heuristic.candidatePages,
        hitBreadth: heuristic.hitBreadth,
        primarySpan: heuristic.primarySpan || null,
      },
    },
    metadataSuggestion: metadata,
    duplicateCheck: {
      duplicateLikely,
      duplicateHash,
      existingCompanyYear: existingKeys.length > 0,
      companyYearPrefix,
      existingKey,
      existingKeys,
      existingRoute,
    },
  };

  await bucket.put(stagingPdfKey(token), fileBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { source: "upload-staging", token, createdAt, expiresAt },
  });
  await putTextSafe(bucket, stagingMarkdownKey(token), markdown, "text/markdown; charset=utf-8", `staging markdown ${token}`);
  await putJsonSafe(bucket, stagingMetaKey(token), stagePayload, `staging meta ${token}`);

  return new Response(
    JSON.stringify({
      ok: true,
      token,
      createdAt,
      expiresAt,
      isSustainabilityReport,
      metadataSuggestion: metadata,
      suggestedRange,
      inferredFullUpload,
      duplicateCheck: stagePayload.duplicateCheck,
      classifier: {
        reportType: stagePayload.analysis.reportType,
        confidence: stagePayload.analysis.classifierConfidence,
        reason: stagePayload.analysis.classifierReason,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
