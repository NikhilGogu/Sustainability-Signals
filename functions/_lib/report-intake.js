import { PDFDocument } from "pdf-lib";
import { safeString, fnv1a } from "./utils.js";

export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024; // 80 MB
export const MAX_MARKDOWN_CHARS_FOR_ANALYSIS = 900_000;
export const CLASSIFIER_MODEL_DEFAULT = "@cf/meta/llama-3.1-8b-instruct";
export const METADATA_MODEL_DEFAULT = "@cf/meta/llama-3.1-8b-instruct";
export const EMBEDDING_BATCH = 24;
export const MAX_CHUNK_CHARS = 1200;
export const CHUNK_OVERLAP = 150;

const POSITIVE_PATTERNS = [
  { key: "sustainability", re: /\bsustainab(?:ility|le)\b/gi, w: 5 },
  { key: "esg", re: /\besg\b/gi, w: 4 },
  { key: "csrd_esrs", re: /\b(?:csrd|esrs|efrag)\b/gi, w: 4 },
  { key: "gri_tcfd_issb", re: /\b(?:gri|tcfd|issb|ifrs\s*s[12])\b/gi, w: 3 },
  { key: "taxonomy", re: /\b(?:eu\s+taxonomy|taxonomy[-\s]+aligned|taxonomy[-\s]+eligible)\b/gi, w: 3 },
  { key: "materiality", re: /\b(?:double\s+materiality|materiality|iro)\b/gi, w: 3 },
  { key: "ghg", re: /\b(?:scope\s*[123]|ghg|co2e?|tco2e?|emissions?)\b/gi, w: 3 },
  { key: "climate", re: /\b(?:climate|net[\s-]*zero|decarboni[sz]ation|sbti)\b/gi, w: 3 },
  { key: "environment", re: /\b(?:energy|renewable|water|waste|biodiversity|circular)\b/gi, w: 2 },
  { key: "social_governance", re: /\b(?:human\s+rights|diversity|workforce|safety|anti[\s-]*corruption|governance)\b/gi, w: 2 },
  { key: "assurance", re: /\b(?:limited\s+assurance|reasonable\s+assurance|isae\s*3000|independent\s+assurance)\b/gi, w: 3 },
];

const NEGATIVE_PATTERNS = [
  { re: /\bconsolidated\s+financial\s+statements?\b/gi, w: 5 },
  { re: /\bnotes?\s+to\s+the\s+consolidated\s+financial\s+statements?\b/gi, w: 4 },
  { re: /\b(?:income\s+statement|statement\s+of\s+profit|balance\s+sheet|cash\s+flow\s+statement)\b/gi, w: 3 },
  { re: /\b(?:earnings\s+per\s+share|dividend|share\s+capital|ifrs\s+accounts?)\b/gi, w: 2 },
];

const GICS_SECTORS = [
  "Energy",
  "Materials",
  "Industrials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Information Technology",
  "Communication Services",
  "Utilities",
  "Real Estate",
];

const GICS_INDUSTRY_GROUPS = [
  "Energy",
  "Materials",
  "Capital Goods",
  "Commercial & Professional Services",
  "Transportation",
  "Automobiles & Components",
  "Consumer Durables & Apparel",
  "Consumer Services",
  "Retailing",
  "Consumer Discretionary Distribution & Retail",
  "Consumer Staples Distribution & Retail",
  "Food & Staples Retailing",
  "Food, Beverage & Tobacco",
  "Household & Personal Products",
  "Health Care Equipment & Services",
  "Pharmaceuticals, Biotechnology & Life Sciences",
  "Banks",
  "Financial Services",
  "Insurance",
  "Software & Services",
  "Technology Hardware & Equipment",
  "Semiconductors & Semiconductor Equipment",
  "Telecommunication Services",
  "Media & Entertainment",
  "Utilities",
  "Real Estate",
];

/**
 * @param {string} text
 * @returns {string}
 */
export function collapseWhitespace(text) {
  return safeString(text).replace(/\s+/g, " ").trim();
}

/**
 * @param {string} text
 * @param {RegExp} pattern
 * @param {number} [cap=25]
 * @returns {number}
 */
function countMatches(text, pattern, cap = 25) {
  const matches = safeString(text).match(pattern) || [];
  return Math.min(matches.length, cap);
}

/**
 * Best-effort split by page markers produced by AI.toMarkdown.
 * @param {string} markdown
 * @returns {Array<{page:number,text:string}>}
 */
export function splitMarkdownIntoPages(markdown) {
  const input = safeString(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");

  const lines = input.split("\n");
  const pages = [];
  let currentPage = null;
  let buffer = [];

  const flush = () => {
    if (currentPage == null) return;
    const text = buffer.join("\n").trim();
    pages.push({ page: currentPage, text });
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = safeString(rawLine);
    const trimmed = line.trim();

    let m = /^\s*#{1,6}\s*Page\s+(\d+)\b.*$/i.exec(line);
    if (!m) m = /^\s*---\s*Page\s+(\d+)\s*---\s*$/i.exec(trimmed);
    if (!m) m = /^\s*Page\s+(\d+)\s*:\s*$/i.exec(trimmed);

    if (m) {
      flush();
      currentPage = Number.parseInt(m[1], 10);
      continue;
    }

    if (currentPage == null) continue;
    buffer.push(line);
  }
  flush();

  if (pages.length > 0) return pages;

  // Fallback when page markers are absent.
  const single = collapseWhitespace(input);
  return single ? [{ page: 1, text: single }] : [];
}

/**
 * @param {Array<{page:number,text:string}>} pages
 */
export function analyzeSustainabilityPages(pages) {
  const pageScores = [];
  const globalHits = new Map();
  let totalPositive = 0;
  let totalNegative = 0;

  for (const p of pages) {
    const text = safeString(p.text || "").slice(0, 12_000).toLowerCase();
    let positive = 0;
    let negative = 0;
    const hitKeys = [];

    for (const pattern of POSITIVE_PATTERNS) {
      const count = countMatches(text, pattern.re, 20);
      if (count > 0) {
        positive += count * pattern.w;
        hitKeys.push(pattern.key);
        globalHits.set(pattern.key, (globalHits.get(pattern.key) || 0) + count);
      }
    }
    for (const pattern of NEGATIVE_PATTERNS) {
      const count = countMatches(text, pattern.re, 15);
      if (count > 0) negative += count * pattern.w;
    }

    totalPositive += positive;
    totalNegative += negative;

    const score = positive - negative;
    const isCandidate = score >= 8 || positive >= 12;
    pageScores.push({
      page: p.page,
      score,
      positive,
      negative,
      isCandidate,
      hitKeys,
      snippet: collapseWhitespace(p.text).slice(0, 420),
    });
  }

  // Merge candidate pages into spans with tolerance for one gap page.
  const spans = [];
  let start = null;
  let end = null;
  let scoreSum = 0;
  let pagesInSpan = 0;
  let lastPage = null;

  for (const row of pageScores) {
    if (!row.isCandidate) continue;

    if (start == null) {
      start = row.page;
      end = row.page;
      scoreSum = row.score;
      pagesInSpan = 1;
      lastPage = row.page;
      continue;
    }

    if (lastPage != null && row.page <= lastPage + 2) {
      end = row.page;
      scoreSum += row.score;
      pagesInSpan += 1;
      lastPage = row.page;
      continue;
    }

    spans.push({
      start,
      end,
      pages: pagesInSpan,
      score: scoreSum,
      rank: scoreSum + pagesInSpan * 2,
    });
    start = row.page;
    end = row.page;
    scoreSum = row.score;
    pagesInSpan = 1;
    lastPage = row.page;
  }
  if (start != null && end != null) {
    spans.push({
      start,
      end,
      pages: pagesInSpan,
      score: scoreSum,
      rank: scoreSum + pagesInSpan * 2,
    });
  }

  spans.sort((a, b) => b.rank - a.rank);
  const primarySpan = spans[0] || null;

  const totalPages = pages.length;
  const candidatePages = pageScores.filter((x) => x.isCandidate).length;
  const coverage = primarySpan ? primarySpan.pages / Math.max(1, totalPages) : 0;
  const hitBreadth = globalHits.size;
  const rawScore = totalPositive - totalNegative;

  const isSustainabilityByHeuristic =
    rawScore >= 80 &&
    hitBreadth >= 5 &&
    candidatePages >= Math.max(3, Math.floor(totalPages * 0.06));

  const looksLikeSustainabilityOnly =
    primarySpan != null &&
    coverage >= 0.72 &&
    candidatePages / Math.max(1, totalPages) >= 0.6;

  return {
    totalPages,
    totalPositive,
    totalNegative,
    rawScore,
    hitBreadth,
    candidatePages,
    isSustainabilityByHeuristic,
    looksLikeSustainabilityOnly,
    primarySpan,
    spans,
    pageScores,
  };
}

/**
 * @param {unknown} text
 * @returns {any|null}
 */
export function parseJsonObject(text) {
  const s = safeString(text).trim();
  if (!s) return null;

  try {
    return JSON.parse(s);
  } catch {
    // Continue to fenced/substring parsing.
  }

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue.
    }
  }

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
export function clampPage(n, min, max) {
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

/**
 * @param {Array<{page:number,score:number,snippet:string,isCandidate:boolean}>} pageScores
 * @returns {string}
 */
function buildAiSample(pageScores) {
  const topByScore = [...pageScores].sort((a, b) => b.score - a.score).slice(0, 18);
  const firstPages = [...pageScores].sort((a, b) => a.page - b.page).slice(0, 5);
  const tailPages = [...pageScores].sort((a, b) => b.page - a.page).slice(0, 3);

  const seen = new Set();
  const picked = [];
  for (const row of [...firstPages, ...topByScore, ...tailPages]) {
    if (seen.has(row.page)) continue;
    seen.add(row.page);
    picked.push(row);
  }
  picked.sort((a, b) => a.page - b.page);

  return picked
    .map((row) => `Page ${row.page} | score=${row.score} | candidate=${row.isCandidate ? "yes" : "no"}\n${row.snippet}`)
    .join("\n\n");
}

/**
 * Ask Workers AI to validate report type and page range.
 * @param {{ ai: any; model: string; totalPages: number; heuristic: any }} input
 */
export async function classifyReportWithAi(input) {
  const { ai, model, totalPages, heuristic } = input;
  if (!ai) return null;

  const pagesText = buildAiSample(heuristic.pageScores);
  const prompt =
    "You are a strict sustainability reporting classifier.\n" +
    "Decide if this PDF is a sustainability report, and if it is an annual/full report that contains a sustainability section.\n" +
    "Return ONLY JSON with keys:\n" +
    "{\n" +
    '  "isSustainabilityReport": boolean,\n' +
    '  "reportType": "sustainability-only" | "annual-with-sustainability-section" | "other",\n' +
    '  "sustainabilityStartPage": number | null,\n' +
    '  "sustainabilityEndPage": number | null,\n' +
    '  "confidence": number,\n' +
    '  "reason": string\n' +
    "}\n" +
    "Rules:\n" +
    "- If content is mostly financial statements and no real ESG disclosure, mark as other.\n" +
    "- If it includes sustainability disclosures as a section inside a broader annual report, mark annual-with-sustainability-section.\n" +
    "- Pick start/end pages only for the sustainability section.\n" +
    "- Confidence must be 0..1.\n\n" +
    `Total pages: ${totalPages}\n` +
    `Heuristic suggested span: ${heuristic.primarySpan ? `${heuristic.primarySpan.start}-${heuristic.primarySpan.end}` : "none"}\n\n` +
    `Page evidence:\n${pagesText}`;

  const result = await ai.run(model, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 420,
  });
  return parseJsonObject(result?.response || result);
}

/**
 * @param {string} name
 * @returns {number|null}
 */
function yearFromFileName(name) {
  const years = [...safeString(name).matchAll(/\b(19|20)\d{2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100);
  if (years.length === 0) return null;
  return Math.min(...years);
}

/**
 * @param {string} name
 * @returns {string}
 */
function companyFromFileName(name) {
  const base = safeString(name).replace(/\.pdf$/i, "");
  const cleaned = base
    .replace(/\b(annual|sustainability|integrated|report|esg|statement|fy\d{2,4}|20\d{2})\b/gi, " ")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown Company";
}

function normalizeChoice(v, allowed, fallback) {
  const s = collapseWhitespace(safeString(v));
  if (!s) return fallback;
  const exact = allowed.find((a) => a.toLowerCase() === s.toLowerCase());
  return exact || fallback;
}

/**
 * @param {{ ai:any; model:string; fileName:string; totalPages:number; heuristic:any; classifier:any; pages:Array<{page:number,text:string}> }} input
 */
export async function suggestMetadataWithAi(input) {
  const { ai, model, fileName, totalPages, heuristic, classifier, pages } = input;
  if (!ai) return null;

  const firstPages = [...pages].sort((a, b) => a.page - b.page).slice(0, 8);
  const topPages = [...heuristic.pageScores].sort((a, b) => b.score - a.score).slice(0, 8);
  const snippets = [];
  for (const p of firstPages) {
    const snippet = collapseWhitespace(p.text).slice(0, 450);
    if (snippet) snippets.push(`Page ${p.page}: ${snippet}`);
  }
  for (const p of topPages) {
    if (snippets.some((s) => s.startsWith(`Page ${p.page}:`))) continue;
    const snippet = collapseWhitespace(p.snippet).slice(0, 450);
    if (snippet) snippets.push(`Page ${p.page}: ${snippet}`);
  }

  const prompt =
    "Extract metadata from this sustainability disclosure.\n" +
    "Return ONLY JSON with keys:\n" +
    "{\n" +
    '  "company": string,\n' +
    '  "publishedYear": number,\n' +
    '  "country": string,\n' +
    '  "sector": string,\n' +
    '  "industry": string,\n' +
    '  "confidence": number,\n' +
    '  "reason": string\n' +
    "}\n" +
    "Sector must be one of:\n" +
    `${GICS_SECTORS.join(", ")}\n` +
    "Industry must be one of:\n" +
    `${GICS_INDUSTRY_GROUPS.join(", ")}\n` +
    "If uncertain, return sector='Information Technology' and industry='Software & Services'.\n\n" +
    `File name: ${fileName}\n` +
    `Total pages: ${totalPages}\n` +
    `Classifier type: ${safeString(classifier?.reportType || "")}\n` +
    `Classifier reason: ${safeString(classifier?.reason || "")}\n` +
    `Heuristic span: ${heuristic.primarySpan ? `${heuristic.primarySpan.start}-${heuristic.primarySpan.end}` : "none"}\n\n` +
    `Content snippets:\n${snippets.join("\n\n")}`;

  const out = await ai.run(model, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 380,
  });
  const parsed = parseJsonObject(out?.response || out);
  if (!parsed || typeof parsed !== "object") return null;

  const fallbackYear = yearFromFileName(fileName) || new Date().getUTCFullYear() - 1;
  const fallbackCompany = companyFromFileName(fileName);

  const year = Number.parseInt(safeString(parsed.publishedYear), 10);
  const publishedYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : fallbackYear;

  return {
    company: collapseWhitespace(safeString(parsed.company)) || fallbackCompany,
    publishedYear,
    country: collapseWhitespace(safeString(parsed.country)) || "Unknown",
    sector: normalizeChoice(parsed.sector, GICS_SECTORS, "Information Technology"),
    industry: normalizeChoice(parsed.industry, GICS_INDUSTRY_GROUPS, "Software & Services"),
    sourceSector: "",
    sourceIndustry: "",
    confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0.5,
    reason: collapseWhitespace(safeString(parsed.reason)),
  };
}

/**
 * @param {ArrayBuffer} bytes
 * @returns {Promise<string>}
 */
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = new Uint8Array(digest);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * Extract an inclusive page range from PDF bytes.
 * @param {{ bytes: ArrayBuffer; startPage: number; endPage: number }} input
 * @returns {Promise<Uint8Array>}
 */
export async function extractPageRangePdf(input) {
  const { bytes, startPage, endPage } = input;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const start = Math.max(1, Math.min(startPage, total));
  const end = Math.max(1, Math.min(endPage, total));
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  const out = await PDFDocument.create();
  const indexes = [];
  for (let p = lo; p <= hi; p++) indexes.push(p - 1);
  const copied = await out.copyPages(src, indexes);
  for (const page of copied) out.addPage(page);
  return out.save();
}

/**
 * Build markdown constrained to a selected page range.
 * @param {Array<{page:number,text:string}>} pages
 * @param {number} start
 * @param {number} end
 */
export function markdownForRange(pages, start, end) {
  const chunks = [];
  for (const p of pages) {
    if (p.page < start || p.page > end) continue;
    const text = safeString(p.text).trim();
    if (!text) continue;
    chunks.push(`### Page ${p.page}\n${text}`);
  }
  return chunks.join("\n\n");
}

/**
 * @param {string} text
 * @param {{ maxChars?: number; overlapChars?: number }} [opts]
 * @returns {string[]}
 */
export function chunkText(text, opts = {}) {
  const maxChars = Number.isFinite(opts.maxChars) ? Number(opts.maxChars) : MAX_CHUNK_CHARS;
  const overlapChars = Number.isFinite(opts.overlapChars) ? Number(opts.overlapChars) : CHUNK_OVERLAP;
  const s = collapseWhitespace(text);
  if (!s) return [];
  if (s.length <= maxChars) return [s];

  const chunks = [];
  let start = 0;
  while (start < s.length) {
    let end = Math.min(s.length, start + maxChars);
    const split = s.lastIndexOf(" ", end);
    if (split > start + Math.floor(maxChars * 0.6)) end = split;

    const chunk = s.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= s.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}

/**
 * @param {any} ai
 * @param {string} model
 * @param {string[]|string} text
 * @param {"cls"|"mean"} pooling
 */
export async function embedText(ai, model, text, pooling) {
  const out = await ai.run(model, { text, pooling });
  if (out && typeof out === "object" && Array.isArray(out.data)) return out.data;
  return null;
}

/**
 * @param {{ ai:any; vectorIndex:any; reportId:string; markdown:string; embeddingModel:string; pooling:"cls"|"mean" }} input
 */
export async function indexMarkdown(input) {
  const { ai, vectorIndex, reportId, markdown, embeddingModel, pooling } = input;
  if (!ai || !vectorIndex || !reportId || !markdown.trim()) return 0;
  const chunks = chunkText(markdown);
  if (chunks.length === 0) return 0;

  let upserted = 0;
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH);
    const embedded = await embedText(ai, embeddingModel, batch, pooling);
    if (!Array.isArray(embedded) || embedded.length !== batch.length) continue;

    const vectors = [];
    for (let j = 0; j < batch.length; j++) {
      const values = embedded[j];
      if (!Array.isArray(values) || values.length === 0) continue;
      const text = batch[j];
      vectors.push({
        id: `${reportId}:ingest:${i + j}:${fnv1a(text)}`,
        namespace: reportId,
        values,
        metadata: { source: "ingest", chunk: i + j, text: text.slice(0, 1500) },
      });
    }

    if (vectors.length > 0) {
      await vectorIndex.upsert(vectors);
      upserted += vectors.length;
    }
  }

  return upserted;
}

