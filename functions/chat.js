// ─── Chat endpoint ──────────────────────────────────────────────────────────
// Grounded Q&A over sustainability reports using Workers AI + Vectorize.
// Refactored to use shared library modules and module-scoped helpers.

import {
  safeString,
  clampInt,
  fnv1a,
  truncateEnd,
  truncateHeadTail,
  estimateTokensFromMessages,
  normalizeReportKey,
  markdownCacheKeyForReportKey,
  markdownMetaKeyForReportKey,
  vectorizeMarkerKeyForReportId,
  fileNameFromKey,
  getCachedMarkdown,
  putCachedMarkdown,
  convertPdfToMarkdown,
} from "./_lib/index.js";

import { ErrorCode, errorResponse } from "./_lib/errors.js";
import { validateJsonBody } from "./_lib/validation.js";

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_HISTORY         = 12;
const MIN_HISTORY         = 4;
const MAX_MESSAGE_CHARS   = 10_000;
const MAX_CONTEXT_MSG     = 14_000;
const TARGET_MIN_OUTPUT   = 256;
const ABS_MIN_OUTPUT      = 64;
const EMBEDDING_BATCH     = 24;
const VECTORIZE_TOP_K     = 8;
const MAX_RETRIEVED_CHARS = 18_000;
const MAX_CHUNK_CHARS     = 1200;
const CHUNK_OVERLAP       = 150;

// In-memory set to prevent concurrent background ingestion for the same reportId
// within a single Worker isolate. Not a global lock — prevents duplicate work in
// rapid successive /chat calls.
const _ingestionInFlight = new Set();

// ── Module-scoped helper functions ──────────────────────────────────────────

function parsePagesFromContext(pdfContext) {
  const text = safeString(pdfContext);
  const re = /Page\s+(\d+):\s*\n/g;
  const matches = Array.from(text.matchAll(re));
  if (matches.length === 0) {
    const trimmed = text.trim();
    return trimmed ? [{ page: null, text: trimmed }] : [];
  }

  const pages = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const pageNum = Number.parseInt(m[1], 10);
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const pageText = text.slice(start, end).trim();
    if (pageText) pages.push({ page: Number.isFinite(pageNum) ? pageNum : null, text: pageText });
  }
  return pages;
}

function chunkText(text, { maxChars = MAX_CHUNK_CHARS, overlapChars = CHUNK_OVERLAP } = {}) {
  const s = safeString(text).replace(/\s+/g, " ").trim();
  if (!s) return [];
  if (s.length <= maxChars) return [s];

  const chunks = [];
  let start = 0;
  while (start < s.length) {
    let end = Math.min(s.length, start + maxChars);
    const splitAt = s.lastIndexOf(" ", end);
    if (splitAt > start + Math.floor(maxChars * 0.6)) end = splitAt;

    const chunk = s.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= s.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}

function pickLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && (m.role === "user" || m.role == null) && safeString(m.content).trim()) {
      return safeString(m.content).trim();
    }
  }
  return "";
}

function normalizeChatMessages(messages, { maxMessageChars }) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = safeString(m?.content || "").trim();
    if (!content) continue;
    out.push({ role, content: truncateEnd(content, maxMessageChars) });
  }
  return out;
}

function buildSystemPrompt({ metaLine }) {
  return (
    "You are an assistant helping a user analyze a sustainability report.\n\n" +
    metaLine +
    "\n\n" +
    "You may receive additional messages labeled \"Viewer context\" and \"Semantic excerpts\" that contain extracted text from the report. Treat them as reference context.\n" +
    "Use ONLY the provided report text in those context messages. Do not use outside knowledge.\n" +
    "Do not invent facts, numbers, quotes, or page references. Only cite a page number if it appears in the provided context.\n" +
    "If the answer is not supported by the provided context, say you cannot find it in the provided report text and ask the user to scroll to the relevant section or try again after indexing finishes.\n" +
    "Some context may be truncated to fit the model's context window."
  );
}

function buildContextMessages({ pdfContext, retrieved, maxMessageChars }) {
  const out = [];

  const viewer = safeString(pdfContext).trim();
  if (viewer) {
    const prefix = "Viewer context (extracted text):\n";
    const bodyMax = Math.max(0, maxMessageChars - prefix.length);
    out.push({ role: "user", content: prefix + truncateHeadTail(viewer, bodyMax, 1600) });
  }

  const excerpts = safeString(retrieved).trim();
  if (excerpts) {
    const prefix = "Semantic excerpts (Vectorize):\n";
    const bodyMax = Math.max(0, maxMessageChars - prefix.length);
    out.push({ role: "user", content: prefix + truncateEnd(excerpts, bodyMax) });
  }

  return out;
}

function prepareAiRunPayload({
  rawMessages,
  metaLine,
  pdfContext,
  retrieved,
  contextWindow,
  desiredMaxTokens,
  safetyTokens,
}) {
  let pdfMaxChars = 12_000;
  let retrievedMaxChars = 8_000;
  let historyLimit = MAX_HISTORY;

  const normalized = normalizeChatMessages(rawMessages, { maxMessageChars: MAX_MESSAGE_CHARS });

  for (let i = 0; i < 14; i++) {
    const minOut = i < 7 ? TARGET_MIN_OUTPUT : ABS_MIN_OUTPUT;

    const pdfTrimmed = truncateHeadTail(pdfContext, pdfMaxChars, 1600);
    const retrievedTrimmed = truncateEnd(retrieved, retrievedMaxChars);
    const history = normalized.slice(-historyLimit);

    const system = buildSystemPrompt({ metaLine });
    const ctxMessages = buildContextMessages({
      pdfContext: pdfTrimmed,
      retrieved: retrievedTrimmed,
      maxMessageChars: MAX_CONTEXT_MSG,
    });
    const chatMessages = [{ role: "system", content: system }, ...ctxMessages, ...history];

    const estInput = estimateTokensFromMessages(chatMessages);
    const available = contextWindow - safetyTokens - estInput;

    if (available >= minOut) {
      return { chatMessages, maxTokens: Math.min(desiredMaxTokens, available) };
    }

    // Reduce payload in priority order
    if (pdfMaxChars > 4_000) {
      pdfMaxChars = Math.max(4_000, Math.floor(pdfMaxChars * 0.75));
      continue;
    }
    if (retrievedMaxChars > 2_000) {
      retrievedMaxChars = Math.max(2_000, Math.floor(retrievedMaxChars * 0.75));
      continue;
    }
    if (historyLimit > MIN_HISTORY) {
      historyLimit = Math.max(MIN_HISTORY, Math.floor(historyLimit * 0.75));
      continue;
    }

    pdfMaxChars = 0;
    retrievedMaxChars = 0;
    historyLimit = MIN_HISTORY;
  }

  const system = buildSystemPrompt({ metaLine });
  const history = normalizeChatMessages(rawMessages, { maxMessageChars: 4_000 }).slice(-4);
  return { chatMessages: [{ role: "system", content: system }, ...history], maxTokens: Math.min(desiredMaxTokens, 256) };
}

async function embedText(ai, model, text, pooling) {
  const out = await ai.run(model, { text, pooling });
  if (out && typeof out === "object" && Array.isArray(out.data)) return out.data;
  return null;
}

async function queryVectorIndex({ ai, vectorIndex, reportId, question, embeddingModel, pooling }) {
  if (!vectorIndex || !ai || !reportId || !question) return "";

  const embedded = await embedText(ai, embeddingModel, question, pooling);
  const vector = Array.isArray(embedded) && Array.isArray(embedded[0]) ? embedded[0] : null;
  if (!vector) return "";

  const res = await vectorIndex.query(vector, {
    topK: VECTORIZE_TOP_K,
    namespace: reportId,
    returnMetadata: "all",
  });

  const lines = [];
  for (const match of res?.matches || []) {
    const md = match?.metadata || {};
    const page = typeof md.page === "number" ? md.page : null;
    const text = typeof md.text === "string" ? md.text : "";
    if (!text.trim()) continue;
    lines.push(`${page ? `Page ${page}: ` : ""}${text.trim()}`);
  }

  const joined = lines.join("\n\n");
  return joined.length > MAX_RETRIEVED_CHARS
    ? joined.slice(0, MAX_RETRIEVED_CHARS) + "\n\n[Retrieved context truncated]"
    : joined;
}

async function indexContextInBackground({ ai, vectorIndex, reportId, pdfContext, embeddingModel, pooling }) {
  if (!vectorIndex || !ai || !reportId) return;
  const pages = parsePagesFromContext(pdfContext);
  if (pages.length === 0) return;

  const chunks = [];
  for (const p of pages) {
    const pageChunks = chunkText(p.text);
    for (const c of pageChunks) {
      const id = `${reportId}:${p.page ?? "x"}:${fnv1a(c)}`;
      chunks.push({ id, page: p.page, text: c });
    }
  }
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH);
    const texts = batch.map((b) => b.text);
    const embedded = await embedText(ai, embeddingModel, texts, pooling);
    const vectors = [];

    if (Array.isArray(embedded) && embedded.length === batch.length) {
      for (let j = 0; j < batch.length; j++) {
        const values = embedded[j];
        if (!Array.isArray(values) || values.length === 0) continue;
        vectors.push({
          id: batch[j].id,
          namespace: reportId,
          values,
          metadata: {
            page: typeof batch[j].page === "number" ? batch[j].page : undefined,
            text: batch[j].text.slice(0, 1500),
          },
        });
      }
    }

    if (vectors.length > 0) {
      await vectorIndex.upsert(vectors);
    }
  }
}

async function indexMarkdownInBackground({ ai, vectorIndex, reportId, markdown, embeddingModel, pooling }) {
  if (!vectorIndex || !ai || !reportId) return { upserted: 0 };

  const chunks = chunkText(markdown);
  if (chunks.length === 0) return { upserted: 0 };

  let upserted = 0;

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH);
    const embedded = await embedText(ai, embeddingModel, batch, pooling);
    const vectors = [];

    if (Array.isArray(embedded) && embedded.length === batch.length) {
      for (let j = 0; j < batch.length; j++) {
        const values = embedded[j];
        if (!Array.isArray(values) || values.length === 0) continue;
        const c = batch[j];
        vectors.push({
          id: `${reportId}:md:${i + j}:${fnv1a(c)}`,
          namespace: reportId,
          values,
          metadata: { source: "markdown", chunk: i + j, text: c.slice(0, 1500) },
        });
      }
    }

    if (vectors.length > 0) {
      await vectorIndex.upsert(vectors);
      upserted += vectors.length;
    }
  }

  return { upserted };
}

/** Known context window sizes for Workers AI models. */
const MODEL_CONTEXT_WINDOWS = {
  "@cf/meta/llama-3-8b-instruct":                     7968,
  "@cf/meta/llama-3-8b-instruct-awq":                 8192,
  "@cf/openai/gpt-oss-20b":                           128000,
  "@cf/openai/gpt-oss-120b":                          128000,
  "@cf/mistralai/mistral-small-3.1-24b-instruct":     128000,
  "@cf/meta/llama-4-scout-17b-16e-instruct":          131000,
};

function defaultContextWindowForModel(model) {
  const m = safeString(model);
  if (!m) return 7968;
  if (MODEL_CONTEXT_WINDOWS[m]) return MODEL_CONTEXT_WINDOWS[m];
  if (m.includes("llama-3.2")) return 128000;
  if (m.includes("mistral-small-3.1")) return 128000;
  return 128000;
}

function extractResponseText(result) {
  if (typeof result === "string") return result;
  if (result?.response && typeof result.response === "string" && result.response.trim().length > 0) {
    return result.response;
  }
  if (result?.choices?.[0]?.message?.content) return String(result.choices[0].message.content);
  if (result?.response && typeof result.response === "string") return result.response;
  return JSON.stringify(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// Request handler
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequest(context) {
  // Method enforcement — OPTIONS already handled by global middleware
  if (context.request.method !== "POST") {
    return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
  }

  const log = context._log || console;
  const requestId = context._requestId;

  const jsonHeaders = { "Content-Type": "application/json" };

  // ── Parse and validate request body ──────────────────────────────────
  const parsed = await validateJsonBody(context.request);
  if (!parsed.valid) {
    return errorResponse(400, ErrorCode.INVALID_JSON, parsed.error, { requestId });
  }

  const body = parsed.body;
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  const pdfContext = safeString(body?.context || "");
  const meta = body?.meta || {};
  const reportId = safeString(meta?.reportId || "");
  const reportKey = normalizeReportKey(meta?.reportKey || "");

  if (!messages) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid messages format", { requestId });
  }

  const ai = context.env.AI;
  if (!ai) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "Workers AI binding missing", { requestId });
  }

  log.info("Chat request received", {
    reportId,
    messagesCount: messages.length,
    hasContext: pdfContext.trim().length > 0,
  });

  // ── Model configuration ──────────────────────────────────────────────
  const model = context.env.AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct";
  const lora = safeString(context.env.AI_LORA || "").trim();
  const loraRawEnv = safeString(context.env.AI_LORA_RAW || "").trim().toLowerCase();
  const loraUseRaw = lora
    ? loraRawEnv ? ["1", "true", "yes", "y", "on"].includes(loraRawEnv) : true
    : false;

  function buildChatRunArgs({ chatMessages, maxTokens, temperature }) {
    const args = { messages: chatMessages, temperature, max_tokens: maxTokens };
    if (lora) {
      args.lora = lora;
      if (loraUseRaw) args.raw = true;
    }
    return args;
  }

  const metaLine = `Company: ${meta.company || ""}\nYear: ${meta.publishedYear || ""}\nViewer page: ${meta.currentPage || ""}/${meta.numPages || ""}`;

  // ── Embedding & vector config ────────────────────────────────────────
  const embeddingModel = context.env.AI_EMBEDDING_MODEL || "@cf/baai/bge-small-en-v1.5";
  const poolingRaw = safeString(context.env.AI_EMBEDDING_POOLING || "cls").toLowerCase();
  const pooling = poolingRaw === "mean" ? "mean" : "cls";

  const vectorIndex = context.env.VECTORIZE_INDEX;
  const question = pickLastUserMessage(messages);

  // ── Semantic retrieval ───────────────────────────────────────────────
  let retrieved = "";
  try {
    retrieved = await queryVectorIndex({ ai, vectorIndex, reportId, question, embeddingModel, pooling });
  } catch (err) {
    log.warn("Vectorize query failed — proceeding without retrieval", {
      error: err instanceof Error ? err.message : String(err),
    });
    retrieved = "";
  }

  // ── Background indexing (viewer context) ─────────────────────────────
  if (reportId && vectorIndex && pdfContext.trim()) {
    const p = indexContextInBackground({ ai, vectorIndex, reportId, pdfContext, embeddingModel, pooling }).catch((err) => {
      log.error("Context indexing failed", { reportId, error: err instanceof Error ? err.message : String(err) });
    });
    if (typeof context.waitUntil === "function") context.waitUntil(p);
  }

  // ── Background full-report ingestion (PDF → Markdown → Vectorize) ───
  const reportsBucket = context.env.REPORTS_BUCKET;
  if (typeof context.waitUntil === "function" && reportId && reportKey && reportsBucket && vectorIndex) {
    if (_ingestionInFlight.has(reportId)) {
      log.debug("Skipping duplicate background ingestion", { reportId });
    } else {
      _ingestionInFlight.add(reportId);
      const markerKey = vectorizeMarkerKeyForReportId(reportId);

      const job = (async () => {
        if (!markerKey) return;
        const already = await reportsBucket.get(markerKey);
        if (already) return;

        const generatedAt = new Date().toISOString();
        const base = { reportId, reportKey, embeddingModel, generatedAt };

        const writeMarker = async (data) => {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              await reportsBucket.put(markerKey, JSON.stringify(data), {
                httpMetadata: { contentType: "application/json; charset=utf-8" },
              });
              return;
            } catch (err) {
              log.error("R2 put marker failed", { markerKey, attempt, error: err instanceof Error ? err.message : String(err) });
              if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
            }
          }
          log.error("CRITICAL: Vectorize marker was NOT persisted — ingestion may repeat", { reportId });
        };

        try {
          let markdown = await getCachedMarkdown({ bucket: reportsBucket, reportKey });

          if (!markdown) {
            const pdfObj = await reportsBucket.get(reportKey);
            if (!pdfObj) {
              await writeMarker({ ...base, status: "error", stage: "r2_get_pdf", error: "PDF not found in R2" });
              return;
            }

            const ab = await pdfObj.arrayBuffer();
            const contentType = pdfObj.httpMetadata?.contentType || "application/pdf";
            const pdfBlob = new Blob([ab], { type: contentType });
            const name = fileNameFromKey(reportKey, "report.pdf");

            const converted = await convertPdfToMarkdown({ ai, pdfBlob, name });
            if (!converted.ok) {
              await writeMarker({ ...base, status: "error", stage: "toMarkdown", error: safeString(converted.error || "toMarkdown failed") });
              return;
            }

            markdown = converted.markdown;
            await putCachedMarkdown({ bucket: reportsBucket, reportKey, markdown, tokens: converted.tokens, log });
          }

          if (!markdown || !markdown.trim()) {
            await writeMarker({ ...base, status: "error", stage: "markdown", error: "Markdown was empty" });
            return;
          }

          const indexed = await indexMarkdownInBackground({ ai, vectorIndex, reportId, markdown, embeddingModel, pooling });
          await writeMarker({ ...base, status: "done", indexed: indexed?.upserted ?? 0 });

          log.info("Background ingestion complete", { reportId, upserted: indexed?.upserted ?? 0 });
        } catch (e) {
          const msg = e instanceof Error ? e.message : safeString(e);
          await writeMarker({ ...base, status: "error", stage: "exception", error: msg || "Unknown error" });
        }
      })().finally(() => {
        _ingestionInFlight.delete(reportId);
      }).catch((err) => {
        log.error("Background ingestion job failed", { reportId, error: err instanceof Error ? err.message : String(err) });
      });

      context.waitUntil(job);
    }
  }

  // ── Check for available context ──────────────────────────────────────
  const hasContext = pdfContext.trim().length > 0 || retrieved.trim().length > 0;
  if (!hasContext) {
    const hint = reportKey
      ? "I don't have any extracted report text yet. Scroll the PDF to extract text, or wait a bit for full-report indexing to finish, then ask again."
      : "I don't have any report text yet. Please open a report first.";
    return new Response(JSON.stringify({ response: hint, model }), { headers: jsonHeaders });
  }

  // ── Prepare and execute AI inference ─────────────────────────────────
  const contextWindow = clampInt(context.env.AI_CONTEXT_WINDOW, defaultContextWindowForModel(model));
  const desiredMaxTokens = clampInt(context.env.AI_MAX_TOKENS, 800);
  const safetyTokens = clampInt(context.env.AI_SAFETY_TOKENS, 128);

  const prepared = prepareAiRunPayload({
    rawMessages: messages,
    metaLine,
    pdfContext,
    retrieved,
    contextWindow,
    desiredMaxTokens,
    safetyTokens,
  });

  let result;
  try {
    result = await ai.run(model, buildChatRunArgs({
      chatMessages: prepared.chatMessages,
      maxTokens: prepared.maxTokens,
      temperature: 0.2,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : safeString(err);
    if (msg.includes("5021") || msg.toLowerCase().includes("context window")) {
      log.warn("Context window overflow — retrying with reduced context", { model });
      const retry = prepareAiRunPayload({
        rawMessages: messages.slice(-4),
        metaLine,
        pdfContext: "",
        retrieved: "",
        contextWindow,
        desiredMaxTokens: Math.min(desiredMaxTokens, 256),
        safetyTokens: Math.max(safetyTokens, 192),
      });
      result = await ai.run(model, buildChatRunArgs({
        chatMessages: retry.chatMessages,
        maxTokens: retry.maxTokens,
        temperature: 0.2,
      }));
    } else {
      throw err;
    }
  }

  const text = extractResponseText(result);
  log.info("Chat response generated", { model, responseLength: text.length });

  return new Response(JSON.stringify({ response: text, model }), { headers: jsonHeaders });
}
