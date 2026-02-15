// ─── Entity Extraction Endpoint ─────────────────────────────────────────────
// Hybrid ESG pipeline: ESG-BERT-inspired keyword router filters chunks by
// pillar (E/S/G/None), then Workers AI extracts structured entities only from
// ESG-relevant chunks — saving ~40-60% of LLM calls on typical reports.
//
// GET  /score/entity-extract?reportId=report-123   → fetch cached extractions
// POST /score/entity-extract  { reportId }         → compute + cache
//
// Pipeline: PDF → Markdown → Chunks → FinBERT Container → LangExtract → Entities

import {
  safeString,
  normalizeReportKey,
  markdownCacheKeyForReportKey,
  markdownMetaKeyForReportKey,
  fileNameFromKey,
  getCachedText,
  putText,
  putJson,
  putJsonSafe,
  convertPdfToMarkdown,
} from "../_lib/index.js";

import { ErrorCode, errorResponse } from "../_lib/errors.js";
import { validateReportId, validateJsonBody } from "../_lib/validation.js";
import { classifyChunks, buildRoutingSummary, CATEGORY_TO_PILLAR } from "../_lib/finbert-router.js";

// ── Constants ───────────────────────────────────────────────────────────────
const EXTRACT_METHOD_KIND = "hybrid-finbert9-langextract-v2";
const EXTRACT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_CHUNK_CHARS = 12000;
const CHUNK_OVERLAP = 600;
const MAX_ENTITIES_PER_CHUNK = 25;
const MAX_TOTAL_ENTITIES = 200;
const MAX_CHUNKS = 15;
const AI_CONCURRENCY = 3;


// ── R2 key helpers ──────────────────────────────────────────────────────────
function entityExtractKey(reportId, version = 1) {
  return `scores/entity_extract/v${version}/${safeString(reportId)}.json`;
}

// ── ESG extraction classes with pillar mapping ──────────────────────────────
const EXTRACTION_CLASSES = {
  ghg_emissions: { pillar: "E", label: "GHG Emissions" },
  climate_target: { pillar: "E", label: "Climate Target" },
  energy: { pillar: "E", label: "Energy" },
  water: { pillar: "E", label: "Water" },
  waste: { pillar: "E", label: "Waste" },
  biodiversity: { pillar: "E", label: "Biodiversity" },
  social_metric: { pillar: "S", label: "Social Metric" },
  governance_policy: { pillar: "G", label: "Governance / Policy" },
  financial_esg: { pillar: "G", label: "Financial ESG" },
  regulatory: { pillar: "G", label: "Regulatory Framework" },
};

// ── System prompt for entity extraction ─────────────────────────────────────
const SYSTEM_PROMPT = `You are an ESG entity extraction engine. You read sustainability report text and extract structured entities.

For each entity found, output a JSON object with:
- "class": one of: ghg_emissions, climate_target, energy, water, waste, biodiversity, social_metric, governance_policy, financial_esg, regulatory
- "text": the EXACT verbatim text from the source (do not paraphrase)
- "attrs": an object with meaningful attributes providing context

RULES:
1. Use EXACT verbatim text from the source for the "text" field. Do NOT paraphrase.
2. List entities in the order they appear.
3. Each entity MUST have meaningful attributes (e.g. scope, year, unit, value, metric, framework).
4. Prefer specific numeric data over vague qualitative statements.
5. If the text contains no ESG-relevant entities, return an empty array.
6. Return ONLY a valid JSON array. No markdown, no explanation text.

Extraction class definitions:
- ghg_emissions: GHG/CO₂/carbon emissions data (scope 1/2/3 figures, totals, intensity)
- climate_target: reduction targets, net-zero commitments, SBTi pledges, Paris-aligned goals
- energy: energy consumption, renewable energy %, MWh figures, efficiency
- water: water usage, withdrawal, recycling data
- waste: waste generation, recycling, hazardous waste
- biodiversity: ecological impacts, land use, deforestation
- social_metric: employee diversity, health & safety, training, community investment, human rights
- governance_policy: board oversight, ethics policies, anti-corruption, data privacy, risk management
- financial_esg: ESG-linked financial figures, green revenue, sustainable investment amounts
- regulatory: CSRD, TCFD, GRI, SASB, EU Taxonomy, ISSB references`;

const FEW_SHOT_USER = `Extract ESG entities from this text:

Scope 1 and 2 emissions: We will reduce our corporate emissions in line with a net-zero climate scenario by achieving a 100% reduction in absolute scope 1 and 2 GHG emissions by FY28 from a FY20 base year. Over FY24, we maintained scope 1 emissions at zero. Total carbon footprint: Scope 1 14,011 tCO2e, Scope 2 market-based 4,732 tCO2e, Scope 3 1,673,903 tCO2e. Carbon intensity 3.43 tCO2e/revenue US$'m. Energy use: Renewable 14,560 MWh, Non-renewable 62,129 MWh. Employee diversity: 42% women in management roles. Our Board approved an updated Data Privacy Policy in FY24. Our sustainability report was prepared in accordance with the GRI Standards 2021.`;

const FEW_SHOT_ASSISTANT = `[
  {"class":"climate_target","text":"100% reduction in absolute scope 1 and 2 GHG emissions by FY28","attrs":{"scope":"scope 1+2","reduction_pct":"100%","target_year":"FY28","base_year":"FY20","framework":"SBTi / Paris-aligned"}},
  {"class":"ghg_emissions","text":"scope 1 emissions at zero","attrs":{"scope":"scope 1","value":"0","unit":"tCO2e","period":"FY24"}},
  {"class":"ghg_emissions","text":"Scope 1 14,011 tCO2e","attrs":{"scope":"scope 1","value":"14011","unit":"tCO2e"}},
  {"class":"ghg_emissions","text":"Scope 2 market-based 4,732 tCO2e","attrs":{"scope":"scope 2 market-based","value":"4732","unit":"tCO2e"}},
  {"class":"ghg_emissions","text":"Scope 3 1,673,903 tCO2e","attrs":{"scope":"scope 3","value":"1673903","unit":"tCO2e"}},
  {"class":"ghg_emissions","text":"Carbon intensity 3.43 tCO2e/revenue US$'m","attrs":{"metric":"carbon intensity","value":"3.43","unit":"tCO2e/US$m revenue"}},
  {"class":"energy","text":"Renewable 14,560 MWh, Non-renewable 62,129 MWh","attrs":{"renewable_mwh":"14560","non_renewable_mwh":"62129","total_mwh":"76689"}},
  {"class":"social_metric","text":"42% women in management roles","attrs":{"metric":"gender diversity","value":"42%","scope":"management"}},
  {"class":"governance_policy","text":"Board approved an updated Data Privacy Policy in FY24","attrs":{"policy":"Data Privacy Policy","status":"approved / updated","year":"FY24"}},
  {"class":"regulatory","text":"prepared in accordance with the GRI Standards 2021","attrs":{"framework":"GRI Standards 2021","type":"reporting standard"}}
]`;

const FEW_SHOT_USER_2 = `Extract ESG entities from this text:

Our sustainability report was prepared in accordance with the GRI Standards 2021 and we applied the TCFD recommendations. Water withdrawal totalled 1.2 million m3, a 5% reduction from the prior year. Hazardous waste generated was 340 tonnes. We invested EUR 12 million in community development programmes.`;

const FEW_SHOT_ASSISTANT_2 = `[
  {"class":"regulatory","text":"prepared in accordance with the GRI Standards 2021","attrs":{"framework":"GRI Standards 2021","type":"reporting standard"}},
  {"class":"regulatory","text":"applied the TCFD recommendations","attrs":{"framework":"TCFD","type":"disclosure framework"}},
  {"class":"water","text":"Water withdrawal totalled 1.2 million m3","attrs":{"metric":"water withdrawal","value":"1200000","unit":"m3","change":"-5% YoY"}},
  {"class":"waste","text":"Hazardous waste generated was 340 tonnes","attrs":{"metric":"hazardous waste","value":"340","unit":"tonnes"}},
  {"class":"financial_esg","text":"invested EUR 12 million in community development programmes","attrs":{"metric":"community investment","value":"12000000","currency":"EUR"}}
]`;

// ── FinBERT-ESG-9-Categories routing is handled by the shared module ────────
// See functions/_lib/finbert-router.js for the real model integration.
// The router calls yiyanghkust/finbert-esg-9-categories running as an external
// HTTP service (FINBERT_URL) for genuine NLP-based ESG chunk classification.

// ── Text chunking ───────────────────────────────────────────────────────────
function chunkText(text, { maxChars = MAX_CHUNK_CHARS, overlapChars = CHUNK_OVERLAP } = {}) {
  const s = safeString(text).trim();
  if (!s) return [];
  if (s.length <= maxChars) return [s];

  const chunks = [];
  let start = 0;
  while (start < s.length) {
    let end = Math.min(s.length, start + maxChars);
    // Try to split on paragraph boundary
    const paraSplit = s.lastIndexOf("\n\n", end);
    if (paraSplit > start + Math.floor(maxChars * 0.5)) end = paraSplit;
    else {
      const sentSplit = s.lastIndexOf(". ", end);
      if (sentSplit > start + Math.floor(maxChars * 0.6)) end = sentSplit + 1;
    }

    const chunk = s.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= s.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}

// ── Normalize markdown for extraction ───────────────────────────────────────
function normalizeForExtraction(text) {
  let s = safeString(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");

  // Remove image markdown
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Remove empty links
  s = s.replace(/\[([^\]]*)\]\(\s*\)/g, "$1");
  // Clean up excessive whitespace
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/ *\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

// ── Parse LLM JSON response ────────────────────────────────────────────────
function parseLLMEntities(raw) {
  const s = safeString(raw).trim();
  if (!s) return [];

  // Try to find JSON array in the response
  let jsonStr = s;

  // Strip markdown fences if present
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  // Try to find array brackets
  const arrStart = jsonStr.indexOf("[");
  const arrEnd = jsonStr.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    // Validate and normalize each entity
    return parsed
      .filter((e) => e && typeof e === "object" && e.class && e.text)
      .filter((e) => EXTRACTION_CLASSES[e.class])
      .map((e) => ({
        extraction_class: safeString(e.class),
        extraction_text: safeString(e.text),
        attributes: e.attrs && typeof e.attrs === "object" ? e.attrs : {},
        pillar: EXTRACTION_CLASSES[e.class]?.pillar || "",
      }))
      .slice(0, MAX_ENTITIES_PER_CHUNK);
  } catch {
    return [];
  }
}

// ── Core extraction engine ──────────────────────────────────────────────────
// Best-effort grounding of extracted entities back to PDF pages.
// Works when the underlying markdown/text contains page markers such as:
//   - "### Page 12"
//   - "--- Page 12 ---"
//   - "Page 12:"
function splitIntoPages(rawText) {
  const s = safeString(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");

  const lines = s.split("\n");
  const pages = [];
  let pageNum = null;
  let title = null;
  let buf = [];

  const pushPage = () => {
    const text = buf.join("\n").trim();
    if (text) pages.push({ page: pageNum, title, text });
    buf = [];
  };

  for (const line of lines) {
    const rawLine = safeString(line);
    const trimmed = rawLine.trim();

    const mHeading = /^\s*#{1,6}\s*Page\s+(\d+)\s*(.*)$/.exec(rawLine);
    if (mHeading) {
      pushPage();
      pageNum = Number.parseInt(mHeading[1], 10);
      const t = safeString(mHeading[2] || "").trim();
      title = t || null;
      continue;
    }

    const mDash = /^\s*---\s*Page\s+(\d+)\s*---\s*$/.exec(trimmed);
    if (mDash) {
      pushPage();
      pageNum = Number.parseInt(mDash[1], 10);
      title = null;
      continue;
    }

    const mViewer = /^\s*Page\s+(\d+)\s*:\s*$/.exec(trimmed);
    if (mViewer) {
      pushPage();
      pageNum = Number.parseInt(mViewer[1], 10);
      title = null;
      continue;
    }

    buf.push(rawLine);
  }
  pushPage();

  if (pages.length === 0 && s.trim()) {
    pages.push({ page: null, title: null, text: s.trim() });
  }

  return pages;
}

function normalizeForSearch(text) {
  let s = safeString(text)
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "")
    .replace(/\u00ad/g, "")
    .toLowerCase();

  // Reduce markdown/noise a bit to improve substring matching.
  s = s.replace(/[`*_>#|]/g, " ");

  // Collapse whitespace.
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function tokensForSearch(text, { maxTokens = 14 } = {}) {
  const s = normalizeForSearch(text);
  if (!s) return [];
  const parts = s.split(/[^a-z0-9%]+/g).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length >= 3 || /\d/.test(p)) out.push(p);
    if (out.length >= maxTokens) break;
  }
  return out;
}

function groundEntitiesToPages(entities, sourceText) {
  const items = Array.isArray(entities) ? entities : [];
  const raw = safeString(sourceText);
  if (!items.length || !raw.trim()) {
    return { entities: items, pages_detected: 0 };
  }

  const pages = splitIntoPages(raw);
  const searchPages = pages.map((p) => ({
    page: Number.isFinite(Number(p.page)) ? Number(p.page) : null,
    title: safeString(p.title).trim() || null,
    search: normalizeForSearch(p.text),
  }));

  let cursor = 0;
  const grounded = items.map((ent) => ({ ...ent }));

  for (const ent of grounded) {
    const needle = normalizeForSearch(ent?.extraction_text || "");
    if (!needle || needle.length < 8) continue;

    let foundIdx = -1;

    for (let i = cursor; i < searchPages.length; i++) {
      if (searchPages[i].search.includes(needle)) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx === -1 && cursor > 0) {
      for (let i = 0; i < cursor; i++) {
        if (searchPages[i].search.includes(needle)) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx === -1) {
      const toks = tokensForSearch(ent?.extraction_text || "");
      if (toks.length >= 2) {
        let bestIdx = -1;
        let bestScore = 0;
        for (let i = 0; i < searchPages.length; i++) {
          const hay = searchPages[i].search;
          let score = 0;
          for (const t of toks) if (hay.includes(t)) score++;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }

        const threshold = Math.min(3, Math.max(2, Math.ceil(toks.length * 0.35)));
        if (bestIdx !== -1 && bestScore >= threshold) {
          foundIdx = bestIdx;
        }
      }
    }

    if (foundIdx !== -1) {
      ent.page = searchPages[foundIdx].page;
      ent.heading = searchPages[foundIdx].title;
      cursor = foundIdx;
    }
  }

  const pagesDetected = searchPages.some((p) => p.page != null)
    ? new Set(searchPages.filter((p) => p.page != null).map((p) => p.page)).size
    : 0;

  return { entities: grounded, pages_detected: pagesDetected };
}

async function extractEntities(ai, markdown, { reportId, reportKey, container, baseUrl, apiKey, debug = false } = {}) {
  const clean = normalizeForExtraction(markdown);
  if (!clean || clean.length < 100) {
    return {
      entities: [], chunks_processed: 0, total_chars: 0,
      routing: { model: "yiyanghkust/finbert-esg-9-categories", total_chunks: 0, routed_chunks: 0, skipped_chunks: 0, by_pillar: { E: 0, S: 0, G: 0 }, by_category: {}, efficiency_pct: 0 },
      _debug: debug ? { reason: "text too short" } : undefined,
    };
  }

  const allChunks = chunkText(clean).slice(0, MAX_CHUNKS);

  // ── Phase 1: REAL FinBERT-ESG-9-Categories via external service (FINBERT_URL) ──
  let classifications;
  try {
    classifications = await classifyChunks(allChunks, {
      container,
      baseUrl,
      apiKey,
      batchSize: 16,
      concurrency: 2,
      minScore: 0.3,
    });
  } catch (err) {
    console.error("[entity-extract] FinBERT-9 classification failed:", err?.message || err);
    // Graceful fallback: treat ALL chunks as ESG-relevant (no routing)
    classifications = allChunks.map((_, i) => ({
      index: i, category: "Unknown", pillar: null, score: 0, isESG: true, allScores: [],
      error: err?.message || "FinBERT container unavailable",
    }));
  }

  // Build routing results
  const routingResults = allChunks.map((chunk, i) => ({
    index: i,
    chunk,
    route: classifications[i] || { category: "Non-ESG", pillar: null, score: 0, isESG: false },
  }));

  const routed = routingResults.filter((r) => r.route.isESG);
  const routingSummary = buildRoutingSummary(classifications);

  console.log(
    `[entity-extract] FinBERT-9 model routing: ${routed.length}/${allChunks.length} chunks passed ` +
    `(E:${routingSummary.by_pillar.E} S:${routingSummary.by_pillar.S} G:${routingSummary.by_pillar.G}), ` +
    `${routingSummary.efficiency_pct}% skipped`
  );

  // ── Phase 2: LangExtract on routed chunks only ─────────────────────────
  const debugSamples = [];

  async function processChunk(chunkData) {
    const { index: i, chunk, route } = chunkData;
    try {
      const response = await ai.run(EXTRACT_MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: FEW_SHOT_USER },
          { role: "assistant", content: FEW_SHOT_ASSISTANT },
          { role: "user", content: FEW_SHOT_USER_2 },
          { role: "assistant", content: FEW_SHOT_ASSISTANT_2 },
          { role: "user", content: `Extract ESG entities from this sustainability report text:\n\n${chunk}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      });

      const responseData = response?.response;
      let entities = [];

      if (Array.isArray(responseData) && responseData.length > 0 && typeof responseData[0] === "object" && responseData[0]?.class) {
        entities = responseData
          .filter((e) => e && typeof e === "object" && e.class && e.text)
          .filter((e) => EXTRACTION_CLASSES[e.class])
          .map((e) => ({
            extraction_class: safeString(e.class),
            extraction_text: safeString(e.text),
            attributes: e.attrs && typeof e.attrs === "object" ? e.attrs : {},
            pillar: EXTRACTION_CLASSES[e.class]?.pillar || "",
          }))
          .slice(0, MAX_ENTITIES_PER_CHUNK);
      } else {
        let raw = "";
        if (typeof responseData === "string") {
          raw = responseData;
        } else if (Array.isArray(responseData)) {
          raw = responseData
            .map((m) => (typeof m === "string" ? m : m?.content || m?.text || (typeof m === "object" ? JSON.stringify(m) : String(m))))
            .join("");
        } else if (responseData && typeof responseData === "object") {
          raw = responseData.content || responseData.text || JSON.stringify(responseData);
        }
        raw = safeString(raw);
        entities = parseLLMEntities(raw);
      }

      // Attach FinBERT routing metadata to each entity
      return entities.map((ent) => ({
        ...ent,
        chunk_index: i,
        routed_pillar: route.pillar,
        routed_category: route.category,
        route_score: route.score,
      }));
    } catch (err) {
      const errMsg = err?.message || String(err);
      console.error(`[entity-extract] chunk ${i + 1}/${allChunks.length} failed:`, errMsg);
      if (debug && debugSamples.length < 3) {
        debugSamples.push({ chunk_index: i, routed_category: route.category, error: errMsg });
      }
      return [];
    }
  }

  // Run routed chunks in parallel batches of AI_CONCURRENCY
  const allEntities = [];
  for (let start = 0; start < routed.length; start += AI_CONCURRENCY) {
    const batch = routed.slice(start, start + AI_CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunkData) => processChunk(chunkData))
    );
    for (const ents of results) allEntities.push(...ents);
    if (allEntities.length >= MAX_TOTAL_ENTITIES) break;
  }

  // Deduplicate by extraction_text (keep first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const ent of allEntities) {
    const key = `${ent.extraction_class}::${ent.extraction_text.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ent);
    }
  }

  return {
    entities: deduped.slice(0, MAX_TOTAL_ENTITIES),
    chunks_processed: routed.length,
    total_chars: clean.length,
    routing: routingSummary,
    ...(debug ? {
      _debug: {
        samples: debugSamples,
        chunk_count: allChunks.length,
        routed_count: routed.length,
        first_chunk_chars: allChunks[0]?.length || 0,
        routing_details: classifications.map((c) => ({
          index: c.index,
          category: c.category,
          pillar: c.pillar,
          score: Math.round(c.score * 10000) / 10000,
          isESG: c.isESG,
          top3: (c.allScores || []).slice(0, 3).map((s) => ({ label: s.label, score: Math.round(s.score * 10000) / 10000 })),
        })),
      },
    } : {}),
  };
}

// ── Build summary from entities ─────────────────────────────────────────────
function buildSummary(entities) {
  const byPillar = { E: 0, S: 0, G: 0 };
  const byClass = {};

  for (const ent of entities) {
    if (ent.pillar) byPillar[ent.pillar] = (byPillar[ent.pillar] || 0) + 1;
    byClass[ent.extraction_class] = (byClass[ent.extraction_class] || 0) + 1;
  }

  const total = entities.length;
  const pillarShare = {};
  for (const [p, count] of Object.entries(byPillar)) {
    pillarShare[p] = total > 0 ? Math.round((count / total) * 100) / 100 : 0;
  }

  return {
    total_entities: total,
    by_pillar: byPillar,
    pillar_share: pillarShare,
    by_class: byClass,
  };
}

// ── GET handler ─────────────────────────────────────────────────────────────
async function handleGet(request, env) {
  const url = new URL(request.url);
  const reportId = safeString(url.searchParams.get("reportId")).trim();

  const check = validateReportId(reportId);
  if (!check.valid) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, check.error);
  }

  const cacheKey = entityExtractKey(reportId);
  try {
    const obj = await env.REPORTS_BUCKET.get(cacheKey);
    if (!obj) {
      return Response.json(
        { ok: true, reportId, cached: false, entities: null },
        { status: 200 }
      );
    }

    const cached = JSON.parse(await obj.text());
    return Response.json({ ok: true, reportId, cached: true, ...cached }, { status: 200 });
  } catch (err) {
    console.error("[entity-extract] GET error:", err);
    return errorResponse(500, ErrorCode.INTERNAL_ERROR, "Failed to read cached extractions");
  }
}

// ── POST handler ────────────────────────────────────────────────────────────
async function handlePost(request, env) {
  const { valid, body, error, code } = await validateJsonBody(request);
  if (!valid) return errorResponse(400, code || ErrorCode.BAD_REQUEST, error);

  const reportId = safeString(body?.reportId).trim();
  const reportKey = safeString(body?.reportKey).trim();
  const providedText = safeString(body?.text || body?.markdown).trim();
  const force = body?.force === true;
  const debug = body?.debug === true;

  const check = validateReportId(reportId);
  if (!check.valid) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, check.error);
  }
  if (!reportKey) {
    return errorResponse(400, ErrorCode.MISSING_PARAM, "Missing reportKey");
  }

  const normalizedKey = normalizeReportKey(reportKey);
  if (!normalizedKey) {
    return errorResponse(400, ErrorCode.BAD_REQUEST, "Invalid reportKey");
  }

  // ── Check cache ───────────────────────────────────────────────────────
  const cacheKey = entityExtractKey(reportId);
  if (!force) {
    try {
      const obj = await env.REPORTS_BUCKET.get(cacheKey);
      if (obj) {
        const cached = JSON.parse(await obj.text());
        return Response.json({ ok: true, reportId, cached: true, ...cached }, { status: 200 });
      }
    } catch { /* proceed to compute */ }
  }

  // ── Get markdown (from cache or convert PDF) ──────────────────────────
  let markdown = providedText || "";
  const mdKey = markdownCacheKeyForReportKey(normalizedKey);
  if (!markdown) {
    try {
      markdown = await getCachedText(env.REPORTS_BUCKET, mdKey);
    } catch { /* not cached */ }
  }

  if (!markdown) {
    const ai = env.AI;
    if (!ai) {
      return errorResponse(500, ErrorCode.BINDING_MISSING, "Workers AI binding missing (AI)");
    }

    try {
      const pdfObj = await env.REPORTS_BUCKET.get(normalizedKey);
      if (!pdfObj) {
        return errorResponse(404, ErrorCode.NOT_FOUND, `Report PDF not found: ${normalizedKey}`);
      }

      const ab = await pdfObj.arrayBuffer();
      const contentType = pdfObj.httpMetadata?.contentType || "application/pdf";
      const pdfBlob = new Blob([ab], { type: contentType });
      const name = fileNameFromKey(normalizedKey, "report.pdf");

      const converted = await convertPdfToMarkdown({ ai, pdfBlob, name });
      if (!converted.ok) {
        return errorResponse(500, ErrorCode.PDF_CONVERSION_ERROR, safeString(converted.error || "toMarkdown failed"));
      }

      markdown = converted.markdown;

      // Cache markdown for future uses
      if (markdown) {
        await putText(env.REPORTS_BUCKET, mdKey, markdown, "text/markdown; charset=utf-8");
        const metaKey = markdownMetaKeyForReportKey(normalizedKey);
        await putJsonSafe(env.REPORTS_BUCKET, metaKey, {
          reportKey: normalizedKey,
          generatedAt: new Date().toISOString(),
          source: "entity-extract",
        });
      }
    } catch (err) {
      console.error("[entity-extract] PDF conversion failed:", err);
      return errorResponse(500, ErrorCode.INTERNAL_ERROR, "Failed to convert PDF to text");
    }
  }

  if (!markdown || markdown.length < 100) {
    return errorResponse(422, ErrorCode.BAD_REQUEST, "Report text too short for extraction");
  }

  // ── Run extraction ────────────────────────────────────────────────────
  if (!env.AI) {
    return errorResponse(500, ErrorCode.BINDING_MISSING, "Workers AI binding missing (AI)");
  }

  const t0 = Date.now();
  let result;
  try {
    // Use the Service Binding to the FinBERT container worker
    // If not configured (local dev or first deploy), pass undefined to trigger fallback
    const finbertContainer = env.FINBERT_CONTAINER;
    const finbertUrl = safeString(env.FINBERT_URL || "").trim();
    const finbertApiKey = safeString(env.FINBERT_API_KEY || "").trim();
    result = await extractEntities(env.AI, markdown, { reportId, reportKey: normalizedKey, container: finbertContainer, baseUrl: finbertUrl, apiKey: finbertApiKey, debug });
  } catch (err) {
    console.error("[entity-extract] extraction failed:", err);
    return errorResponse(500, ErrorCode.AI_ERROR, "Entity extraction failed");
  }
  const durationMs = Date.now() - t0;

  // ── Build response ────────────────────────────────────────────────────
  const grounded = groundEntitiesToPages(result.entities, normalizeForExtraction(markdown));
  const summary = buildSummary(grounded.entities);

  const payload = {
    reportId,
    reportKey: normalizedKey,
    method: { kind: EXTRACT_METHOD_KIND, model: EXTRACT_MODEL, textProvided: Boolean(providedText) },
    summary,
    routing: result.routing,
    entities: grounded.entities,
    meta: {
      chunks_processed: result.chunks_processed,
      total_chunks: result.routing?.total_chunks || 0,
      total_chars: result.total_chars,
      pages_detected: grounded.pages_detected,
      routing_efficiency_pct: result.routing?.efficiency_pct || 0,
      duration_ms: durationMs,
      ts: Date.now(),
    },
    ...(debug && result._debug ? { _debug: result._debug } : {}),
  };

  // ── Cache in R2 ───────────────────────────────────────────────────────
  try {
    await putJson(env.REPORTS_BUCKET, cacheKey, payload);
  } catch (err) {
    console.error("[entity-extract] cache write failed:", err);
  }

  return Response.json({ ok: true, reportId, cached: false, ...payload }, { status: 200 });
}

// ── Request handler ─────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") return handleGet(request, env);
  if (request.method === "POST") return handlePost(request, env);

  return errorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed");
}
