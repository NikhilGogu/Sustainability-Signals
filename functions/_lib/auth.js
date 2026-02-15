// ─── Authentication middleware ──────────────────────────────────────────────
// Supports API key validation for cost-sensitive endpoints.
// Keys are configured via the API_KEYS environment variable (comma-separated).
// When no API_KEYS are configured, authentication is skipped (open access).

import { safeString } from "./utils.js";
import { ErrorCode, errorResponse } from "./errors.js";

/**
 * Validate the request's API key against allowed keys.
 *
 * The key can be provided via:
 *   1. `Authorization: Bearer <key>` header
 *   2. `X-API-Key: <key>` header
 *   3. `?apiKey=<key>` query parameter (least preferred)
 *
 * @param {Request} request
 * @param {object} env - Worker env bindings
 * @returns {{ valid: boolean; key?: string; source?: string }}
 */
export function validateApiKey(request, env) {
  const configuredKeys = safeString(env?.API_KEYS || "").trim();

  // No keys configured → open access (backwards compatible)
  if (!configuredKeys) {
    return { valid: true, source: "none_required" };
  }

  const allowedKeys = new Set(configuredKeys.split(",").map((k) => k.trim()).filter(Boolean));
  if (allowedKeys.size === 0) {
    return { valid: true, source: "none_required" };
  }

  // 1. Authorization header
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const key = authHeader.slice(7).trim();
    if (allowedKeys.has(key)) return { valid: true, key, source: "bearer" };
    return { valid: false };
  }

  // 2. X-API-Key header
  const apiKeyHeader = request.headers.get("X-API-Key") || "";
  if (apiKeyHeader) {
    if (allowedKeys.has(apiKeyHeader.trim())) return { valid: true, key: apiKeyHeader.trim(), source: "header" };
    return { valid: false };
  }

  // 3. Query parameter (fallback)
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("apiKey") || "";
  if (queryKey) {
    if (allowedKeys.has(queryKey.trim())) return { valid: true, key: queryKey.trim(), source: "query" };
    return { valid: false };
  }

  return { valid: false };
}

/**
 * Create an authentication middleware function.
 *
 * @param {{ corsHeaders?: Record<string,string> }} [opts]
 * @returns {(context: object) => Response|void}
 */
export function authMiddleware(opts = {}) {
  return (context) => {
    const result = validateApiKey(context.request, context.env);
    if (!result.valid) {
      return errorResponse(401, ErrorCode.UNAUTHORIZED, "Invalid or missing API key", {
        requestId: context._requestId,
        headers: { ...opts.corsHeaders, "WWW-Authenticate": 'Bearer realm="api"' },
      });
    }
    // Attach auth info to context for downstream logging
    context._authSource = result.source;
  };
}
