// ─── Disclosure Quality Scoring Endpoint ────────────────────────────────────
// Handles both GET (cached score retrieval with migration/refinement) and
// POST (compute + cache). Uses shared library modules.
//
// The core scoring engine (regex-based feature detection, subscore formulas)
// is preserved intact — only the infrastructure code has been refactored.

import {
  safeString,
  safeBool,
  clampInt,
  normalizeWhitespace,
  normalizeReportKey,
  markdownCacheKeyForReportKey,
  markdownMetaKeyForReportKey,
  disclosureScoreKey,
  fileNameFromKey,
  getCachedText,
  putText,
  putTextSafe,
  putJson,
  putJsonSafe,
  convertPdfToMarkdown,
} from "../_lib/index.js";

import { ErrorCode, errorResponse } from "../_lib/errors.js";
import { validateReportId, validateJsonBody } from "../_lib/validation.js";
import { classifyChunks, buildRoutingSummary } from "../_lib/finbert-router.js";


// ── Constants ───────────────────────────────────────────────────────────────
const DQ_METHOD_KIND = "regex-v4.1";
const EVIDENCE_REFINE_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const EVIDENCE_REFINE_SYSTEM_PROMPT =
  "You are a precise data cleaning tool. Output only valid JSON. Never fabricate data. Preserve all numbers and facts exactly.";

const EVIDENCE_REFINE_USER_PROMPT = `You are a sustainability reporting data processor. Below is raw evidence extracted from a sustainability report PDF (converted to markdown). The text has artifacts from PDF conversion: broken sentences, markdown table pipes, header fragments, excessive whitespace, and formatting noise.

For each evidence entry, clean up the text:
1. Fix broken sentences and remove mid-word truncation
2. Remove markdown artifacts (pipes |, excessive #, broken table formatting)
3. Preserve all factual content: numbers, percentages, units, company names, standards
4. Keep each quote concise (max 2-3 sentences of the most relevant content)
5. Do NOT add information that isn't in the original text
6. Do NOT change any numbers, dates, or factual claims
7. If the raw text is already clean and readable, keep it as-is

Return a JSON object with the same keys, each containing an array of objects with "text", "page", and "heading" fields. Only output valid JSON, no markdown formatting.

Raw evidence:
`;

// ── Evidence & text processing (module-scoped) ──────────────────────────────

function normalizeForEvidence(text) {
  let s = safeString(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");

  s = s.replace(/^\s*\[\.\.\.snipped\.\.\.\]\s*$/gim, "");

  // Unicode cleanup
  s = s.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "");
  s = s.replace(/\u00ad/g, "");
  s = s.replace(/\ufb01/g, "fi");
  s = s.replace(/\ufb02/g, "fl");
  s = s.replace(/\ufb00/g, "ff");
  s = s.replace(/\ufb03/g, "ffi");
  s = s.replace(/\ufb04/g, "ffl");
  s = s.replace(/[\u25a0\u25a1\u25aa\u25ab\u25cf\u25cb\u25c6\u25c7\u25ba\u25b8\u25b6\u25c0\u25be\u25bc\u25b2\u25b3\u25b7\u25c1\u2605\u2606\u2726\u2727\u2729\u272a\u272b\u272c\u272d\u272e\u272f\u2730\u2731\u2732\u2733\u2734\u2735\u2736\u2737\u2738\u2739\u273a\u273b\u273c\u273d\u273e\u273f\u2740\u2741\u2742\u2743\u2744\u2745\u2746\u2747\u2748\u2749\u274a\u274b\u2b1b\u2b1c\u2610\u2611\u2612]/g, "");
  s = s.replace(/[\u2190-\u21ff\u27f6\u27f5\u27f7]/g, " - ");

  // Markdown artifact cleanup
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[([^\]]*)\]\(\s*\)/g, "$1");
  s = s.replace(/^\s*#{1,6}\s*$/gm, "");
  s = s.replace(/^[\s|]*[-:]{3,}(\s*\|\s*[-:]{3,})+[\s|]*$/gm, "");
  s = s.replace(/^\s*\|[\s|]*$/gm, "");
  s = s.replace(/^\s*\|\s+/gm, "");
  s = s.replace(/\s+\|\s*$/gm, "");
  s = s.replace(/\|{2,}/g, " | ");
  s = s.replace(/^-{3,}\s*$/gm, "");

  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/ *\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

function sampleHeadTail(text, { maxChars = 800_000, headChars = 420_000 } = {}) {
  const s = safeString(text);
  if (s.length <= maxChars) return s;
  const head = Math.max(0, Math.min(headChars, Math.floor(maxChars * 0.6)));
  const tail = Math.max(0, maxChars - head - 48);
  return s.slice(0, head) + "\n\n[...snipped...]\n\n" + s.slice(Math.max(0, s.length - tail));
}

function clipSnippet(snippet, { maxChars = 1200, maxParagraphs = 3 } = {}) {
  const s = normalizeForEvidence(snippet);
  if (!s) return "";
  if (s.length <= maxChars) return s;

  const paras = s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 1) {
    const kept = [];
    for (const p of paras) {
      const next = kept.length ? kept.join("\n\n") + "\n\n" + p : p;
      if (next.length > maxChars) break;
      kept.push(p);
      if (kept.length >= maxParagraphs) break;
    }
    if (kept.length > 0) {
      let out = kept.join("\n\n").trimEnd();
      if (out.length < s.length) out += "\n\n[...truncated...]";
      return out;
    }
  }

  let out = s.slice(0, Math.max(0, maxChars));
  const lastDot = out.lastIndexOf(". ");
  const lastBang = out.lastIndexOf("! ");
  const lastQ = out.lastIndexOf("? ");
  const lastStop = Math.max(lastDot, lastBang, lastQ);
  if (lastStop > Math.floor(maxChars * 0.55)) {
    return out.slice(0, lastStop + 1).trimEnd() + " ...";
  }
  const lastSpace = out.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxChars * 0.6)) out = out.slice(0, lastSpace);
  return out.trimEnd() + " ...";
}

function normalizeLineForKey(line) {
  let s = safeString(line).replace(/\u00a0/g, " ");
  s = s.replace(/([0-9])([A-Za-zÀ-ÖØ-öø-ÿ])/g, "$1 $2");
  s = s.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])([0-9])/g, "$1 $2");
  s = s.replace(/[ \t\f\v]+/g, " ").trim();
  return s;
}

function normalizeLineForJoin(line) {
  let s = safeString(line).replace(/\u00a0/g, " ");
  s = s.replace(/[ \t\f\v]+/g, " ").trim();
  return s;
}

function boilerplateKey(line) {
  const s = normalizeLineForKey(line).toLowerCase();
  return s.replace(/\d+/g, "#").replace(/#+/g, "#").trim();
}

function isBoilerplateCandidateLine(line) {
  const s = normalizeLineForKey(line);
  if (!s) return false;
  if (s.length < 8 || s.length > 200) return false;
  if (/^\s*#{1,6}\s+/.test(s)) return false;
  if (/^\s*(?:[-*•]|\d+\.)\s+/.test(s)) return false;
  if (/^\s*\|/.test(s)) return false;
  if (/^\s*\[\.\.\.snipped\.\.\.\]\s*$/i.test(s)) return false;
  if (/^\s*page\s+\d+:?\s*$/i.test(s)) return false;
  return true;
}

function isLikelyBoilerplateText(line) {
  const s = normalizeLineForKey(line);
  if (!s) return false;
  const lower = s.toLowerCase();
  const hasDocPhrase = /(universal\s+registration\s+document|registration\s+document|annual\s+report|sustainability\s+statement|sustainability\s+report|integrated\s+report)/i.test(lower);

  const letters = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  const uppers = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, "");
  const upperRatio = letters.length ? uppers.length / letters.length : 0;
  const digitCount = (s.match(/\d/g) || []).length;

  if (hasDocPhrase) return true;
  if (letters.length >= 10 && upperRatio >= 0.82) return true;
  if (letters.length >= 6 && upperRatio >= 0.68 && digitCount >= 3) return true;
  if (digitCount >= 6 && s.length <= 80) return true;
  return false;
}

function splitIntoPages(rawText) {
  const s = safeString(rawText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u00a0/g, " ");
  const lines = s.split("\n");
  const pages = [];
  let pageNum = null;
  let pageTitle = null;
  let pageLines = [];

  const pushPage = () => {
    if (pageLines.some((l) => safeString(l).trim())) {
      pages.push({ page: pageNum, title: pageTitle, lines: pageLines });
    }
    pageLines = [];
  };

  for (const line of lines) {
    const rawLine = safeString(line);
    const trimmed = rawLine.trim();
    if (/^\[\.\.\.snipped\.\.\.\]$/i.test(trimmed)) {
      pushPage();
      pageNum = null;
      pageTitle = null;
      continue;
    }

    const mPageHeading = /^\s*#{1,6}\s*Page\s+(\d+)\s*(.*)$/.exec(rawLine);
    if (mPageHeading) {
      pushPage();
      pageNum = Number.parseInt(mPageHeading[1], 10);
      pageTitle = safeString(mPageHeading[2] || "").trim() || null;
      continue;
    }

    const mViewerPage = /^\s*Page\s+(\d+):\s*$/.exec(rawLine);
    if (mViewerPage) {
      pushPage();
      pageNum = Number.parseInt(mViewerPage[1], 10);
      pageTitle = null;
      continue;
    }

    pageLines.push(rawLine);
  }
  pushPage();

  if (pages.length === 0 && s.trim()) {
    pages.push({ page: null, title: null, lines });
  }

  return pages;
}

function detectBoilerplateKeys(pages) {
  if (!Array.isArray(pages) || pages.length < 3) return new Set();
  const counts = new Map();
  const examples = new Map();

  for (const p of pages) {
    const rawLines = Array.isArray(p?.lines) ? p.lines : [];
    const nonEmpty = rawLines.map((l) => safeString(l).trim()).filter(Boolean);

    const pick = (arr) => {
      const out = [];
      for (const ln of arr) {
        if (!isBoilerplateCandidateLine(ln)) continue;
        out.push(ln);
        if (out.length >= 5) break;
      }
      return out;
    };

    const top = pick(nonEmpty);
    const bottom = pick(nonEmpty.slice().reverse()).slice(0, 5);
    for (const ln of [...top, ...bottom]) {
      const key = boilerplateKey(ln);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!examples.has(key)) examples.set(key, ln);
    }
  }

  const minCount = Math.max(3, Math.ceil(pages.length * 0.25));
  const out = new Set();
  for (const [key, count] of counts.entries()) {
    if (count < minCount) continue;
    const ex = examples.get(key) || "";
    if (!isLikelyBoilerplateText(ex)) continue;
    out.add(key);
  }
  return out;
}

function joinWrappedLines(lines) {
  const parts = [];
  for (const rawLine of lines) {
    const line = normalizeLineForJoin(rawLine);
    if (!line) continue;
    if (parts.length === 0) {
      parts.push(line);
      continue;
    }
    const prev = parts[parts.length - 1];
    if (prev.endsWith("-") && /^[a-zà-öø-ÿ]/.test(line)) {
      parts[parts.length - 1] = prev.slice(0, -1) + line;
    } else {
      parts[parts.length - 1] = prev + " " + line;
    }
  }
  return parts.join("").trim();
}

function buildEvidenceBlocks(rawText) {
  const pages = splitIntoPages(rawText);
  const boilerplate = detectBoilerplateKeys(pages);
  const blocks = [];

  for (const p of pages) {
    const pageNum = Number.isFinite(Number(p?.page)) ? Number(p.page) : null;
    let heading = p?.title ? normalizeWhitespace(p.title) : null;
    let inCodeFence = false;
    let paraLines = [];

    const flushPara = () => {
      if (paraLines.length === 0) return;
      const joined = joinWrappedLines(paraLines);
      paraLines = [];
      const text = normalizeForEvidence(joined);
      if (!text || text.length < 8) return;
      blocks.push({ kind: "paragraph", page: pageNum, heading, text });
    };

    const pageLines = Array.isArray(p?.lines) ? p.lines : [];

    for (const rawLine of pageLines) {
      const line = safeString(rawLine).replace(/\u00a0/g, " ");
      const trimmed = line.trim();
      if (!trimmed) { flushPara(); continue; }

      const bpKey = boilerplateKey(trimmed);
      if (bpKey && boilerplate.has(bpKey)) { flushPara(); continue; }

      if (/^\s*```/.test(line)) { flushPara(); inCodeFence = !inCodeFence; continue; }
      if (inCodeFence) continue;

      const mHeading = /^\s*(#{1,6})\s+(.+)$/.exec(line);
      if (mHeading) {
        flushPara();
        const nextHeading = safeString(mHeading[2] || "").trim();
        if (nextHeading) heading = normalizeWhitespace(nextHeading);
        continue;
      }

      const mList = /^\s*(?:[-*•]|\d+\.)\s+(.+)$/.exec(line);
      if (mList) {
        flushPara();
        const item = normalizeForEvidence(joinWrappedLines([mList[1]]));
        if (item && item.length >= 6) {
          blocks.push({ kind: "list", page: pageNum, heading, text: `- ${item}` });
        }
        continue;
      }

      if (/^\s*Page\s+\d+:\s*$/i.test(trimmed)) { flushPara(); continue; }
      paraLines.push(line);
    }

    flushPara();
  }

  return blocks;
}

function findPrevSentenceStart(text, fromIdx) {
  const i0 = Math.max(0, Math.min(text.length, fromIdx));
  for (let i = i0; i > 0; i--) {
    const c = text[i - 1];
    if (c === "." || c === "!" || c === "?" || c === "\n") return i;
  }
  return 0;
}

function findNextSentenceEnd(text, fromIdx) {
  const i0 = Math.max(0, Math.min(text.length, fromIdx));
  for (let i = i0; i < text.length; i++) {
    const c = text[i];
    if (c === "." || c === "!" || c === "?" || c === "\n") return i + 1;
  }
  return text.length;
}

function extractEvidenceSnippet(text, idx, matchLen, { contextChars = 220, maxChars = 900 } = {}) {
  const s = safeString(text);
  const startIdx = Math.max(0, Math.min(s.length, idx));
  const endIdx = Math.max(startIdx, Math.min(s.length, idx + matchLen));

  const prevPara = s.lastIndexOf("\n\n", startIdx);
  const nextPara = s.indexOf("\n\n", endIdx);
  if (prevPara !== -1 || nextPara !== -1) {
    const start = prevPara === -1 ? 0 : prevPara + 2;
    const end = nextPara === -1 ? s.length : nextPara;
    const para = s.slice(start, end).trim();
    if (para && para.length <= maxChars * 2) return clipSnippet(para, { maxChars });
  }

  let start = findPrevSentenceStart(s, startIdx);
  start = findPrevSentenceStart(s, Math.max(0, start - 1));
  let end = findNextSentenceEnd(s, endIdx);
  end = findNextSentenceEnd(s, Math.min(s.length, end + 1));

  if (end - start > maxChars * 3) {
    start = Math.max(0, startIdx - contextChars);
    end = Math.min(s.length, endIdx + contextChars);
  }

  return clipSnippet(s.slice(start, end).trim(), { maxChars });
}

function toGlobalRegex(re) {
  if (!(re instanceof RegExp)) return null;
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  try { return new RegExp(re.source, flags); } catch { return null; }
}

function buildQuoteFromBlock(blocks, blockIdx, matchIdx, matchLen, { maxChars = 1200, contextChars = 240 } = {}) {
  const b = blocks[blockIdx];
  if (!b || !safeString(b.text).trim()) return "";

  const text = safeString(b.text);
  if (text.length > maxChars * 2) {
    return extractEvidenceSnippet(text, matchIdx, matchLen, { contextChars, maxChars });
  }

  const parts = [text];
  const prev = blocks[blockIdx - 1];
  if (prev && prev.kind === b.kind && prev.page === b.page && safeString(prev.heading) === safeString(b.heading)) {
    const t = safeString(prev.text).trim();
    if (t && t.length <= 800) parts.unshift(t);
  }
  const next = blocks[blockIdx + 1];
  if (next && next.kind === b.kind && next.page === b.page && safeString(next.heading) === safeString(b.heading)) {
    const t = safeString(next.text).trim();
    if (t && t.length <= 800) parts.push(t);
  }

  return clipSnippet(parts.join("\n\n"), { maxChars, maxParagraphs: 3 });
}

function quoteQualityScore(quoteText, page) {
  let quality = 0;
  if (/\d+[\.,]?\d*\s*%/.test(quoteText)) quality += 3;
  if (/\b\d{1,3}[\.,]\d{3}\b/.test(quoteText)) quality += 3;
  if (/\b(tco2e?|mwh|kwh|gj|tonnes?|tons?|kg)\b/i.test(quoteText)) quality += 3;
  if (/\b20[2-3]\d\b/.test(quoteText)) quality += 1;
  if (/\btarget|\bgoal|\bcommit/i.test(quoteText)) quality += 1;
  if (/\bscope\s*[123]\b/i.test(quoteText)) quality += 1;
  if (/\|[^|]+\|/.test(quoteText)) quality += 2;
  if (page != null) quality += 1;
  if (quoteText.length > 80) quality += 1;
  if (quoteText.length > 200) quality += 1;
  return quality;
}

function analyzeFeature(blocks, re, { maxQuotes = 3, contextChars = 280 } = {}) {
  const reG = toGlobalRegex(re);
  if (!reG) return { found: false, occurrences: 0, pages: 0, quotes: [] };

  const seen = new Set();
  const pages = new Set();
  const candidates = [];
  const candidateLimit = Math.max(0, Number(maxQuotes) || 0) * 3;
  let occurrences = 0;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const text = safeString(b?.text);
    if (!text) continue;

    reG.lastIndex = 0;
    let firstMatch = null;
    let blockOccurrences = 0;

    for (const m of text.matchAll(reG)) {
      blockOccurrences++;
      if (!firstMatch) {
        firstMatch = { idx: typeof m.index === "number" ? m.index : 0, len: safeString(m[0]).length };
      }
    }

    if (blockOccurrences === 0) continue;
    occurrences += blockOccurrences;
    pages.add(b.page != null ? b.page : `block-${bi}`);

    if (!firstMatch || candidates.length >= candidateLimit) continue;
    const quoteText = buildQuoteFromBlock(blocks, bi, firstMatch.idx, firstMatch.len, { contextChars, maxChars: 1400 });
    if (!quoteText) continue;

    const key = normalizeWhitespace(quoteText).slice(0, 260);
    if (seen.has(key)) continue;
    seen.add(key);

    const page = Number.isFinite(Number(b?.page)) ? Number(b.page) : null;
    candidates.push({ text: quoteText, page, heading: safeString(b?.heading).trim() || null, quality: quoteQualityScore(quoteText, page) });
  }

  candidates.sort((a, b) => b.quality - a.quality);
  const quoteCap = Math.max(0, Number(maxQuotes) || 0);
  const quotes = candidates.slice(0, quoteCap).map((c) => ({ text: c.text, page: c.page, heading: c.heading }));

  return { found: quotes.length > 0, occurrences, pages: pages.size, quotes };
}

function numericDensity(text) {
  const s = safeString(text);
  if (!s) return 0;
  const numbers = s.match(/\b\d[\d,.\s]*\d\b|\b\d+\s*%/g) || [];
  return (numbers.length / Math.max(1, s.length)) * 1000;
}

// ── AI evidence refinement ──────────────────────────────────────────────────

function parseJsonObjectFromAiText(text) {
  const responseText = safeString(text).trim();
  if (!responseText) return null;

  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const toParse = jsonMatch ? jsonMatch[1].trim() : responseText;
    return JSON.parse(toParse);
  } catch {
    const braceStart = responseText.indexOf("{");
    const braceEnd = responseText.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      try { return JSON.parse(responseText.slice(braceStart, braceEnd + 1)); } catch { return null; }
    }
  }
  return null;
}

function buildRawEvidenceBatch(evidenceQuotes, { maxFeatures = 20, maxQuotesPerFeature = 3, maxQuoteChars = 600 } = {}) {
  if (!evidenceQuotes || typeof evidenceQuotes !== "object") return null;
  const entries = Object.entries(evidenceQuotes)
    .filter(([, quotes]) => Array.isArray(quotes) && quotes.length > 0)
    .slice(0, maxFeatures);
  if (entries.length === 0) return null;

  const rawEvidence = {};
  for (const [key, quotes] of entries) {
    const cleanedQuotes = quotes
      .slice(0, maxQuotesPerFeature)
      .map((q) => {
        const text = safeString(q?.text || "").slice(0, maxQuoteChars);
        if (!text.trim()) return null;
        return { text, page: q?.page ?? null, heading: q?.heading ?? null };
      })
      .filter(Boolean);
    if (cleanedQuotes.length > 0) rawEvidence[key] = cleanedQuotes;
  }

  return Object.keys(rawEvidence).length > 0 ? rawEvidence : null;
}

function applyRefinedEvidence(result, refined) {
  if (!result || !result.evidenceQuotes || typeof refined !== "object" || !refined) return 0;
  let refinedCount = 0;
  for (const [key, quotes] of Object.entries(refined)) {
    const existing = result.evidenceQuotes?.[key];
    if (!Array.isArray(quotes) || !Array.isArray(existing)) continue;

    const cleaned = quotes
      .map((q) => {
        const text = safeString(q?.text || "").trim();
        if (!text || text.length < 10) return null;
        const origQuote = existing[0];
        return {
          text,
          page: typeof q?.page === "number" ? q.page : (origQuote?.page ?? null),
          heading: typeof q?.heading === "string" && q.heading.trim() ? q.heading.trim() : (origQuote?.heading ?? null),
        };
      })
      .filter(Boolean);

    if (cleaned.length > 0) {
      result.evidenceQuotes[key] = cleaned;
      if (!result.evidence || typeof result.evidence !== "object") result.evidence = {};
      result.evidence[key] = cleaned.map((q) => q.text);
      refinedCount++;
    }
  }

  if (!result.method || typeof result.method !== "object") result.method = {};
  result.method.evidenceRefinedByAI = refinedCount;
  return refinedCount;
}

async function refineEvidenceQuotesWithAI(ai, result) {
  if (!ai || !result || !result.evidenceQuotes) return { refinedCount: 0, changed: false };
  const rawEvidence = buildRawEvidenceBatch(result.evidenceQuotes);
  if (!rawEvidence) return { refinedCount: 0, changed: false };

  const aiResult = await ai.run(EVIDENCE_REFINE_MODEL, {
    messages: [
      { role: "system", content: EVIDENCE_REFINE_SYSTEM_PROMPT },
      { role: "user", content: EVIDENCE_REFINE_USER_PROMPT + JSON.stringify(rawEvidence) },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  });

  const refined = parseJsonObjectFromAiText(aiResult?.response || "");
  if (!refined || typeof refined !== "object") return { refinedCount: 0, changed: false };

  const refinedCount = applyRefinedEvidence(result, refined);
  return { refinedCount, changed: refinedCount > 0 };
}

// ── Core scoring engine ─────────────────────────────────────────────────────

function computeDisclosureQuality(markdown, { company, year, reportId, reportKey, version }) {
  const generatedAt = new Date().toISOString();

  const raw = safeString(markdown);
  const sampled = sampleHeadTail(raw);
  const blocks = buildEvidenceBlocks(sampled);
  const corpus = normalizeForEvidence(blocks.map((b) => b.text).join("\n\n"));
  const lower = corpus.toLowerCase();
  const corpusNumericDensity = numericDensity(corpus);

  const features = {};
  const evidence = {};
  const evidenceQuotes = {};
  const featureDepth = {};

  function setFeature(key, value, { quotes, depth, pages } = {}) {
    features[key] = Boolean(value);
    if (typeof depth === "number") featureDepth[key] = { occurrences: depth, pages: pages || 0 };
    if (Array.isArray(quotes) && quotes.length > 0) {
      const kept = quotes.slice(0, 4);
      evidence[key] = kept.map((q) => safeString(q?.text || "")).filter(Boolean);
      evidenceQuotes[key] = kept;
    }
  }

  function detectFeature(key, re, opts = {}) {
    const { maxQuotes = 3 } = opts;
    const scanned = analyzeFeature(blocks, re, { maxQuotes });
    setFeature(key, scanned.found, { quotes: scanned.quotes, depth: scanned.occurrences, pages: scanned.pages });
    return scanned;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FRAMEWORKS & STANDARDS
  // ═══════════════════════════════════════════════════════════════════
  const r_esrs = detectFeature("framework_esrs", /\besrs\b/gi);
  const r_csrd = detectFeature("framework_csrd", /\bcsrd\b/gi);
  detectFeature("framework_efrag", /\befrag\b/gi);
  const r_gri = detectFeature("framework_gri", /\bgri\b/gi);
  detectFeature("framework_sasb", /\bsasb\b/gi);
  const r_tcfd = detectFeature("framework_tcfd", /\btcfd\b/gi);
  detectFeature("framework_issb", /\bissb\b/gi);
  detectFeature("framework_ifrs_s1", /\bifrs\s*s\s*1\b/gi);
  detectFeature("framework_ifrs_s2", /\bifrs\s*s\s*2\b/gi);
  const r_eu_tax = detectFeature("framework_eu_taxonomy", /\beu\s+taxonomy\b|\btaxonomy\s+regulation\b|\btaxonomy[\s-]+aligned\b|\btaxonomy[\s-]+eligible\b/gi);
  detectFeature("framework_tnfd", /\btnfd\b/gi);
  detectFeature("framework_cdp", /\bcdp\b/gi);
  detectFeature("framework_sdgs", /\bsdgs?\b|\bsustainable\s+development\s+goals?\b/gi);
  detectFeature("paris_agreement", /\bparis\s+agreement\b|\b1\.5\s*°?\s*c\b|\b1\.5\s*degrees?\b|\bwell[\s-]+below\s+2\s*°?\s*c\b/gi);
  detectFeature("gri_content_index", /\bgri\s+content\s+index\b|\bgri\s+standards?\s+index\b|\bgri\s+\d{3}/gi);

  // ═══════════════════════════════════════════════════════════════════
  // MATERIALITY & SCOPE
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("double_materiality", /\bdouble\s+materiality\b/gi);
  detectFeature("materiality_assessment", /\bmateriality\b/gi);
  detectFeature("value_chain", /\bvalue\s+chain\b/gi);
  detectFeature("supply_chain", /\bsupply\s+chain\b/gi);
  detectFeature("materiality_matrix", /\bmateriality\s+matrix\b|\bmateriality\s+assessment\s+process\b|\bstakeholder\s+prioriti[sz]ation\b|\bimpact\s+materiality\b|\bfinancial\s+materiality\b/gi);
  detectFeature("iro_analysis", /\biro\b|\bimpact[\s,]+risk[\s,]+opportunit/gi);

  // ═══════════════════════════════════════════════════════════════════
  // GOVERNANCE & CONTROLS
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("board_oversight", /\bboard\s+of\s+directors\b|\bboard\s+oversight\b|\bboard\s+level\s+(?:oversight|responsibility|governance)\b/gi);
  detectFeature("audit_committee", /\baudit\s+committee\b/gi);
  detectFeature("internal_control", /\binternal\s+control(s)?\b|\bcontrol\s+system\b|\bcontrols\s+over\s+sustainability\s+reporting\b|\binternal\s+audit\b/gi);
  detectFeature("risk_management", /\brisk\s+management\b/gi);
  detectFeature("esg_remuneration", /\besg[\s-]+linked\s+remuner|\bsustainability[\s-]+linked\s+remuner|\bcompensation[^.]{0,40}sustainability|\bremuner[^.]{0,40}\besg\b|\bvariable\s+pay[^.]{0,30}sustainability|\bkpi[^.]{0,30}sustainab/gi);
  detectFeature("whistleblower", /\bwhistleblow(er|ing)\b|\bspeak[\s-]*up\b|\bgrievance\s+mechanism\b|\bethics\s+hotline\b|\breporting\s+channel\b/gi);
  detectFeature("anti_corruption", /\banti[\s-]*corruption\b|\banti[\s-]*bribery\b|\bbribery\b|\bcorruption\b/gi);
  detectFeature("data_privacy", /\bdata\s+priva(cy|te)\b|\bgdpr\b|\bcyber[\s-]*security\b|\bdata\s+protect(ion)?\b|\binformation\s+security\b/gi);
  detectFeature("tax_transparency", /\btax\s+transparency\b|\bcountry[\s-]+by[\s-]+country\s+report/gi);
  detectFeature("sustainability_committee", /\bsustainability\s+committee\b|\besg\s+committee\b|\bcsr\s+committee\b|\bresponsible\s+business\s+committee\b/gi);

  // ═══════════════════════════════════════════════════════════════════
  // CLIMATE & EMISSIONS
  // ═══════════════════════════════════════════════════════════════════
  const r_scope1 = detectFeature("scope_1", /\bscope\s*1\b/gi);
  const r_scope2 = detectFeature("scope_2", /\bscope\s*2\b/gi);
  const r_scope3 = detectFeature("scope_3", /\bscope\s*3\b/gi);
  const r_ghg = detectFeature("ghg_protocol", /\bghg\s+protocol\b/gi);
  detectFeature("tco2e_units", /\btco\s*2\s*e\b|\bco\s*2\s*e\b|\btonnes?\s+(?:of\s+)?co\s*2\b|\bmt\s*co\s*2/gi);
  detectFeature("emissions_intensity", /\bemissions?\s+intensity\b|\bcarbon\s+intensity\b|\bco2e?\s+per\b|\bgrams?\s+(?:of\s+)?co2/gi);
  detectFeature("base_year", /\bbase\s+year\b|\bbaseline\s+year\b/gi);
  detectFeature("scope2_method", /\blocation[\s-]+based\b|\bmarket[\s-]+based\b/gi);

  const r_scope3_cats_a = analyzeFeature(blocks, /\bcategory\s+\d{1,2}\b[^.]{0,80}(?:scope\s*3|upstream|downstream|purchased|capital|fuel|transport|business\s+travel|commut|waste|leased|franchis|investment)/gi, { maxQuotes: 3 });
  const r_scope3_cats_b = r_scope3_cats_a.found
    ? { found: false, quotes: [] }
    : analyzeFeature(blocks, /(?:scope\s*3|upstream|downstream)[^.]{0,80}\bcategory\s+\d{1,2}\b/gi, { maxQuotes: 3 });
  const scope3Depth = analyzeFeature(blocks, /\bcategory\s+\d{1,2}\b[^.]{0,80}(?:scope\s*3|upstream|downstream)/gi, { maxQuotes: 0 });
  const scope3Pages = analyzeFeature(blocks, /\bcategory\s+\d{1,2}\b/gi, { maxQuotes: 0 });
  setFeature("scope3_categories", r_scope3_cats_a.found || r_scope3_cats_b.found, {
    quotes: r_scope3_cats_a.found ? r_scope3_cats_a.quotes : r_scope3_cats_b.quotes,
    depth: scope3Depth.occurrences,
    pages: scope3Pages.pages,
  });

  detectFeature("emissions_numbers", /\b\d[\d,.\s]*\s*(?:tco2e?|mt\s*co2|tonnes?\s+(?:of\s+)?co2|kg\s*co2)/gi);

  // ═══════════════════════════════════════════════════════════════════
  // TARGETS & PLANS
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("net_zero", /\bnet\s*-?\s*zero\b/gi);
  detectFeature("sbti", /\bsbti\b|\bscience[\s-]+based\s+targets?\b/gi);
  detectFeature("transition_plan", /\btransition\s+plan\b|\bclimate\s+transition\b|\bdecarboni[zs]ation\s+(?:plan|pathway|roadmap|strateg)/gi);
  detectFeature("targets", /\btarget(s)?\b/gi);
  detectFeature("quantitative_targets", /\b(?:target|goal|objective|commit(?:ment|ted)?)\b[^.]{0,120}\b(?:20[2-9]\d|203\d)\b/gi, { maxQuotes: 4 });
  detectFeature("interim_targets", /\binterim\s+target\b|\bshort[\s-]+term\s+target\b|\b20(?:25|26|27|28|29|30)\s+target\b|\bmilestone/gi);
  detectFeature("target_progress", /\bprogress\s+(?:towards?|against|on)\s+(?:our\s+)?targets?\b|\bachieved\s+\d+\s*%|\bon\s+track\b|\bahead\s+of\s+target/gi);
  detectFeature("climate_scenario", /\bclimate\s+scenario\b|\bscenario\s+analysis\b|\bphysical\s+risk\b|\btransition\s+risk\b|\brcp\s*\d|\bssp\s*\d|\biea\s+(?:nze|sds|aps)/gi);
  detectFeature("carbon_pricing", /\bcarbon\s+pric(e|ing)\b|\binternal\s+carbon\s+pric(e|ing)\b|\bcarbon\s+offset(s|ting)?\b|\bcarbon\s+credit(s)?\b|\bets\b/gi);

  // ═══════════════════════════════════════════════════════════════════
  // ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("energy", /\benergy\s+consumption\b|\bmwh\b|\bkwh\b|\bgj\b|\benergy\s+intensity\b|\benergy\s+efficienc/gi);
  detectFeature("water", /\bwater\s+(?:consumption|withdrawal|usage|intensity|stress|recycl|reuse)\b|\bwater\s+risk\b/gi);
  detectFeature("waste", /\bwaste\s+(?:generation|diversion|recycl|management|disposal|reduc)\b|\bcircular\s+economy\b|\bwaste\s+to\s+landfill/gi);
  detectFeature("renewable_energy", /\brenewable\s+energy\b|\brenewable\s+electricity\b|\bppa\b|\bpower\s+purchase\s+agreement\b|\bgreen\s+electricity\b/gi);
  detectFeature("biodiversity", /\bbiodiversity\b|\bnature[\s-]+positive\b|\bnature[\s-]+related\b|\becosystem(s)?\s+(service|loss|restoration)\b|\bdeforestation\b|\bno[\s-]+net[\s-]+loss\b/gi);
  detectFeature("circular_economy", /\bcircular\s+economy\b|\bcircularity\b|\bcircular\s+design\b|\bproduct\s+lifecycle\b/gi);
  detectFeature("pollution", /\bpollut(ion|ant)\b|\bair\s+quality\b|\bnox\b|\bsox\b|\bvoc\b|\bparticulate\b/gi);

  // ═══════════════════════════════════════════════════════════════════
  // SOCIAL
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("workforce", /\bworkforce\b|\bemployees?\b|\bheadcount\b|\bfte\b|\bfull[\s-]+time\s+equivalent/gi);
  detectFeature("safety", /\bltir\b|\btrir\b|\binjury\b|\bsafety\b|\baccident(s)?\b|\bfatalit(y|ies)\b|\blost[\s-]+time\b|\brecordable\b/gi);
  detectFeature("diversity", /\bdiversity\b|\bequal\s+opportunit(y|ies)\b|\bgender\b|\binclusion\b|\bdi&i\b|\bdei\b|\bgender\s+pay\s+gap\b/gi);
  detectFeature("human_rights", /\bhuman\s+rights\b|\bdue\s+diligence\b|\bforced\s+labou?r\b|\bchild\s+labou?r\b|\bmodern\s+slavery\b/gi);
  detectFeature("training", /\btraining\s+hours?\b|\bcapacity\s+building\b|\blearning\s+and\s+development\b|\bskills?\s+development\b|\btraining\s+per\s+employee\b/gi);
  detectFeature("stakeholder_engagement", /\bstakeholder\s+engagement\b|\bstakeholder\s+dialogue\b|\bstakeholder\s+consultation\b|\bstakeholder\s+input\b|\bstakeholder\s+mapping\b/gi);
  detectFeature("community_investment", /\bcommunity\s+invest(ment|ing)\b|\bsocial\s+invest(ment|ing)\b|\bphilanthropy\b|\bcommunity\s+engagement\b|\bvolunteer/gi);
  detectFeature("living_wage", /\bliving\s+wage\b|\bfair\s+wage\b|\bliving\s+income\b/gi);
  detectFeature("just_transition", /\bjust\s+transition\b/gi);
  detectFeature("health_wellbeing", /\bhealth\s+(?:and|&)\s+(?:well[\s-]*being|wellness)\b|\bmental\s+health\b|\bemployee\s+wellbeing\b|\boccupational\s+health\b/gi);
  detectFeature("employee_turnover", /\bturnover\s+rate\b|\bemployee\s+retention\b|\battrition\b|\bvoluntary\s+turnover\b/gi);

  // ═══════════════════════════════════════════════════════════════════
  // ASSURANCE
  // ═══════════════════════════════════════════════════════════════════
  const r_assurance_any = detectFeature("assurance_any", /\blimited\s+assurance\b|\breasonable\s+assurance\b|\bindependent\s+assurance\b|\bassurance\b|\bverification\b|\bindependent\s+verif/gi, { maxQuotes: 4 });
  const r_assurance_limited = detectFeature("assurance_limited", /\blimited\s+assurance\b/gi);
  const r_assurance_reasonable = detectFeature("assurance_reasonable", /\breasonable\s+assurance\b/gi);
  detectFeature("assurance_isae", /\bisae\s*3000\b|\bisae\s*3410\b/gi);
  detectFeature("assurance_aa1000", /\baa\s*1000\b/gi);
  detectFeature("assurance_negative", /\bno\s+assurance\b|\bnot\s+assured\b|\bunaudited\b/gi);
  detectFeature("assurance_scope", /\bassurance\s+(?:covers?|scope|over|of)[^.]{0,80}(?:scope\s*[123]|ghg|emissions|energy|water|waste|social|environment)/gi);
  detectFeature("named_assurance_provider", /\b(?:deloitte|kpmg|pwc|pricewaterhousecoopers|ernst\s*&\s*young|ey\b|bureau\s+veritas|sgs\b|dnv\b|lrqa\b|mazars\b|bdo\b|grant\s+thornton\b|moore\b)/gi);

  // ═══════════════════════════════════════════════════════════════════
  // DISCLOSURE QUALITY SIGNALS
  // ═══════════════════════════════════════════════════════════════════
  detectFeature("methodology", /\bmethodolog(y|ies)\b|\bcalculation\s+method\b|\bmeasurement\s+approach\b/gi);
  detectFeature("boundary", /\borganizational\s+boundary\b|\boperational\s+boundary\b|\breporting\s+scope\b|\bconsolidation\s+scope\b|\breporting\s+boundary/gi);
  detectFeature("limitations", /\blimitation(s)?\b|\bdata\s+gap(s)?\b|\bestimat(ed|es|ion)\b|\bdata\s+not\s+available\b|\bpartial\s+data\b|\bdata\s+qualit(y|ies)\b/gi);
  detectFeature("restatement", /\brestat(ed|ement)\b|\brecalculated\b|\brevised\s+(?:data|figure|metric)\b|\bcorrect(ed|ion)\s+(?:to|of)/gi);
  detectFeature("forward_looking", /\bforward[\s-]+looking\b|\boutlook\b|\bfuture\s+plan(s)?\b|\broadmap\b|\baction\s+plan\b|\bambition(s)?\b|\bstrateg(y|ic)\s+(?:plan|direction|priorit)/gi);
  detectFeature("reporting_period", /\breporting\s+period\b|\bfiscal\s+year\b|\bfinancial\s+year\b|\b(?:january|1\s+january).*(?:december|31\s+december)\b|\bcalendar\s+year\b/gi);
  detectFeature("data_tables", /\|[^|]+\|[^|]+\|/g, { maxQuotes: 2 });
  detectFeature("data_quality", /\bdata\s+quality\b|\bdata\s+governance\b|\bdata\s+validation\b|\bdata\s+verification\b|\bdata\s+collection\s+(?:process|method)/gi);
  detectFeature("connectivity_financial", /\bconnect(?:ed|ivity|ion)\s+(?:with|to|between)\s+(?:financial|annual)\b|\bintegrat(?:ed|ion)\s+(?:with|into)\s+(?:financial|annual)\b|\bfinancial\s+(?:impact|implication|effect)\b/gi);
  detectFeature("esrs_datapoints", /\besrs\s+[es]\d\b|\b[es]\d[\s-]+\d+\b|\besrs\s+\d\b|\bdr\s+[es]\d/gi);
  detectFeature("sector_specific", /\bsector[\s-]+specific\b|\bindustry[\s-]+specific\b|\bsector\s+standard\b/gi);

  // ═══════════════════════════════════════════════════════════════════
  // QUANTITATIVE DEPTH SIGNALS
  // ═══════════════════════════════════════════════════════════════════
  const yearCounts = new Map();
  for (const y of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    const re = new RegExp(`\\b${y}\\b`, "g");
    const c = (lower.match(re) || []).length;
    if (c > 0) yearCounts.set(y, c);
  }
  const distinctYears = [...yearCounts.entries()].filter(([, c]) => c >= 4).map(([y]) => y);
  const percentageMatches = corpus.match(/\d+[\.,]?\d*\s*%/g) || [];
  const percentageCount = percentageMatches.length;
  const tableRows = (corpus.match(/\|[^|\n]+\|[^|\n]+\|/g) || []).length;
  const kpiNumbers = corpus.match(/\b\d{1,3}(?:[,.\s]\d{3})+\b|\b\d+[\.,]\d+\s*(?:%|tco2e?|mwh|kwh|gj|tonnes?|kg|m3|litres?)\b/gi) || [];

  const hasLimited = r_assurance_limited.found;
  const hasReasonable = r_assurance_reasonable.found;
  const hasAssurance = r_assurance_any.found;
  const hasNoAssurance = features.assurance_negative;
  const hasIsae = features.assurance_isae;
  const hasAa1000 = features.assurance_aa1000;

  const hasAnyFramework = [
    "framework_esrs", "framework_csrd", "framework_efrag", "framework_gri",
    "framework_sasb", "framework_tcfd", "framework_issb", "framework_ifrs_s1",
    "framework_ifrs_s2", "framework_eu_taxonomy", "framework_tnfd", "framework_cdp",
    "framework_sdgs",
  ].some((k) => features[k]);

  const frameworkCount = [
    "framework_esrs", "framework_csrd", "framework_gri", "framework_sasb",
    "framework_tcfd", "framework_issb", "framework_ifrs_s1", "framework_ifrs_s2",
    "framework_eu_taxonomy", "framework_tnfd", "framework_cdp", "framework_sdgs",
  ].filter((k) => features[k]).length;

  const esrsDepth = r_esrs.pages;
  const griDepth = r_gri.pages;
  const tcfdDepth = r_tcfd.pages;
  const frameworkDepthScore = Math.min(5, Math.floor((esrsDepth + griDepth + tcfdDepth) / 3));

  const hasMateriality = features.double_materiality || features.materiality_assessment;
  const hasGovernance = features.board_oversight || features.audit_committee || features.sustainability_committee;
  const hasScope12 = features.scope_1 || features.scope_2;
  const hasScope1and2 = features.scope_1 && features.scope_2;
  const hasTargets = features.targets || features.net_zero || features.sbti || features.transition_plan;
  const hasSocial = features.workforce || features.safety || features.diversity;
  const hasClimateStrategy = features.climate_scenario || features.paris_agreement || features.carbon_pricing;

  const climatePackageStrength = [
    features.scope_1, features.scope_2, features.scope_3,
    features.ghg_protocol, features.base_year, features.emissions_numbers,
    features.scope2_method, features.scope3_categories,
  ].filter(Boolean).length;

  const socialPackageStrength = [
    features.workforce, features.safety, features.diversity,
    features.human_rights, features.training, features.employee_turnover,
    features.health_wellbeing, features.living_wage,
  ].filter(Boolean).length;

  const govPackageStrength = [
    features.board_oversight, features.audit_committee, features.sustainability_committee,
    features.risk_management, features.internal_control, features.esg_remuneration,
    features.whistleblower, features.anti_corruption, features.data_privacy,
  ].filter(Boolean).length;

  // ═══════════════════════════════════════════════════════════════════
  // ── Completeness (0-100) ──
  // ═══════════════════════════════════════════════════════════════════
  let completeness = 0;

  if (hasAnyFramework) {
    const fBase = frameworkCount >= 5 ? 14 : frameworkCount >= 3 ? 12 : frameworkCount >= 2 ? 10 : 8;
    completeness += Math.min(18, fBase + Math.min(4, frameworkDepthScore));
  }

  if (hasMateriality) {
    completeness += features.double_materiality ? 8 : 5;
    completeness += features.materiality_matrix ? 2 : 0;
  }

  completeness += Math.min(8, govPackageStrength >= 5 ? 8 : govPackageStrength >= 3 ? 6 : hasGovernance ? 4 : 0);
  completeness += hasScope1and2 ? 8 : hasScope12 ? 5 : 0;
  completeness += features.scope_3 ? (features.scope3_categories ? 8 : 5) : 0;
  completeness += features.emissions_numbers ? 3 : 0;
  completeness += features.scope2_method ? 1 : 0;
  completeness += features.emissions_intensity ? 2 : 0;
  completeness += hasTargets ? (features.sbti ? 7 : 5) : 0;
  completeness += hasClimateStrategy ? 3 : 0;
  completeness += Math.min(8, [features.energy, features.water, features.waste, features.renewable_energy, features.biodiversity, features.circular_economy, features.pollution].filter(Boolean).length * 2);
  completeness += Math.min(10, socialPackageStrength >= 5 ? 10 : socialPackageStrength >= 3 ? 7 : hasSocial ? 4 : 0);
  completeness += features.value_chain || features.supply_chain ? 2 : 0;
  completeness += features.framework_eu_taxonomy ? (r_eu_tax.pages >= 3 ? 4 : 2) : 0;
  completeness += features.sector_specific ? 2 : 0;
  completeness = Math.min(100, completeness);

  // ═══════════════════════════════════════════════════════════════════
  // ── Consistency (0-100) ──
  // ═══════════════════════════════════════════════════════════════════
  let consistency = 0;
  const hasMethod = features.methodology;
  const hasBoundary = features.boundary;
  const hasComparatives = distinctYears.length >= 2;
  const hasLimitations = features.limitations || features.restatement;

  consistency += hasMethod && hasBoundary ? 18 : hasMethod ? 10 : hasBoundary ? 8 : 0;
  consistency += features.data_quality ? 2 : 0;
  consistency += features.ghg_protocol ? 7 : 0;
  consistency += features.base_year ? 3 : 0;
  consistency += features.reporting_period ? 5 : 0;

  if (hasComparatives) {
    consistency += distinctYears.length >= 4 ? 18 : distinctYears.length >= 3 ? 15 : 12;
  }

  consistency += Math.min(15,
    Math.min(5, Math.floor(percentageCount / 10)) +
    Math.min(5, Math.floor(tableRows / 5)) +
    Math.min(5, Math.floor(kpiNumbers.length / 8))
  );

  consistency += hasLimitations ? (features.restatement ? 10 : 7) : 0;
  const controlCount = [features.internal_control, features.risk_management, features.audit_committee].filter(Boolean).length;
  consistency += Math.min(8, controlCount * 3);
  const hasUnits = features.tco2e_units || corpus.includes("%") || /\b(mwh|kwh|gj|m3)\b/i.test(corpus);
  consistency += hasUnits ? 5 : 0;
  consistency += features.data_tables ? (tableRows >= 10 ? 4 : 2) : 0;
  consistency += features.quantitative_targets ? 5 : 0;
  consistency = Math.min(100, consistency);

  // ═══════════════════════════════════════════════════════════════════
  // ── Assurance (0-100) ──
  // ═══════════════════════════════════════════════════════════════════
  let assurance = 0;

  if (hasNoAssurance && !hasAssurance) {
    assurance = 0;
  } else if (hasReasonable && hasLimited) {
    assurance = 90;
  } else if (hasReasonable) {
    assurance = 82;
  } else if (hasLimited) {
    assurance = 60;
  } else if (hasAssurance) {
    assurance = 38;
  }

  if (assurance > 0 && (hasIsae || hasAa1000)) assurance = Math.min(100, assurance + 6);
  if (assurance > 0 && features.named_assurance_provider) assurance = Math.min(100, assurance + 5);
  if (assurance > 0 && features.assurance_scope) assurance = Math.min(100, assurance + 4);
  if (assurance > 0 && r_assurance_any.pages >= 5) assurance = Math.min(100, assurance + 3);
  assurance = Math.min(100, assurance);

  // ═══════════════════════════════════════════════════════════════════
  // ── Transparency (0-100) ──
  // ═══════════════════════════════════════════════════════════════════
  let transparency = 0;
  transparency += features.forward_looking ? 12 : 0;
  transparency += features.transition_plan ? 3 : 0;
  transparency += features.limitations ? 10 : 0;
  transparency += features.restatement ? 5 : 0;
  transparency += features.named_assurance_provider ? 8 : 0;
  transparency += hasMethod ? 8 : 0;
  transparency += features.data_quality ? 2 : 0;
  transparency += features.stakeholder_engagement ? 8 : 0;
  transparency += features.scope3_categories ? 7 : 0;
  transparency += features.reporting_period ? 4 : 0;
  transparency += features.boundary ? 5 : 0;
  transparency += features.quantitative_targets ? 5 : 0;
  transparency += features.target_progress ? 3 : 0;
  transparency += features.connectivity_financial ? 5 : 0;
  transparency += features.iro_analysis ? 3 : 0;
  transparency += features.materiality_matrix ? 2 : 0;
  transparency += features.esrs_datapoints ? 5 : 0;
  transparency += features.gri_content_index ? 3 : 0;
  transparency = Math.min(100, transparency);

  // ═══════════════════════════════════════════════════════════════════
  // ── Weighted overall score ──
  // ═══════════════════════════════════════════════════════════════════
  const WEIGHTS = { completeness: 0.35, consistency: 0.25, assurance: 0.20, transparency: 0.20 };
  const score = Math.round(WEIGHTS.completeness * completeness + WEIGHTS.consistency * consistency + WEIGHTS.assurance * assurance + WEIGHTS.transparency * transparency);

  function bandFromScore(s) {
    if (s >= 75) return "high";
    if (s >= 50) return "medium";
    return "low";
  }

  const featureCount = Object.values(features).filter(Boolean).length;
  const featureTotal = Object.keys(features).length;

  // Build improvement recommendations
  const recommendations = [];
  if (!features.scope_3) recommendations.push("Disclose Scope 3 emissions with category breakdown");
  else if (!features.scope3_categories) recommendations.push("Break down Scope 3 by upstream/downstream categories");
  if (!features.double_materiality) recommendations.push("Conduct and disclose double materiality assessment");
  if (!hasAssurance) recommendations.push("Obtain external assurance (limited or reasonable)");
  else if (!hasReasonable) recommendations.push("Upgrade from limited to reasonable assurance");
  if (!features.quantitative_targets) recommendations.push("Set quantitative targets with timelines");
  else if (!features.target_progress) recommendations.push("Report progress against quantitative targets");
  if (!features.transition_plan) recommendations.push("Publish a climate transition plan/roadmap");
  if (!features.methodology) recommendations.push("Disclose calculation methodologies for key metrics");
  if (!features.boundary) recommendations.push("Clarify organizational and operational boundaries");
  if (!features.base_year) recommendations.push("Define and disclose a base year for emissions tracking");
  if (!features.forward_looking) recommendations.push("Include forward-looking statements and strategic outlook");
  if (frameworkCount < 3) recommendations.push("Align with additional reporting frameworks (ESRS, GRI, TCFD)");

  return {
    version: Number.isFinite(version) ? version : 1,
    generatedAt,
    report: {
      id: safeString(reportId),
      key: safeString(reportKey),
      company: safeString(company),
      year: Number.isFinite(Number(year)) ? Number(year) : null,
    },
    score,
    band: bandFromScore(score),
    subscores: { completeness, consistency, assurance, transparency },
    features,
    featureCount,
    featureTotal,
    featureDepth,
    evidence,
    evidenceQuotes,
    recommendations: recommendations.slice(0, 6),
    quantitativeProfile: {
      percentageCount,
      tableRows,
      kpiNumbers: kpiNumbers.length,
      distinctYears: distinctYears.length,
      numericDensity: Math.round(corpusNumericDensity * 100) / 100,
    },
    method: {
      kind: DQ_METHOD_KIND,
      weights: WEIGHTS,
      corpusChars: corpus.length,
      corpusSampled: raw.length > sampled.length,
      pagesDetected: blocks.reduce((acc, b) => (Number.isFinite(Number(b?.page)) ? Math.max(acc, Number(b.page)) : acc), 0) || null,
      blocks: blocks.length,
    },
  };
}

// ── Shared migration logic (used by both GET and POST) ──────────────────────

async function migrateIfNeeded({ bucket, cached, reportId, reportKey, company, year, version, log, label }) {
  try {
    const j = JSON.parse(cached);
    const oldKind = safeString(j?.method?.kind || "");
    const cachedReportKey = normalizeReportKey(j?.report?.key || "") || reportKey;
    if (oldKind && oldKind !== DQ_METHOD_KIND && cachedReportKey) {
      const mdKey = markdownCacheKeyForReportKey(cachedReportKey);
      const markdown = await getCachedText(bucket, mdKey);
      if (markdown && safeString(markdown).trim()) {
        const migrated = computeDisclosureQuality(markdown, {
          company: company || safeString(j?.report?.company || ""),
          year: year ?? j?.report?.year ?? null,
          reportId,
          reportKey: cachedReportKey,
          version,
        });
        if (j?.method?.markdownTokens) migrated.method.markdownTokens = j.method.markdownTokens;
        migrated.method.migratedFrom = oldKind;

        const nextText = JSON.stringify(migrated, null, 2) + "\n";
        const scoreKey = disclosureScoreKey(reportId, version);
        const ok = await putTextSafe(bucket, scoreKey, nextText, "application/json; charset=utf-8", `${label} migration ${reportId}`, log);
        if (!ok) (log || console).error(`[DQ] Migration result for ${reportId} was NOT persisted (${label})`);
        return nextText;
      }
    }
  } catch {
    // Ignore parse issues; return null to use cached as-is
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Request handlers
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestGet(context) {
  const log = context._log || console;
  const requestId = context._requestId;
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
  };

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)", { requestId });
  }

  const url = new URL(context.request.url);
  const reportId = safeString(url.searchParams.get("reportId") || "").trim();
  const version = clampInt(url.searchParams.get("version"), 1, { min: 1, max: 10 });
  const summaryOnly = safeString(url.searchParams.get("summary") || "").trim() === "1";
  const refine = safeString(url.searchParams.get("refine") || "").trim() === "1";

  const idCheck = validateReportId(reportId);
  if (!idCheck.valid) {
    return errorResponse(400, ErrorCode.INVALID_REPORT_ID, idCheck.error, { requestId });
  }

  const key = disclosureScoreKey(reportId, version);
  if (!key) {
    return errorResponse(400, ErrorCode.INVALID_REPORT_ID, "Invalid reportId", { requestId });
  }

  let cached = await getCachedText(bucket, key);
  if (!cached) {
    return errorResponse(404, ErrorCode.NOT_FOUND, "Score not found", {
      requestId,
      details: { reportId, version },
    });
  }

  log.info("DQ score cache hit", { reportId, version });

  // Opportunistic migration
  const migrated = await migrateIfNeeded({ bucket, cached, reportId, reportKey: "", company: "", year: null, version, log, label: "GET" });
  if (migrated) cached = migrated;

  // Refine evidence with AI if requested
  if (refine) {
    try {
      const result = JSON.parse(cached);
      let changed = false;
      const ai = context.env.AI;
      const alreadyRefined = typeof result?.method?.evidenceRefinedByAI === "number" && result.method.evidenceRefinedByAI > 0;

      if (ai && result.evidenceQuotes && !alreadyRefined) {
        const refined = await refineEvidenceQuotesWithAI(ai, result);
        if (refined.changed) changed = true;
      }

      // Optional: FinBERT-9 topic profiling (cache hit enrichment)
      // Only runs when `refine=1` is requested to keep normal GET fast.
      const finbertUrl = safeString(context.env.FINBERT_URL || "").trim();
      const finbertApiKey = safeString(context.env.FINBERT_API_KEY || "").trim();
      const canFinbert = Boolean(context.env.FINBERT_CONTAINER || finbertUrl);
      const alreadyProfiled = Boolean(result?.topicProfile && typeof result.topicProfile === "object" && (result.topicProfile.by_category || result.topicProfile.by_pillar));

      if (canFinbert && result?.evidenceQuotes && !alreadyProfiled) {
        try {
          const finbertContainer = context.env.FINBERT_CONTAINER;

          // Collect evidence texts (up to 20 blocks)
          const evidenceTexts = [];
          for (const [, quotes] of Object.entries(result.evidenceQuotes || {})) {
            if (!Array.isArray(quotes)) continue;
            for (const q of quotes) {
              const text = safeString(q?.text || "").trim();
              if (text && text.length > 30 && evidenceTexts.length < 20) {
                evidenceTexts.push(text);
              }
            }
          }

          if (evidenceTexts.length > 0) {
            const classifications = await classifyChunks(evidenceTexts, {
              container: finbertContainer,
              baseUrl: finbertUrl,
              apiKey: finbertApiKey,
              batchSize: 16,
              concurrency: 2,
              minScore: 0.25,
            });

            const topicSummary = buildRoutingSummary(classifications);
            result.topicProfile = {
              model: topicSummary.model,
              evidence_blocks_classified: topicSummary.total_chunks,
              esg_relevant_blocks: topicSummary.routed_chunks,
              by_pillar: topicSummary.by_pillar,
              by_category: topicSummary.by_category,
            };
            changed = true;

            log.info("FinBERT-9 topic profiling complete (GET cache enrichment)", {
              reportId,
              blocks: evidenceTexts.length,
              esg: topicSummary.routed_chunks,
            });
          }
        } catch (err) {
          log.error("FinBERT-9 topic profiling failed (GET cache enrichment, non-fatal)", { error: err?.message || String(err) });
        }
      }

      if (changed) {
        const refinedText = JSON.stringify(result, null, 2) + "\n";
        cached = refinedText;
        const ok = await putTextSafe(bucket, key, refinedText, "application/json; charset=utf-8", `GET refine ${reportId}`, log);
        if (!ok) log.error("Refined result was NOT persisted", { reportId });
      }
    } catch {
      // Ignore refinement failures; return cached as-is
    }
  }

  if (!summaryOnly) {
    return new Response(cached, { headers: jsonHeaders });
  }

  try {
    const j = JSON.parse(cached);
    return new Response(JSON.stringify({
      version: j?.version ?? version,
      generatedAt: j?.generatedAt ?? null,
      report: j?.report ?? { id: reportId },
      score: j?.score ?? null,
      band: j?.band ?? null,
      subscores: j?.subscores ?? null,
    }), { headers: jsonHeaders });
  } catch {
    return errorResponse(500, ErrorCode.CACHE_CORRUPT, "Cached score JSON was invalid", { requestId });
  }
}

export async function onRequestPost(context) {
  const log = context._log || console;
  const requestId = context._requestId;
  const jsonHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
  };

  // Parse body
  const parsed = await validateJsonBody(context.request);
  if (!parsed.valid) {
    return errorResponse(400, ErrorCode.INVALID_JSON, parsed.error, { requestId });
  }

  const body = parsed.body;
  const meta = body?.meta || {};
  const opts = body?.options || {};

  const reportId = safeString(meta?.reportId || "").trim();
  const reportKey = normalizeReportKey(meta?.reportKey || "");
  const company = safeString(meta?.company || "");
  const publishedYear = meta?.publishedYear ?? meta?.year ?? null;
  const providedText = safeString(body?.text || "").trim();

  if (!reportId || !reportKey) {
    return errorResponse(400, ErrorCode.MISSING_PARAM, "Missing meta.reportId or meta.reportKey", { requestId });
  }

  const idCheck = validateReportId(reportId);
  if (!idCheck.valid) {
    return errorResponse(400, ErrorCode.INVALID_REPORT_ID, idCheck.error, { requestId });
  }

  const version = clampInt(opts?.version, 1, { min: 1, max: 10 });
  const force = safeBool(opts?.force);
  const store = opts?.store === undefined ? true : safeBool(opts?.store);

  const bucket = context.env.REPORTS_BUCKET;
  if (!bucket) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "R2 binding missing (REPORTS_BUCKET)", { requestId });
  }

  const scoreKey = disclosureScoreKey(reportId, version);
  if (!scoreKey) {
    return errorResponse(400, ErrorCode.INVALID_REPORT_ID, "Invalid reportId", { requestId });
  }

  log.info("DQ score request", { reportId, version, force, hasText: Boolean(providedText) });

  // Check cache (unless force recompute)
  if (!force) {
    const cached = await getCachedText(bucket, scoreKey);
    if (cached) {
      const migrated = await migrateIfNeeded({ bucket, cached, reportId, reportKey, company, year: publishedYear, version, log, label: "POST" });
      if (migrated) return new Response(migrated, { headers: jsonHeaders });
      return new Response(cached, { headers: jsonHeaders });
    }
  }

  // Load or generate report markdown
  let markdown = providedText;
  let mdTokens = null;

  if (!markdown) {
    const ai = context.env.AI;
    if (!ai) {
      return errorResponse(500, ErrorCode.BINDING_MISSING, "Workers AI binding missing (AI)", { requestId });
    }

    const mdKey = markdownCacheKeyForReportKey(reportKey);
    if (!force) {
      markdown = await getCachedText(bucket, mdKey);
    }

    if (!markdown) {
      const pdfObj = await bucket.get(reportKey);
      if (!pdfObj) {
        return errorResponse(404, ErrorCode.NOT_FOUND, "PDF not found in R2", { requestId, details: { reportKey } });
      }

      const ab = await pdfObj.arrayBuffer();
      const contentType = pdfObj.httpMetadata?.contentType || "application/pdf";
      const pdfBlob = new Blob([ab], { type: contentType });
      const name = fileNameFromKey(reportKey, "report.pdf");

      log.info("Converting PDF to markdown", { reportKey });

      const converted = await convertPdfToMarkdown({ ai, pdfBlob, name });
      if (!converted.ok) {
        return errorResponse(500, ErrorCode.PDF_CONVERSION_ERROR, safeString(converted.error || "toMarkdown failed"), { requestId });
      }

      markdown = converted.markdown;
      mdTokens = converted.tokens;

      // Cache markdown for future uses
      const mdMetaKey = markdownMetaKeyForReportKey(reportKey);
      const mdOk = await putTextSafe(bucket, mdKey, markdown, "text/markdown; charset=utf-8", `markdown ${reportKey}`, log);
      if (!mdOk) log.error("Markdown cache NOT persisted", { reportKey });
      const metaOk = await putJsonSafe(bucket, mdMetaKey, {
        reportKey,
        tokens: mdTokens,
        generatedAt: new Date().toISOString(),
      }, `markdown-meta ${reportKey}`, log);
      if (!metaOk) log.error("Markdown metadata NOT persisted", { reportKey });
    }
  }

  if (!markdown || !safeString(markdown).trim()) {
    return errorResponse(500, ErrorCode.INTERNAL_ERROR, "Markdown was empty after conversion/cache lookup", { requestId });
  }

  // Score
  const result = computeDisclosureQuality(markdown, {
    company,
    year: publishedYear,
    reportId,
    reportKey,
    version,
  });
  if (mdTokens !== null) result.method.markdownTokens = mdTokens;
  result.method.textProvided = Boolean(providedText);

  // Refine evidence quotes via AI
  const ai = context.env.AI;
  if (ai && result.evidenceQuotes) {
    try {
      await refineEvidenceQuotesWithAI(ai, result);
    } catch {
      result.method.evidenceRefinedByAI = 0;
    }
  }

  // ── Optional: FinBERT-9 topic profiling via hosted service (FINBERT_URL) ────────────────
  // If FINBERT_URL is configured, classify a sample of
  // evidence blocks through the real FinBERT model for topic enrichment.
  const finbertUrl = safeString(context.env.FINBERT_URL || "").trim();
  const finbertApiKey = safeString(context.env.FINBERT_API_KEY || "").trim();
  if ((context.env.FINBERT_CONTAINER || finbertUrl) && result.evidenceQuotes) {
    try {
      const finbertContainer = context.env.FINBERT_CONTAINER;

      // Collect unique evidence texts (up to 20 blocks)
      const evidenceTexts = [];
      for (const [, quotes] of Object.entries(result.evidenceQuotes)) {
        if (!Array.isArray(quotes)) continue;
        for (const q of quotes) {
          const text = safeString(q?.text || "").trim();
          if (text && text.length > 30 && evidenceTexts.length < 20) {
            evidenceTexts.push(text);
          }
        }
      }

      if (evidenceTexts.length > 0) {
        const classifications = await classifyChunks(evidenceTexts, {
          container: finbertContainer,
          baseUrl: finbertUrl,
          apiKey: finbertApiKey,
          batchSize: 16,
          concurrency: 2,
          minScore: 0.25,
        });

        const topicSummary = buildRoutingSummary(classifications);
        result.topicProfile = {
          model: topicSummary.model,
          evidence_blocks_classified: topicSummary.total_chunks,
          esg_relevant_blocks: topicSummary.routed_chunks,
          by_pillar: topicSummary.by_pillar,
          by_category: topicSummary.by_category,
        };
        log.info("FinBERT-9 topic profiling complete", {
          reportId,
          blocks: evidenceTexts.length,
          esg: topicSummary.routed_chunks,
        });
      }
    } catch (err) {
      log.error("FinBERT-9 topic profiling failed (non-fatal)", { error: err?.message || String(err) });
      // Non-fatal: DQ score is still valid without topic profiling
    }
  }

  // Store score in R2
  if (store) {
    const ok = await putJsonSafe(bucket, scoreKey, result, `score ${reportId}`, log);
    if (!ok) log.error("CRITICAL: Score computed but NOT persisted to R2", { reportId });
  }

  log.info("DQ score computed", { reportId, score: result.score, band: result.band });

  return new Response(JSON.stringify(result), { headers: jsonHeaders });
}
