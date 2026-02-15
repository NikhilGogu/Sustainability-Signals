#!/usr/bin/env node
/**
 * Trigger Cloudflare-side full report ingestion (PDF -> Markdown) and (if enabled)
 * Vectorize indexing by calling the deployed `/chat` endpoint.
 *
 * This leverages Cloudflare Workers AI (`toMarkdown`, embeddings) and R2/Vectorize
 * bindings from your Pages Functions deployment.
 *
 * Usage:
 *   node scripts/cf_preindex_reports.mjs --chat-url https://<your-site>/chat --concurrency 2
 *   node scripts/cf_preindex_reports.mjs --chat-url https://<your-site>/chat --year 2024 --limit 50
 *
 * Tip:
 *   If you re-run this, the `/chat` function will skip reports already marked as indexed.
 */

import fs from "node:fs/promises";
import process from "node:process";

const DEFAULT_INDEX = "src/data/reportsIndex.json";

function parseArgs(argv) {
  const out = {
    index: DEFAULT_INDEX,
    chatUrl: process.env.CF_CHAT_URL || "",
    year: null,
    limit: 0,
    start: 0,
    concurrency: 2,
    timeoutMs: 20_000,
    sleepMs: 0,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--index" && argv[i + 1]) out.index = argv[++i];
    else if (a === "--chat-url" && argv[i + 1]) out.chatUrl = argv[++i];
    else if (a === "--year" && argv[i + 1]) out.year = Number(argv[++i]);
    else if (a === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a === "--start" && argv[i + 1]) out.start = Number(argv[++i]);
    else if (a === "--concurrency" && argv[i + 1]) out.concurrency = Math.max(1, Number(argv[++i]));
    else if (a === "--timeout-ms" && argv[i + 1]) out.timeoutMs = Math.max(1000, Number(argv[++i]));
    else if (a === "--sleep-ms" && argv[i + 1]) out.sleepMs = Math.max(0, Number(argv[++i]));
    else if (a === "--dry-run") out.dryRun = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return out;
}

function safeString(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeChatUrl(u) {
  const s = safeString(u).trim();
  if (!s) return "";
  // Allow passing a base URL; append `/chat` if needed.
  if (s.endsWith("/chat")) return s;
  if (s.endsWith("/")) return s + "chat";
  return s + "/chat";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url, body, timeoutMs) {
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
      const snippet = text.length > 300 ? text.slice(0, 300) + "..." : text;
      throw new Error(`HTTP ${res.status}: ${snippet || res.statusText}`);
    }

    // Best-effort JSON parse for debugging.
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(t);
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
        console.error(`[cf-preindex] error id=${safeString(item?.id)}: ${msg}`);
      }

      if ((ok + err) % 10 === 0) {
        console.log(`[cf-preindex] progress done=${ok + err}/${items.length} ok=${ok} err=${err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, wi) => runner(wi)));
  return { ok, err };
}

async function main() {
  const args = parseArgs(process.argv);
  const chatUrl = normalizeChatUrl(args.chatUrl);
  if (!chatUrl) throw new Error("Missing --chat-url (or set CF_CHAT_URL).");

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

  console.log(`[cf-preindex] chat=${chatUrl}`);
  console.log(`[cf-preindex] reports=${candidates.length} concurrency=${args.concurrency} sleepMs=${args.sleepMs}`);

  if (args.dryRun) {
    for (const r of candidates.slice(0, 10)) {
      console.log(`[dry-run] id=${r.id} k=${r.k}`);
    }
    if (candidates.length > 10) console.log(`[dry-run] ... (${candidates.length - 10} more)`);
    return;
  }

  const { ok, err } = await runPool(candidates, args.concurrency, async (r) => {
    const payload = {
      // Empty messages to avoid embedding/query work in /chat; we only want to trigger background ingestion.
      messages: [],
      context: "",
      meta: {
        reportId: r.id,
        reportKey: r.k,
        company: r.c || "",
        publishedYear: r.y || "",
      },
    };

    await postJson(chatUrl, payload, args.timeoutMs);

    if (args.sleepMs) await sleep(args.sleepMs);
  });

  console.log(`[cf-preindex] done ok=${ok} err=${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
