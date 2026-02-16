// ─── CORS configuration ─────────────────────────────────────────────────────
// Centralised CORS headers with origin allowlisting.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://sustainability-signals.pages.dev",
  "https://sustainabilitysignals.com",
  "https://www.sustainabilitysignals.com",
];

// Development origins added when running locally.
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8788",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8788",
];

/**
 * Resolve the ALLOWED_ORIGINS list.
 * In production, only the deployed domains are allowed.
 * The environment variable CORS_ORIGINS can override (comma-separated).
 * The environment variable CORS_ALLOW_ALL can be set to "1" to allow all origins.
 *
 * @param {object} env - Worker env bindings
 * @returns {string[]}
 */
export function resolveAllowedOrigins(env) {
  // Escape hatch: allow all origins (for backwards compat / testing)
  if (env?.CORS_ALLOW_ALL === "1") return ["*"];

  // Custom override
  const custom = typeof env?.CORS_ORIGINS === "string" ? env.CORS_ORIGINS : "";
  if (custom.trim()) {
    return custom.split(",").map((o) => o.trim()).filter(Boolean);
  }

  // Default: production + dev when running locally
  const isDev = typeof env?.CF_PAGES !== "string"; // CF_PAGES is set in production
  return isDev
    ? [...DEFAULT_ALLOWED_ORIGINS, ...DEV_ORIGINS]
    : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Check whether a request origin is allowed.
 * @param {string} origin
 * @param {string[]} allowedOrigins
 * @returns {boolean}
 */
export function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  if (allowedOrigins.includes("*")) return true;
  // Allow any *.pages.dev subdomain for preview deployments
  if (/^https:\/\/[a-z0-9-]+\.sustainability-signals\.pages\.dev$/i.test(origin)) return true;
  return allowedOrigins.includes(origin);
}

/**
 * Build CORS headers for a response.
 * @param {Request} request
 * @param {string[]} allowedOrigins
 * @param {{ methods?: string; headers?: string; maxAge?: number }} [opts]
 * @returns {Record<string, string>}
 */
export function corsHeaders(request, allowedOrigins, opts = {}) {
  const origin = request.headers.get("Origin") || "";
  const allowed = isOriginAllowed(origin, allowedOrigins);

  const headers = {};
  headers["Access-Control-Allow-Origin"] = allowed ? origin : allowedOrigins[0] || "";
  headers["Access-Control-Allow-Methods"] = opts.methods || "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = opts.headers || "Content-Type, Authorization, X-API-Key, X-Request-ID";
  headers["Access-Control-Max-Age"] = String(opts.maxAge ?? 86400);

  if (allowed && origin && !allowedOrigins.includes("*")) {
    headers["Vary"] = "Origin";
  }

  return headers;
}

/**
 * Handle an OPTIONS preflight request.
 * @param {Request} request
 * @param {string[]} allowedOrigins
 * @param {{ methods?: string }} [opts]
 * @returns {Response}
 */
export function handlePreflight(request, allowedOrigins, opts = {}) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, allowedOrigins, opts),
  });
}
