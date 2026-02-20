// ─── Authentication (API key removed) ──────────────────────────────────────────────
// API key authentication has been removed. All endpoints are now
// protected only by the admin password gate on the client side.
// The functions below are kept as stubs for backward compatibility.

/**
 * Stub: always returns valid (no API key required).
 * @returns {{ valid: boolean; source: string }}
 */
export function validateApiKey() {
  return { valid: true, source: "none_required" };
}

/**
 * Stub: no-op middleware (API key check removed).
 */
export function authMiddleware() {
  return () => {};
}
