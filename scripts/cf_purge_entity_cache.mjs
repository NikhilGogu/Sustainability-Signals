#!/usr/bin/env node
/**
 * Purge cached entity extraction results from Cloudflare R2.
 *
 * This reads the reports index to discover all report IDs, then deletes
 * the corresponding entity extraction cache objects from R2.
 * Run this after raising entity extraction limits to force re-extraction.
 *
 * Usage:
 *   node scripts/cf_purge_entity_cache.mjs --dry-run
 *   node scripts/cf_purge_entity_cache.mjs --yes
 *   node scripts/cf_purge_entity_cache.mjs --bucket sustainability-signals --version 1 --yes
 *   node scripts/cf_purge_entity_cache.mjs --index src/data/reportsIndex.json --dry-run
 *
 * Requires: wrangler configured with Cloudflare credentials.
 * Delete syntax: `npx wrangler r2 object delete <bucket>/<key>`
 */

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import process from "node:process";
import path from "node:path";

const DEFAULT_INDEX = "src/data/reportsIndex.json";

const args = process.argv.slice(2);
const flags = {
  index: DEFAULT_INDEX,
  bucket: "sustainability-signals",
  version: 1,
  dryRun: false,
  yes: false,
  remote: true,
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--index" && args[i + 1]) flags.index = args[++i];
  else if (a === "--bucket" && args[i + 1]) flags.bucket = args[++i];
  else if (a === "--version" && args[i + 1]) flags.version = Number(args[++i]);
  else if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--yes" || a === "-y") flags.yes = true;
  else if (a === "--local") flags.remote = false;
  else if (a === "--remote") flags.remote = true;
}

// ── Load reports index ──────────────────────────────────────────────────────
const indexPath = path.resolve(flags.index);
let reports;
try {
  const raw = await fs.readFile(indexPath, "utf-8");
  reports = JSON.parse(raw);
  if (!Array.isArray(reports)) throw new Error("Expected an array");
} catch (err) {
  console.error(`Failed to read reports index at ${indexPath}`);
  console.error(err.message);
  process.exit(1);
}

// Build R2 keys from report IDs
const keys = reports
  .map((r) => (typeof r.id === "string" ? r.id : String(r.id || "")).trim())
  .filter((id) => /^report-\d+$/.test(id))
  .map((id) => `scores/entity_extract/v${flags.version}/${id}.json`);

if (keys.length === 0) {
  console.log("No valid report IDs found in the index. Nothing to delete.");
  process.exit(0);
}

const locationFlag = flags.remote ? "--remote" : "--local";

console.log(`\n🗑️  Entity extraction cache purge`);
console.log(`   Bucket:   ${flags.bucket}`);
console.log(`   Version:  v${flags.version}`);
console.log(`   Reports:  ${keys.length}`);
console.log(`   Storage:  ${flags.remote ? "remote" : "local"}`);
console.log(`   Dry run:  ${flags.dryRun}\n`);

if (flags.dryRun) {
  console.log("[DRY RUN] Would attempt to delete:");
  for (const key of keys.slice(0, 20)) console.log(`  - ${key}`);
  if (keys.length > 20) console.log(`  ... and ${keys.length - 20} more`);
  console.log(`\nTotal: ${keys.length} key(s). Re-run without --dry-run to delete.`);
  process.exit(0);
}

if (!flags.yes) {
  console.log(`⚠️  About to delete up to ${keys.length} entity extraction cache(s) from R2.`);
  console.log("   Run with --yes or -y to skip this confirmation, or --dry-run to preview.\n");
  process.exit(1);
}

// Delete each object — wrangler delete is idempotent (no error if key missing)
let deleted = 0;
let failed = 0;
for (const key of keys) {
  const objectPath = `${flags.bucket}/${key}`;
  try {
    execSync(`npx wrangler r2 object delete "${objectPath}" ${locationFlag}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    deleted++;
    if (deleted % 25 === 0 || deleted === keys.length) {
      process.stdout.write(`\r  Deleted ${deleted}/${keys.length} (${Math.round((deleted / keys.length) * 100)}%)`);
    }
  } catch (err) {
    failed++;
    if (failed <= 3) console.error(`\n  Failed: ${key} — ${err.message}`);
  }
}

console.log(`\n\n✅ Done. Deleted: ${deleted}, Failed: ${failed}, Skipped (not found): counted as deleted`);
