#!/usr/bin/env node
/**
 * Purge cached entity extraction results from Cloudflare R2.
 *
 * This removes entity extraction JSON files so they can be re-extracted
 * with updated limits (e.g., after removing the 200-entity cap).
 *
 * Usage:
 *   npx wrangler r2 object list sustainability-signals --prefix "scores/entity_extract/v1/" | node scripts/cf_purge_entity_cache.mjs --dry-run
 *   node scripts/cf_purge_entity_cache.mjs --bucket sustainability-signals --version 1
 *   node scripts/cf_purge_entity_cache.mjs --bucket sustainability-signals --version 1 --dry-run
 *
 * The script uses `wrangler r2 object` commands to list and delete objects.
 */

import { execSync, spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const flags = {
  bucket: "sustainability-signals",
  version: 1,
  dryRun: false,
  yes: false,
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--bucket" && args[i + 1]) flags.bucket = args[++i];
  else if (a === "--version" && args[i + 1]) flags.version = Number(args[++i]);
  else if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--yes" || a === "-y") flags.yes = true;
}

const prefix = `scores/entity_extract/v${flags.version}/`;

console.log(`\n🗑️  Entity extraction cache purge`);
console.log(`   Bucket:  ${flags.bucket}`);
console.log(`   Prefix:  ${prefix}`);
console.log(`   Dry run: ${flags.dryRun}\n`);

// List objects with the prefix
console.log("Listing cached entity extractions...");
let listOutput;
try {
  listOutput = execSync(
    `npx wrangler r2 object list ${flags.bucket} --prefix "${prefix}"`,
    { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
  );
} catch (err) {
  console.error("Failed to list R2 objects. Make sure wrangler is configured.");
  console.error(err.message);
  process.exit(1);
}

// Parse the JSON output from wrangler
let objects = [];
try {
  const parsed = JSON.parse(listOutput);
  objects = Array.isArray(parsed) ? parsed : parsed.objects || [];
} catch {
  // Try line-based parsing if JSON fails
  const lines = listOutput.trim().split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.key) objects.push(obj);
    } catch {
      // skip non-JSON lines
    }
  }
}

if (objects.length === 0) {
  console.log("No entity extraction caches found. Nothing to delete.");
  process.exit(0);
}

console.log(`Found ${objects.length} cached entity extraction(s).`);

if (flags.dryRun) {
  console.log("\n[DRY RUN] Would delete:");
  for (const obj of objects) {
    const key = typeof obj === "string" ? obj : obj.key;
    const size = obj.size ? ` (${Math.round(obj.size / 1024)}KB)` : "";
    console.log(`  - ${key}${size}`);
  }
  console.log(`\nTotal: ${objects.length} file(s). Re-run without --dry-run to delete.`);
  process.exit(0);
}

if (!flags.yes) {
  console.log(`\n⚠️  About to delete ${objects.length} entity extraction cache(s) from R2.`);
  console.log("   Run with --yes or -y to skip this confirmation, or --dry-run to preview.\n");
  process.exit(1);
}

// Delete each object
let deleted = 0;
let failed = 0;
for (const obj of objects) {
  const key = typeof obj === "string" ? obj : obj.key;
  try {
    execSync(`npx wrangler r2 object delete ${flags.bucket} "${key}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    deleted++;
    if (deleted % 10 === 0 || deleted === objects.length) {
      console.log(`  Deleted ${deleted}/${objects.length} (${Math.round((deleted / objects.length) * 100)}%)`);
    }
  } catch (err) {
    failed++;
    console.error(`  Failed to delete ${key}: ${err.message}`);
  }
}

console.log(`\n✅ Done. Deleted: ${deleted}, Failed: ${failed}`);
