// ─── Global middleware ──────────────────────────────────────────────────────
// Runs on every Pages Functions request. Provides:
//   1. Request ID generation & propagation
//   2. Structured logging context
//   3. CORS handling (origin-restricted)
//   4. Rate limiting
//   5. Request timing
//   6. Global error handling with structured error responses

import { generateRequestId, createLogger } from "./_lib/logging.js";
import { resolveAllowedOrigins, handlePreflight, corsHeaders } from "./_lib/cors.js";
import { checkRateLimit, rateLimitKey, rateLimitHeaders } from "./_lib/ratelimit.js";
import { ErrorCode, errorResponse } from "./_lib/errors.js";
import { safeString } from "./_lib/utils.js";

// ── Endpoint classification ────────────────────────────────────────────────
const HEAVY_ENDPOINTS = ["/chat"];
const WRITE_ENDPOINTS = ["/score/disclosure-quality", "/score/entity-extract"];

function matchesEndpoint(pathname, endpoints) {
  return endpoints.some((ep) => pathname === ep || pathname.startsWith(ep + "/") || pathname.startsWith(ep + "?"));
}

// ── Rate limit presets ─────────────────────────────────────────────────────
const RATE_LIMITS = {
  heavy:          { windowMs: 60_000, maxRequests: 20  },  // /chat: 20 req/min
  write:          { windowMs: 60_000, maxRequests: 30  },  // /score POST: 30 req/min
  read:           { windowMs: 60_000, maxRequests: 120 },  // GET endpoints: 120 req/min
  batch:          { windowMs: 60_000, maxRequests: 20  },  // batch: 20 req/min (was 10)
  ingestSuggest:  { windowMs: 60_000, maxRequests: 6   },  // /suggest-metadata: 6 req/min
  ingestFinalize: { windowMs: 60_000, maxRequests: 12  },  // /ingest: 12 req/min
};

function getRateLimitPreset(pathname, method) {
  if (pathname.includes("disclosure-quality-batch")) return RATE_LIMITS.batch;
  if (pathname === "/api/reports/suggest-metadata" && method === "POST") return RATE_LIMITS.ingestSuggest;
  if (pathname === "/api/reports/ingest" && method === "POST") return RATE_LIMITS.ingestFinalize;
  if (pathname === "/api/reports/uploads" && method === "DELETE") return RATE_LIMITS.write;
  if (matchesEndpoint(pathname, HEAVY_ENDPOINTS)) return RATE_LIMITS.heavy;
  if (method !== "GET" && method !== "HEAD" && matchesEndpoint(pathname, WRITE_ENDPOINTS)) return RATE_LIMITS.write;
  return RATE_LIMITS.read;
}

// ── CORS method map ────────────────────────────────────────────────────────
function getAllowedMethods(pathname) {
  if (pathname.startsWith("/r2/")) return "GET, HEAD, OPTIONS";
  if (pathname === "/api/reports/uploads") return "GET, DELETE, OPTIONS";
  if (pathname === "/api/reports/ingest") return "POST, OPTIONS";
  if (pathname === "/api/reports/suggest-metadata") return "POST, OPTIONS";
  if (pathname.includes("disclosure-quality-batch")) return "POST, OPTIONS";
  if (pathname.includes("disclosure-quality")) return "GET, POST, OPTIONS";
  if (pathname === "/chat") return "POST, OPTIONS";
  if (pathname === "/healthz") return "GET, OPTIONS";
  return "GET, POST, OPTIONS";
}

// ════════════════════════════════════════════════════════════════════════════
// Middleware chain
// ════════════════════════════════════════════════════════════════════════════

async function middleware(context) {
  const start = Date.now();
  const requestId = context.request.headers.get("X-Request-ID") || generateRequestId();
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const method = context.request.method;
  const host = safeString(context.request.headers.get("Host")).toLowerCase().split(":")[0];

  const isAdminHost = host === "admin.sustainabilitysignals.com";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isGetLike = method === "GET" || method === "HEAD";

  if (isGetLike && !isAdminHost && isAdminPath) {
    const target = new URL("https://admin.sustainabilitysignals.com/");
    return Response.redirect(target.toString(), 302);
  }

  if (isGetLike && isAdminHost && isAdminPath) {
    const target = new URL("https://admin.sustainabilitysignals.com/");
    return Response.redirect(target.toString(), 302);
  }

  // Attach context for downstream handlers
  context._requestId = requestId;
  context._startTime = start;
  context._log = createLogger({ requestId, endpoint: pathname });

  // ── 1. CORS ──────────────────────────────────────────────────────────
  const allowedOrigins = resolveAllowedOrigins(context.env);
  const methods = getAllowedMethods(pathname);
  const cors = corsHeaders(context.request, allowedOrigins, { methods });

  // Preflight
  if (method === "OPTIONS") {
    return handlePreflight(context.request, allowedOrigins, { methods });
  }

  // ── 2. Rate limiting ─────────────────────────────────────────────────
  const rlEnabled = context.env?.RATE_LIMIT_DISABLED !== "1";
  if (rlEnabled) {
    const preset = getRateLimitPreset(pathname, method);
    const key = rateLimitKey(context.request, pathname);
    const rl = checkRateLimit(key, preset);

    if (!rl.allowed) {
      context._log.warn("Rate limit exceeded", { key, preset });
      return errorResponse(429, ErrorCode.RATE_LIMITED, "Too many requests. Please try again later.", {
        requestId,
        headers: { ...cors, ...rateLimitHeaders(rl, preset.maxRequests) },
      });
    }

    // Attach rate limit info for response headers
    context._rateLimit = { ...rl, maxRequests: preset.maxRequests };
  }

  // ── 3. Call downstream handler ───────────────────────────────────────
  try {
    let response;
    try {
      response = await context.next();
    } catch (handlerError) {
      // Downstream handler threw — ensure we always return JSON, never an HTML error page
      const msg = handlerError instanceof Error ? handlerError.message : "Unknown error";
      const durationMs = Date.now() - start;

      context._log.error("Handler threw exception", { error: msg, durationMs });

      const lc = msg.toLowerCase();
      const code = lc.includes("5021") || lc.includes("context window")
        ? ErrorCode.AI_CONTEXT_OVERFLOW
        : lc.includes("exceeded") || lc.includes("cpu") || lc.includes("memory") || lc.includes("time limit") || lc.includes("resource")
          ? ErrorCode.AI_ERROR
          : ErrorCode.INTERNAL_ERROR;

      return errorResponse(500, code, msg, {
        requestId,
        headers: cors,
      });
    }

    // Inject standard headers into the response
    const headers = new Headers(response.headers);

    // CORS
    for (const [k, v] of Object.entries(cors)) {
      headers.set(k, v);
    }

    // Request ID
    headers.set("X-Request-ID", requestId);

    // Rate limit headers
    if (context._rateLimit) {
      const rlHeaders = rateLimitHeaders(context._rateLimit, context._rateLimit.maxRequests);
      for (const [k, v] of Object.entries(rlHeaders)) {
        if (k !== "Retry-After") headers.set(k, v); // Only set Retry-After on 429
      }
    }

    // Timing
    headers.set("Server-Timing", `total;dur=${Date.now() - start}`);

    // Security headers
    headers.set("X-Content-Type-Options", "nosniff");

    // Cache headers for GET score endpoints
    if (method === "GET" && pathname.includes("disclosure-quality") && response.status === 200) {
      if (!headers.has("Cache-Control")) {
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      }
    }

    // Clone with new headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - start;

    context._log.error("Unhandled exception in middleware", { error: msg, durationMs });

    const lc = msg.toLowerCase();
    const code = lc.includes("5021") || lc.includes("context window")
      ? ErrorCode.AI_CONTEXT_OVERFLOW
      : lc.includes("exceeded") || lc.includes("cpu") || lc.includes("memory") || lc.includes("time limit") || lc.includes("resource")
        ? ErrorCode.AI_ERROR
        : ErrorCode.INTERNAL_ERROR;

    return errorResponse(500, code, msg, {
      requestId,
      headers: cors,
    });
  }
}

export const onRequest = [middleware];
