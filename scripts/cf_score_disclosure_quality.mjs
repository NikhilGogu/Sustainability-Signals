#!/usr/bin/env node
/**
 * Trigger Cloudflare-side Disclosure Quality scoring by calling the deployed
 * `/score/disclosure-quality` endpoint.
 *
 * This leverages:
 * - R2 (cached PDF + cached markdown)
 * - Workers AI (toMarkdown) when markdown isn't cached yet
 *
 * Usage:
 *   node scripts/cf_score_disclosure_quality.mjs --score-url https://<your-site>/score/disclosure-quality --concurrency 2
 *   node scripts/cf_score_disclosure_quality.mjs --score-url https://<your-site> --year 2024 --limit 50
 *   node scripts/cf_score_disclosure_quality.mjs --score-url https://<your-site> --include-cached
 *
 * Notes:
 * - Results are cached in R2 at `scores/disclosure_quality/v1/<reportId>.json`.
 * - By default the script probes `/score/disclosure-quality-batch` first and skips cached reports.
 */

import fs from "node:fs/promises";
import process from "node:process";
import path from "node:path";

const DEFAULT_INDEX = "src/data/reportsIndex.json";

function parseArgs(argv) {
  const out = {
    index: DEFAULT_INDEX,
    scoreUrl: process.env.CF_SCORE_URL || "",
    year: null,
    limit: 0,
    start: 0,
    concurrency: 2,
    timeoutMs: 90_000,
    sleepMs: 0,
    retries: 3,
    retryDelayMs: 1200,
    dryRun: false,
    force: false,
    skipCached: true,
    outNdjson: "",
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--index" && argv[i + 1]) out.index = argv[++i];
    else if ((a === "--score-url" || a === "--url") && argv[i + 1]) out.scoreUrl = argv[++i];
    else if (a === "--year" && argv[i + 1]) out.year = Number(argv[++i]);
    else if (a === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a === "--start" && argv[i + 1]) out.start = Number(argv[++i]);
    else if (a === "--concurrency" && argv[i + 1]) out.concurrency = Math.max(1, Number(argv[++i]));
    else if (a === "--timeout-ms" && argv[i + 1]) out.timeoutMs = Math.max(1000, Number(argv[++i]));
    else if (a === "--sleep-ms" && argv[i + 1]) out.sleepMs = Math.max(0, Number(argv[++i]));
    else if (a === "--retries" && argv[i + 1]) out.retries = Math.max(0, Number(argv[++i]));
    else if (a === "--retry-delay-ms" && argv[i + 1]) out.retryDelayMs = Math.max(0, Number(argv[++i]));
    else if (a === "--out-ndjson" && argv[i + 1]) out.outNdjson = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--skip-cached") out.skipCached = true;
    else if (a === "--include-cached") out.skipCached = false;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return out;
}

function safeString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeScoreUrl(u) {
  const s = safeString(u).trim();
  if (!s) return "";
  if (s.endsWith("/score/disclosure-quality")) return s;
  if (s.endsWith("/")) return s + "score/disclosure-quality";
  // Allow passing a base URL; append the endpoint path.
  if (!s.includes("/score/")) return s + "/score/disclosure-quality";
  return s;
}

function scoreToBatchUrl(scoreUrl) {
  const s = safeString(scoreUrl).trim();
  if (!s) return "";
  if (s.endsWith("/score/disclosure-quality")) return s.slice(0, -"/disclosure-quality".length) + "/disclosure-quality-batch";
  if (s.endsWith("/score/disclosure-quality-batch")) return s;
  if (s.endsWith("/")) return s + "score/disclosure-quality-batch";
  if (!s.includes("/score/")) return s + "/score/disclosure-quality-batch";
  return s;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url, body, timeoutMs, { retries = 0, retryDelayMs = 1000 } = {}) {
  async function postJsonOnce() {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        const snippet = text.length > 400 ? text.slice(0, 400) + "..." : text;
        const err = new Error(`HTTP ${res.status}: ${snippet || res.statusText}`);
        // Attach status for retry logic.
        err.status = res.status;
        err.responseBody = snippet;
        throw err;
      }

      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    } finally {
      clearTimeout(t);
    }
  }

  function isRetryable(e) {
    const status = e && typeof e === "object" && "status" in e ? Number(e.status) : null;
    if (status && [429, 500, 502, 503, 504].includes(status)) return true;
    if (e && typeof e === "object" && "name" in e && e.name === "AbortError") return true;
    const msg = e instanceof Error ? e.message : String(e || "");
    return /fetch failed|network|socket|timed out|ECONNRESET|EAI_AGAIN/i.test(msg);
  }

  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await postJsonOnce();
    } catch (e) {
      if (attempt > retries + 1 || !isRetryable(e)) throw e;

      const backoff = Math.min(30_000, Math.round(retryDelayMs * Math.pow(2, attempt - 2)));
      const jitter = Math.floor(Math.random() * Math.min(250, Math.max(50, Math.floor(backoff * 0.2))));
      const waitMs = backoff + jitter;
      const status = e && typeof e === "object" && "status" in e ? Number(e.status) : null;
      console.warn(
        `[cf-score] retrying in ${waitMs}ms` +
          (status ? ` status=${status}` : "") +
          ` attempt=${attempt - 1}/${retries}`
      );
      await sleep(waitMs);
    }
  }
}

async function runPool(items, concurrency, worker) {
  let nextIdx = 0;
  let ok = 0;
  let err = 0;

  async function runner(workerId) {
    for (;;) {
      const i = nextIdx++;
      if (i >= items.length) return;

      const item = items[i];
      try {
        await worker(item, i, workerId);
        ok++;
      } catch (e) {
        err++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[cf-score] error id=${safeString(item?.id)}: ${msg}`);
      }

      if ((ok + err) % 10 === 0) {
        console.log(`[cf-score] progress done=${ok + err}/${items.length} ok=${ok} err=${err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, wi) => runner(wi)));
  return { ok, err };
}

async function ensureParentDir(filePath) {
  if (!filePath) return;
  const dir = path.dirname(filePath);
  if (dir && dir !== "." && dir !== filePath) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function appendNdjson(filePath, obj) {
  if (!filePath) return;
  await ensureParentDir(filePath);
  await fs.appendFile(filePath, JSON.stringify(obj) + "\n", "utf-8");
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const scoreUrl = normalizeScoreUrl(args.scoreUrl);
  if (!scoreUrl) throw new Error("Missing --score-url (or set CF_SCORE_URL).");
  const batchUrl = scoreToBatchUrl(scoreUrl);

  const rows = JSON.parse(await fs.readFile(args.index, "utf-8"));
  if (!Array.isArray(rows)) throw new Error(`Index is not an array: ${args.index}`);

  let candidates = rows
    .filter((r) => r && typeof r === "object")
    .filter((r) => safeString(r.id).trim() && safeString(r.k).trim());

  if (Number.isFinite(args.year) && args.year) {
    candidates = candidates.filter((r) => Number(r.y) === args.year);
  }

  const start = Math.max(0, Number(args.start) || 0);
  if (start) candidates = candidates.slice(start);

  const limit = Math.max(0, Number(args.limit) || 0);
  if (limit) candidates = candidates.slice(0, limit);

  console.log(`[cf-score] url=${scoreUrl}`);
  console.log(
    `[cf-score] reports=${candidates.length} concurrency=${args.concurrency} force=${args.force} skipCached=${args.skipCached} sleepMs=${args.sleepMs} timeoutMs=${args.timeoutMs} retries=${args.retries}`
  );
  if (args.outNdjson) console.log(`[cf-score] ndjson=${args.outNdjson}`);

  if (args.dryRun) {
    for (const r of candidates.slice(0, 10)) {
      console.log(`[dry-run] id=${r.id} k=${r.k}`);
    }
    if (candidates.length > 10) console.log(`[dry-run] ... (${candidates.length - 10} more)`);
    return;
  }

  if (args.skipCached && !args.force && candidates.length > 0) {
    const chunks = chunkArray(candidates, 200);
    const missing = [];
    for (const chunk of chunks) {
      const ids = chunk.map((r) => r.id);
      try {
        const res = await postJson(batchUrl, { reportIds: ids, version: 1, summaryOnly: true }, Math.min(args.timeoutMs, 30_000), {
          retries: args.retries,
          retryDelayMs: args.retryDelayMs,
        });
        const map = res && typeof res === "object" && res.results && typeof res.results === "object" ? res.results : null;
        if (!map) {
          missing.push(...chunk);
          continue;
        }
        for (const row of chunk) {
          const entry = map[row.id];
          const looksCached =
            entry &&
            typeof entry === "object" &&
            !entry.error &&
            (typeof entry.score === "number" || typeof entry.band === "string" || typeof entry.generatedAt === "string");
          if (!looksCached) missing.push(row);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[cf-score] cache probe failed for chunk size=${chunk.length}: ${msg}`);
        missing.push(...chunk);
      }
    }
    console.log(`[cf-score] cache probe via ${batchUrl}: queued=${missing.length}/${candidates.length}`);
    candidates = missing;
  }

  const { ok, err } = await runPool(candidates, args.concurrency, async (r) => {
    const payload = {
      meta: {
        reportId: r.id,
        reportKey: r.k,
        company: r.c || "",
        publishedYear: r.y || "",
      },
      options: {
        version: 1,
        force: args.force,
        store: true,
      },
    };

    const res = await postJson(scoreUrl, payload, args.timeoutMs, {
      retries: args.retries,
      retryDelayMs: args.retryDelayMs,
    });
    await appendNdjson(args.outNdjson, {
      t: new Date().toISOString(),
      reportId: r.id,
      reportKey: r.k,
      ok: Boolean(res && !res.error),
      score: res?.score ?? null,
      subscores: res?.subscores ?? null,
      error: res?.error ?? null,
    });

    if (args.sleepMs) await sleep(args.sleepMs);
  });

  console.log(`[cf-score] done ok=${ok} err=${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
