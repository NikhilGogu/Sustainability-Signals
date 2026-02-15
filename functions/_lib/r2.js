// ─── R2 storage helpers ─────────────────────────────────────────────────────
// Shared R2 read/write operations with retry logic and structured error handling.

import { safeString } from "./utils.js";

/**
 * Normalize a report key, enforcing safety constraints.
 * Expected format: "reports/<...>.pdf"
 * @param {string} v
 * @returns {string} Normalized key or empty string if invalid.
 */
export function normalizeReportKey(v) {
  let key = safeString(v).trim();
  if (!key) return "";
  key = key.replace(/^\/+/, "");
  if (key.includes("..")) return "";
  if (!key.startsWith("reports/")) return "";
  // Enforce allowed characters: alphanumeric, forward slash, dash, underscore, dot, space
  if (!/^[a-zA-Z0-9/\-_.() ]+$/.test(key)) return "";
  return key;
}

/**
 * Derive the markdown cache key from a report key.
 * @param {string} reportKey
 * @returns {string}
 */
export function markdownCacheKeyForReportKey(reportKey) {
  const base = safeString(reportKey).replace(/\.pdf$/i, "");
  return `markdown/${base}.md`;
}

/**
 * Derive the markdown metadata key from a report key.
 * @param {string} reportKey
 * @returns {string}
 */
export function markdownMetaKeyForReportKey(reportKey) {
  const base = safeString(reportKey).replace(/\.pdf$/i, "");
  return `markdown/${base}.json`;
}

/**
 * Build a disclosure quality score cache key.
 * @param {string} reportId
 * @param {number} [version=1]
 * @returns {string}
 */
export function disclosureScoreKey(reportId, version) {
  const id = safeString(reportId).trim();
  if (!id) return "";
  const v = Number.isFinite(version) ? version : 1;
  return `scores/disclosure_quality/v${v}/${id}.json`;
}

/**
 * Build a vectorize marker key for a report.
 * @param {string} reportId
 * @returns {string}
 */
export function vectorizeMarkerKeyForReportId(reportId) {
  const id = safeString(reportId).trim();
  if (!id) return "";
  return `vectorize/indexed/${id}.json`;
}

/**
 * Extract the filename from an R2 key.
 * @param {string} key
 * @param {string} [fallback=""]
 * @returns {string}
 */
export function fileNameFromKey(key, fallback = "") {
  const parts = safeString(key).split("/").filter(Boolean);
  const name = parts.length ? parts[parts.length - 1] : "";
  return name || fallback;
}

/**
 * Read text content from an R2 object.
 * @param {R2Bucket} bucket
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getCachedText(bucket, key) {
  if (!bucket || !key) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  try {
    return await obj.text();
  } catch {
    return null;
  }
}

/**
 * Write text content to R2.
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {string} text
 * @param {string} [contentType]
 */
export async function putText(bucket, key, text, contentType) {
  if (!bucket || !key) return;
  await bucket.put(key, text, {
    httpMetadata: { contentType: contentType || "text/plain; charset=utf-8" },
  });
}

/**
 * Write text to R2 with one retry. Logs failures.
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {string} text
 * @param {string} [contentType]
 * @param {string} [label]
 * @param {object} [log] - Structured logger instance
 * @returns {Promise<boolean>}
 */
export async function putTextSafe(bucket, key, text, contentType, label, log) {
  if (!bucket || !key) return false;
  const logger = log || console;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await putText(bucket, key, text, contentType);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[R2] put failed (${label || key}, attempt ${attempt}/2): ${msg}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
    }
  }
  return false;
}

/**
 * Write a JSON value to R2.
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {unknown} value
 */
export async function putJson(bucket, key, value) {
  await putText(bucket, key, JSON.stringify(value, null, 2) + "\n", "application/json; charset=utf-8");
}

/**
 * Write JSON to R2 with one retry. Logs failures.
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {unknown} value
 * @param {string} [label]
 * @param {object} [log]
 * @returns {Promise<boolean>}
 */
export async function putJsonSafe(bucket, key, value, label, log) {
  return putTextSafe(bucket, key, JSON.stringify(value, null, 2) + "\n", "application/json; charset=utf-8", label, log);
}

/**
 * Read cached markdown for a report.
 * @param {{ bucket: R2Bucket; reportKey: string }} opts
 * @returns {Promise<string|null>}
 */
export async function getCachedMarkdown({ bucket, reportKey }) {
  if (!bucket || !reportKey) return null;
  const mdKey = markdownCacheKeyForReportKey(reportKey);
  return getCachedText(bucket, mdKey);
}

/**
 * Write markdown cache and metadata to R2.
 * @param {{ bucket: R2Bucket; reportKey: string; markdown: string; tokens?: number|null; log?: object }} opts
 */
export async function putCachedMarkdown({ bucket, reportKey, markdown, tokens, log }) {
  if (!bucket || !reportKey || !markdown) return;
  const logger = log || console;
  const mdKey = markdownCacheKeyForReportKey(reportKey);
  const metaKey = markdownMetaKeyForReportKey(reportKey);

  const mdOk = await putTextSafe(bucket, mdKey, markdown, "text/markdown; charset=utf-8", `markdown ${reportKey}`, logger);
  if (!mdOk) logger.error(`[R2] Markdown cache for ${reportKey} was NOT persisted`);

  try {
    await putText(bucket, metaKey, JSON.stringify({
      reportKey,
      tokens: typeof tokens === "number" ? tokens : null,
      generatedAt: new Date().toISOString(),
    }), "application/json; charset=utf-8");
  } catch (err) {
    logger.error(`[R2] Markdown meta for ${reportKey} failed: ${err instanceof Error ? err.message : err}`);
  }
}
