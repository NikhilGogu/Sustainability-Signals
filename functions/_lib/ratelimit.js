// ─── Rate limiting ──────────────────────────────────────────────────────────
// Simple in-memory sliding-window rate limiter.
// NOTE: This is per-isolate, not globally distributed. It protects against
// burst abuse from a single edge location. For stronger guarantees, use
// Cloudflare Rate Limiting rules in the dashboard.

/**
 * @typedef {Object} RateLimitEntry
 * @property {number[]} timestamps
 */

const DEFAULT_WINDOW_MS = 60_000;      // 1 minute
const DEFAULT_MAX_REQUESTS = 60;       // 60 requests per window
const CLEANUP_INTERVAL = 120_000;      // Cleanup stale entries every 2 minutes
const MAX_TRACKED_KEYS = 10_000;       // Prevent unbounded memory growth

/** @type {Map<string, RateLimitEntry>} */
const _buckets = new Map();
let _lastCleanup = Date.now();

/**
 * Clean up expired entries to prevent memory leaks.
 * @param {number} windowMs
 */
function cleanup(windowMs) {
  const now = Date.now();
  if (now - _lastCleanup < CLEANUP_INTERVAL) return;
  _lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of _buckets.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) _buckets.delete(key);
  }
  // Hard cap on tracked keys (evict oldest if needed)
  if (_buckets.size > MAX_TRACKED_KEYS) {
    const keys = [..._buckets.keys()];
    for (let i = 0; i < keys.length - MAX_TRACKED_KEYS; i++) {
      _buckets.delete(keys[i]);
    }
  }
}

/**
 * Check and consume a rate limit token.
 *
 * @param {string} key       - Unique identifier (e.g. IP or IP+endpoint)
 * @param {{ windowMs?: number; maxRequests?: number }} [opts]
 * @returns {{ allowed: boolean; remaining: number; resetMs: number }}
 */
export function checkRateLimit(key, { windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS } = {}) {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = _buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    _buckets.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0] || now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Derive a rate limit key from the request.
 * Uses CF-Connecting-IP (edge), then X-Forwarded-For, then falls back to "unknown".
 *
 * @param {Request} request
 * @param {string} [suffix] - Optional suffix to namespace by endpoint
 * @returns {string}
 */
export function rateLimitKey(request, suffix) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

/**
 * Build rate limit response headers.
 * @param {{ remaining: number; resetMs: number; maxRequests?: number }} info
 * @returns {Record<string, string>}
 */
export function rateLimitHeaders(info, maxRequests) {
  return {
    "X-RateLimit-Limit": String(maxRequests || DEFAULT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(0, info.remaining)),
    "X-RateLimit-Reset": String(Math.ceil((Date.now() + info.resetMs) / 1000)),
    "Retry-After": String(Math.ceil(info.resetMs / 1000)),
  };
}
