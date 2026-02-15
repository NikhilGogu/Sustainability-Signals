// ─── Structured API error types ─────────────────────────────────────────────
// Provides typed error codes so frontends can programmatically handle failures.

/**
 * @typedef {Object} ApiErrorBody
 * @property {string} error       - Human-readable error message
 * @property {string} code        - Machine-readable error code
 * @property {string} [requestId] - Correlation ID for debugging
 * @property {Object} [details]   - Additional error-specific data
 */

/** @enum {string} */
export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST:          "BAD_REQUEST",
  INVALID_REPORT_ID:    "INVALID_REPORT_ID",
  MISSING_PARAM:        "MISSING_PARAM",
  INVALID_JSON:         "INVALID_JSON",
  METHOD_NOT_ALLOWED:   "METHOD_NOT_ALLOWED",
  UNAUTHORIZED:         "UNAUTHORIZED",
  FORBIDDEN:            "FORBIDDEN",
  NOT_FOUND:            "NOT_FOUND",
  RATE_LIMITED:         "RATE_LIMITED",
  PAYLOAD_TOO_LARGE:    "PAYLOAD_TOO_LARGE",

  // Server errors (5xx)
  INTERNAL_ERROR:       "INTERNAL_ERROR",
  BINDING_MISSING:      "BINDING_MISSING",
  R2_ERROR:             "R2_ERROR",
  AI_ERROR:             "AI_ERROR",
  AI_CONTEXT_OVERFLOW:  "AI_CONTEXT_OVERFLOW",
  PDF_CONVERSION_ERROR: "PDF_CONVERSION_ERROR",
  CACHE_CORRUPT:        "CACHE_CORRUPT",
};

/**
 * Create a structured JSON error response.
 *
 * @param {number} status - HTTP status code
 * @param {string} code   - ErrorCode enum value
 * @param {string} message - Human-readable message
 * @param {{ requestId?: string; details?: Object; headers?: Record<string,string> }} [opts]
 * @returns {Response}
 */
export function errorResponse(status, code, message, opts = {}) {
  /** @type {ApiErrorBody} */
  const body = {
    error: message,
    code,
  };
  if (opts.requestId) body.requestId = opts.requestId;
  if (opts.details)   body.details   = opts.details;

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Wrap a handler to catch unhandled exceptions and return structured error responses.
 *
 * @param {Function} handler - The async request handler
 * @param {{ requestId?: string; corsHeaders?: Record<string,string> }} [opts]
 * @returns {Function}
 */
export function withErrorHandling(handler, opts = {}) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      const code = msg.includes("5021") || msg.toLowerCase().includes("context window")
        ? ErrorCode.AI_CONTEXT_OVERFLOW
        : ErrorCode.INTERNAL_ERROR;

      return errorResponse(500, code, msg, {
        requestId: opts.requestId || context._requestId,
        headers: opts.corsHeaders,
      });
    }
  };
}
