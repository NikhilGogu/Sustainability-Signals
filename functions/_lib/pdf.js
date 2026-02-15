// ─── PDF conversion helpers ─────────────────────────────────────────────────
// Shared Workers AI toMarkdown wrapper.

import { safeString } from "./utils.js";

/**
 * Convert a PDF blob to Markdown using Workers AI toMarkdown().
 * Images are disabled by default to reduce cost and runtime.
 *
 * @param {{ ai: object; pdfBlob: Blob; name: string }} opts
 * @returns {Promise<{ ok: boolean; markdown?: string; tokens?: number|null; error?: string }>}
 */
export async function convertPdfToMarkdown({ ai, pdfBlob, name }) {
  const res = await ai.toMarkdown(
    { name, blob: pdfBlob },
    {
      conversionOptions: {
        pdf: {
          metadata: false,
          images: { convert: false },
        },
      },
    }
  );
  if (!res || typeof res !== "object") {
    return { ok: false, error: "toMarkdown returned empty response" };
  }
  if (res.format === "error") {
    return { ok: false, error: safeString(res.error || "toMarkdown error") };
  }
  return {
    ok: true,
    markdown: safeString(res.data || ""),
    tokens: typeof res.tokens === "number" ? res.tokens : null,
  };
}
