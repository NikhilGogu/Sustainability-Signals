// ─── R2 Object Serving Middleware ────────────────────────────────────────────
// Serves report PDFs (and other objects) from R2 with range-request support.
// CORS pre-flight is handled by the global _middleware.js, so we only need to
// validate the key and stream the object.

import { normalizeReportKey } from "../_lib/r2.js";
import { ErrorCode, errorResponse } from "../_lib/errors.js";

export async function onRequest(context) {
  const method = context.request.method;

  // Only GET and HEAD allowed — OPTIONS handled by global middleware.
  if (method !== "GET" && method !== "HEAD") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const url = new URL(context.request.url);
  const pathname = url.pathname || "";

  // Expected: /r2/<key>
  let key = pathname.startsWith("/r2/") ? pathname.slice("/r2/".length) : "";
  key = key.replace(/^\/+/, "");

  if (!key || key.includes("..")) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid key");
  }

  // Hard fence — only objects under reports/ are publicly exposed.
  if (!key.startsWith("reports/")) {
    return errorResponse(404, ErrorCode.NOT_FOUND, "Not found");
  }

  // Enforce safe characters and disallow traversal (defense-in-depth).
  const normalizedKey = normalizeReportKey(key);
  if (!normalizedKey) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid key");
  }
  key = normalizedKey;

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)");
  }

  // ── Range request support ──────────────────────────────────────────────
  const rangeHeader = context.request.headers.get("Range");
  let obj = null;
  let range = null;

  if (rangeHeader) {
    const m = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
    if (m) {
      const start = Number.parseInt(m[1], 10);
      const end = m[2] ? Number.parseInt(m[2], 10) : null;
      if (Number.isFinite(start) && start >= 0) {
        const length =
          end !== null && Number.isFinite(end) && end >= start
            ? end - start + 1
            : undefined;
        try {
          obj = await bucket.get(key, { range: { offset: start, length } });
          range = { start, end, length };
        } catch {
          // Fall back to full read below.
          obj = null;
          range = null;
        }
      }
    }
  }

  if (!obj) {
    obj = await bucket.get(key);
  }
  if (!obj) {
    return errorResponse(404, ErrorCode.NOT_FOUND, "Not found");
  }

  // ── Response headers ───────────────────────────────────────────────────
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || "application/pdf"
  );
  headers.set("Content-Disposition", "inline");
  headers.set("Accept-Ranges", "bytes");

  if (range) {
    const total = obj.size;
    let rangeEnd = range.end;
    if (rangeEnd === null || rangeEnd === undefined) {
      rangeEnd = total ? total - 1 : range.start;
    }
    if (total && rangeEnd >= total) rangeEnd = total - 1;
    headers.set("Content-Range", `bytes ${range.start}-${rangeEnd}/${total}`);
    headers.set("Content-Length", String(Math.max(0, rangeEnd - range.start + 1)));
  } else {
    headers.set("Content-Length", String(obj.size));
  }

  // HEAD — metadata only.
  if (method === "HEAD") {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  return new Response(obj.body, { status: range ? 206 : 200, headers });
}
