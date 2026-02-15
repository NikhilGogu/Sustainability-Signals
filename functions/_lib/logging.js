// ─── Structured logging ─────────────────────────────────────────────────────
// Provides request-scoped structured JSON logging with request IDs.

import { safeString } from "./utils.js";

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp
 * @property {string} level
 * @property {string} requestId
 * @property {string} [endpoint]
 * @property {string} message
 * @property {Object} [data]
 * @property {number} [durationMs]
 */

/**
 * Create a structured logger with request context.
 *
 * @param {{ requestId: string; endpoint?: string }} ctx
 * @returns {{ info: Function; warn: Function; error: Function; debug: Function; child: Function }}
 */
export function createLogger({ requestId, endpoint }) {
  const base = { requestId, endpoint };

  function emit(level, message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...base,
      message: safeString(message),
    };
    if (data !== undefined && data !== null) {
      entry.data = data;
    }

    // Workers runtime captures console output as structured logs.
    switch (level) {
      case "error":
        console.error(JSON.stringify(entry));
        break;
      case "warn":
        console.warn(JSON.stringify(entry));
        break;
      case "debug":
        console.debug(JSON.stringify(entry));
        break;
      default:
        console.log(JSON.stringify(entry));
    }

    return entry;
  }

  return {
    info:  (msg, data) => emit("info",  msg, data),
    warn:  (msg, data) => emit("warn",  msg, data),
    error: (msg, data) => emit("error", msg, data),
    debug: (msg, data) => emit("debug", msg, data),

    /**
     * Create a child logger with additional context.
     * @param {Object} extra - Additional fields to merge into log entries.
     */
    child(extra) {
      return createLogger({ ...base, ...extra });
    },
  };
}

/**
 * Generate a unique request ID.
 * Uses crypto.randomUUID() when available, falls back to timestamp+random.
 * @returns {string}
 */
export function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
