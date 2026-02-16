// AI metadata suggestion + staging endpoint.
// POST /api/reports/suggest-metadata

import { safeString } from "../../_lib/utils.js";
import { ErrorCode, errorResponse } from "../../_lib/errors.js";
import { convertPdfToMarkdown, putJsonSafe, putTextSafe } from "../../_lib/index.js";
import {
  MAX_UPLOAD_BYTES,
  MAX_MARKDOWN_CHARS_FOR_ANALYSIS,
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

const STAGING_PREFIX = "ingest/staging/";
const STAGING_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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
  if (filePart.size <= 0 || filePart.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      413,
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Invalid file size. Max allowed is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`
    );
  }

  const fileBytes = await filePart.arrayBuffer();
  const sha256 = await sha256Hex(fileBytes);

  const conversion = await convertPdfToMarkdown({
    ai: context.env.AI,
    pdfBlob: new Blob([fileBytes], { type: "application/pdf" }),
    name: filePart.name || "upload.pdf",
  });
  if (!conversion.ok || !conversion.markdown) {
    return errorResponse(
      422,
      ErrorCode.PDF_CONVERSION_ERROR,
      safeString(conversion.error || "Unable to extract text from PDF")
    );
  }

  const markdown = safeString(conversion.markdown).slice(0, MAX_MARKDOWN_CHARS_FOR_ANALYSIS);
  const pages = splitMarkdownIntoPages(markdown);
  if (pages.length === 0) {
    return errorResponse(422, ErrorCode.INVALID_REPORT_TYPE, "Could not extract readable page text from PDF");
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
      fileName: filePart.name || "upload.pdf",
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
    ? await bucket.list({ prefix: companyYearPrefix, limit: 1 })
    : { objects: [] };
  const uploadedRecords = await listUploadedReportRecords(bucket, { limit: 2000 });
  const duplicateHash = uploadedRecords.some((r) => safeString(r?.file?.sha256).toLowerCase() === sha256.toLowerCase());
  const duplicateLikely = duplicateHash || (existingForCompanyYear.objects || []).length > 0;

  const token = makeToken();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + STAGING_TTL_MS).toISOString();

  const stagePayload = {
    version: 1,
    token,
    createdAt,
    expiresAt,
    file: {
      name: filePart.name || "",
      size: filePart.size,
      contentType: filePart.type || "application/pdf",
      sha256,
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
      existingCompanyYear: (existingForCompanyYear.objects || []).length > 0,
      companyYearPrefix,
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
