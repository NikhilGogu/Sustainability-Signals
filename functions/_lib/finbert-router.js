// ─── FinBERT-ESG-9 Router via HTTP service ──────────────────────────
// Shared module: calls the REAL yiyanghkust/finbert-esg-9-categories model
// running as an external HTTP service (Azure Container Apps, etc.).
//
// The service runs an inference server at port 8080 with:
//   POST /classify  — { inputs: ["text1", ...] } → [[{label, score}, ...], ...]
//   GET  /health    — readiness check
//
// Usage:
//   import { classifyChunks, classifyChunk, CATEGORY_TO_PILLAR } from "../_lib/finbert-router.js";
//   const results = await classifyChunks(chunks, { baseUrl: env.FINBERT_URL, apiKey: env.FINBERT_API_KEY });
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_NAME = "yiyanghkust/finbert-esg-9-categories";

// ── FinBERT-9 category → E/S/G pillar mapping ─────────────────────────────
export const CATEGORY_TO_PILLAR = {
    "Climate Change": "E",
    "Natural Capital": "E",
    "Pollution & Waste": "E",
    "Human Capital": "S",
    "Product Liability": "S",
    "Community Relations": "S",
    "Corporate Governance": "G",
    "Business Ethics & Values": "G",
    "Non-ESG": null,
};

// All 9 category labels the model can return
export const ALL_CATEGORIES = Object.keys(CATEGORY_TO_PILLAR);

// ── Container API caller ───────────────────────────────────────────────────
// Sends classification requests to the FinBERT container running alongside
// the Worker. The container exposes POST /classify which accepts
// { inputs: [...] } and returns [[{label, score}, ...], ...].

/**
 * Call FinBERT for text classification.
 * Supports:
 * - Cloudflare service binding to a Container DO stub (env.FINBERT_CONTAINER)
 * - Plain HTTP endpoint (FINBERT_URL), useful for local Docker dev
 * @param {object|undefined} container - Container Durable Object stub (env.FINBERT_CONTAINER)
 * @param {string|undefined} baseUrl - e.g. http://localhost:8080
 * @param {string[]} inputs - array of texts to classify
 * @param {number} [timeoutMs=30000] - request timeout
 * @returns {Promise<Array<Array<{label: string, score: number}>>>} - classification results
 */
async function callFinBERT({ container, baseUrl, apiKey }, inputs, { timeoutMs = 30000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const hasBaseUrl = typeof baseUrl === "string" && baseUrl.trim().length > 0;
        if (hasBaseUrl) {
            let url;
            try {
                url = new URL("/classify", baseUrl.trim()).toString();
            } catch {
                throw new Error(`Invalid FINBERT_URL: ${baseUrl}`);
            }

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(apiKey ? { "x-api-key": apiKey } : {}),
                },
                body: JSON.stringify({ inputs }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`FinBERT HTTP error ${res.status}: ${errText.slice(0, 300)}`);
            }

            const data = await res.json();
            // data is [[{label, score}, ...], ...] — one array per input text
            return data;
        }

        if (!container) throw new Error("FINBERT_CONTAINER binding or FINBERT_URL is required");

        const res = await container.fetch("http://container/classify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { "x-api-key": apiKey } : {}),
            },
            body: JSON.stringify({ inputs }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new Error(`Container error ${res.status}: ${errText.slice(0, 300)}`);
        }

        const data = await res.json();
        // data is [[{label, score}, ...], ...] — one array per input text
        return data;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Truncate text to fit BERT's 512 token limit (~1500 chars is safe).
 * We take the first ~1200 chars to stay well within limits.
 */
function truncateForBERT(text, maxChars = 1200) {
    if (!text || typeof text !== "string") return "";
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= maxChars) return clean;
    // Try to cut at a sentence boundary
    const cutPoint = clean.lastIndexOf(". ", maxChars);
    if (cutPoint > maxChars * 0.6) return clean.slice(0, cutPoint + 1);
    return clean.slice(0, maxChars);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify a single text chunk via the container.
 * @param {string} text
 * @param {object} opts
 * @param {object} opts.container - Container Durable Object stub
 * @param {string} [opts.baseUrl] - Optional FinBERT HTTP endpoint (FINBERT_URL)
 * @param {string} [opts.apiKey] - Optional API key sent as x-api-key (FINBERT_API_KEY)
 * @returns {Promise<{category: string, pillar: string|null, score: number, allScores: Array<{label: string, score: number}>}>}
 */
export async function classifyChunk(text, { container, baseUrl, apiKey } = {}) {
    const truncated = truncateForBERT(text);
    if (!truncated) {
        return { category: "Non-ESG", pillar: null, score: 0, allScores: [] };
    }

    const results = await callFinBERT({ container, baseUrl, apiKey }, [truncated]);
    const scores = results[0] || [];

    // Find the top-scoring label
    let best = { label: "Non-ESG", score: 0 };
    for (const s of scores) {
        if (s.score > best.score) best = s;
    }

    return {
        category: best.label,
        pillar: CATEGORY_TO_PILLAR[best.label] ?? null,
        score: best.score,
        allScores: scores,
    };
}

/**
 * Classify multiple text chunks in batches via the container.
 * The container supports batches up to 32 texts per request.
 * @param {string[]} texts
 * @param {object} opts
 * @param {object} opts.container - Container Durable Object stub
 * @param {string} [opts.baseUrl] - Optional FinBERT HTTP endpoint (FINBERT_URL)
 * @param {string} [opts.apiKey] - Optional API key sent as x-api-key (FINBERT_API_KEY)
 * @param {number} [opts.batchSize=16] - texts per container API call
 * @param {number} [opts.concurrency=2] - parallel container calls
 * @param {number} [opts.minScore=0.3] - min confidence to consider ESG (below = Non-ESG)
 * @returns {Promise<Array<{index: number, category: string, pillar: string|null, score: number, isESG: boolean, allScores: Array<{label: string, score: number}>}>>}
 */
export async function classifyChunks(texts, { container, baseUrl, apiKey, batchSize = 16, concurrency = 2, minScore = 0.3 } = {}) {
    if (!texts || texts.length === 0) return [];

    const truncated = texts.map((t) => truncateForBERT(t));
    const results = new Array(texts.length);

    // Process in batches
    const batches = [];
    for (let i = 0; i < truncated.length; i += batchSize) {
        batches.push({ startIdx: i, texts: truncated.slice(i, i + batchSize) });
    }

    // Run batches with concurrency limit
    for (let bStart = 0; bStart < batches.length; bStart += concurrency) {
        const batchGroup = batches.slice(bStart, bStart + concurrency);
        const batchResults = await Promise.all(
            batchGroup.map(async (batch) => {
                try {
                    const apiResults = await callFinBERT({ container, baseUrl, apiKey }, batch.texts);
                    return { batch, apiResults };
                } catch (err) {
                    console.error(`[finbert-router] container batch at index ${batch.startIdx} failed:`, err?.message || err);
                    return { batch, apiResults: null, error: err };
                }
            })
        );

        for (const { batch, apiResults, error } of batchResults) {
            for (let j = 0; j < batch.texts.length; j++) {
                const globalIdx = batch.startIdx + j;

                if (error || !apiResults || !apiResults[j]) {
                    // Fallback: mark as unknown/error
                    results[globalIdx] = {
                        index: globalIdx,
                        category: "Non-ESG",
                        pillar: null,
                        score: 0,
                        isESG: false,
                        allScores: [],
                        error: error?.message || "Container call failed",
                    };
                    continue;
                }

                const scores = apiResults[j];
                let best = { label: "Non-ESG", score: 0 };
                for (const s of scores) {
                    if (s.score > best.score) best = s;
                }

                const isNonESG = best.label === "Non-ESG" || best.score < minScore;

                results[globalIdx] = {
                    index: globalIdx,
                    category: isNonESG ? "Non-ESG" : best.label,
                    pillar: isNonESG ? null : (CATEGORY_TO_PILLAR[best.label] ?? null),
                    score: best.score,
                    isESG: !isNonESG,
                    allScores: scores,
                };
            }
        }
    }

    return results;
}

/**
 * Build routing summary from classification results.
 * @param {Array<{category: string, pillar: string|null, isESG: boolean}>} results
 * @returns {{ model: string, total_chunks: number, routed_chunks: number, skipped_chunks: number, by_pillar: {E: number, S: number, G: number}, by_category: Record<string, number>, efficiency_pct: number }}
 */
export function buildRoutingSummary(results) {
    const total = results.length;
    const routed = results.filter((r) => r.isESG);
    const skipped = total - routed.length;
    const byPillar = { E: 0, S: 0, G: 0 };
    const byCategory = {};

    for (const r of routed) {
        if (r.pillar) byPillar[r.pillar]++;
        byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    }

    return {
        model: MODEL_NAME,
        total_chunks: total,
        routed_chunks: routed.length,
        skipped_chunks: skipped,
        by_pillar: byPillar,
        by_category: byCategory,
        efficiency_pct: total > 0 ? Math.round((skipped / total) * 100) : 0,
    };
}
