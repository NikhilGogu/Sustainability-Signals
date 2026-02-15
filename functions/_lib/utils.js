// ─── Shared utility functions ───────────────────────────────────────────────
// Extracted from chat.js and disclosure-quality.js to eliminate duplication.

/**
 * Safely coerce a value to a string.
 * @param {unknown} v
 * @returns {string}
 */
export function safeString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Safely coerce a value to a boolean.
 * @param {unknown} v
 * @returns {boolean}
 */
export function safeBool(v) {
  if (typeof v === "boolean") return v;
  const s = safeString(v).trim().toLowerCase();
  if (!s) return false;
  return ["1", "true", "yes", "y", "on"].includes(s);
}

/**
 * Parse an integer with bounds clamping.
 * @param {unknown} v
 * @param {number} fallback
 * @param {{ min?: number; max?: number }} [opts]
 * @returns {number}
 */
export function clampInt(v, fallback, { min = 0, max = 1_000_000 } = {}) {
  const n = Number.parseInt(safeString(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * FNV-1a hash for generating stable, non-cryptographic IDs.
 * @param {string} str
 * @returns {string} 8-char hex string
 */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Truncate text from the end, preserving a clean break.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateEnd(text, maxChars) {
  const s = safeString(text);
  if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars).trimEnd() + "\n\n[Truncated]\n";
}

/**
 * Truncate keeping both head and tail of text.
 * @param {string} text
 * @param {number} maxChars
 * @param {number} [headChars=1600]
 * @returns {string}
 */
export function truncateHeadTail(text, maxChars, headChars = 1600) {
  const s = safeString(text);
  if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
  if (s.length <= maxChars) return s;
  const head = Math.max(0, Math.min(headChars, Math.floor(maxChars * 0.4)));
  const tail = Math.max(0, maxChars - head - 32);
  return (
    s.slice(0, head).trimEnd() +
    "\n\n[...truncated...]\n\n" +
    s.slice(Math.max(0, s.length - tail)).trimStart()
  );
}

/**
 * Normalize whitespace to single spaces.
 * @param {string} s
 * @returns {string}
 */
export function normalizeWhitespace(s) {
  return safeString(s).replace(/\s+/g, " ").trim();
}

/**
 * Estimate token count from text (heuristic: ~4 chars/token).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokensFromText(text) {
  const s = safeString(text);
  return Math.ceil(s.length / 4);
}

/**
 * Estimate token count from a messages array.
 * @param {Array<{content?: string}>} msgs
 * @returns {number}
 */
export function estimateTokensFromMessages(msgs) {
  let total = 0;
  for (const m of msgs || []) {
    total += estimateTokensFromText(m?.content || "") + 12;
  }
  return Math.ceil(total * 1.15) + 24;
}

/**
 * Concurrent pool executor.
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<void>} worker
 */
export async function runPool(items, concurrency, worker) {
  const size = Math.max(1, Math.min(Number.isFinite(concurrency) ? concurrency : 1, items.length || 1));
  let next = 0;

  async function runner() {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: size }, () => runner()));
}
