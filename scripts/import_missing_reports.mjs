#!/usr/bin/env node
/**
 * Import missing reports described in Market Cap EU_missing.csv into R2 and
 * append them to src/data/reportsIndex.json.
 *
 * Expected CSV columns:
 *   - Name
 *   - country
 *   - page numbers   (e.g. "47-75", "68–94", "Full")
 *   - Report link    (direct PDF URL)
 *   - sector         (GICS Sector)
 *   - industry       (GICS Industry Group)
 *
 * Usage:
 *   node scripts/import_missing_reports.mjs
 *   node scripts/import_missing_reports.mjs --dry-run
 *   node scripts/import_missing_reports.mjs --no-upload
 */

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

import { PDFDocument } from "pdf-lib";

const DEFAULT_CSV = "Market Cap EU_missing.csv";
const DEFAULT_INDEX = "src/data/reportsIndex.json";
const DEFAULT_BUCKET = "sustainability-signals";
const DEFAULT_YEAR_FALLBACK = 2024;

const APOSTROPHES = ["'", "\u2019", "\u2018", "\u0060", "\u00b4"];

const GICS_SECTORS = new Set([
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
]);

// Industry Group names reflect the GICS hierarchy. We accept both the classic
// names and the 2023 retail renames commonly used by data vendors.
const GICS_INDUSTRY_GROUPS = new Set([
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
]);

function pickField(rec, names) {
  for (const n of names) {
    const v = rec?.[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseArgs(argv) {
  const out = {
    csv: DEFAULT_CSV,
    index: DEFAULT_INDEX,
    bucket: DEFAULT_BUCKET,
    dryRun: false,
    upload: true,
    remote: true,
    uploadIndexed: false,
    yearOverride: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-upload") out.upload = false;
    else if (a === "--upload") out.upload = true;
    else if (a === "--remote") out.remote = true;
    else if (a === "--local") out.remote = false;
    else if (a === "--upload-indexed") out.uploadIndexed = true;
    else if (a === "--csv" && argv[i + 1]) out.csv = argv[++i];
    else if (a === "--index" && argv[i + 1]) out.index = argv[++i];
    else if (a === "--bucket" && argv[i + 1]) out.bucket = argv[++i];
    else if (a === "--year" && argv[i + 1]) out.yearOverride = Number(argv[++i]);
    else throw new Error(`Unknown arg: ${a}`);
  }

  return out;
}

function stripDiacritics(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyCompany(name) {
  let s = stripDiacritics(String(name || "").trim());
  s = s.toLowerCase();
  s = s.replace(/&/g, " and ");
  for (const a of APOSTROPHES) s = s.replaceAll(a, "");
  s = s.replace(/[^a-z0-9]+/g, "-");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s || "unknown-company";
}

function inferYearFromUrl(url) {
  const s = String(url || "");
  const years = [...s.matchAll(/\b(19|20)\d{2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100);

  if (years.length === 0) return DEFAULT_YEAR_FALLBACK;

  // Often hosting path includes publish year (e.g. 2025) while filename includes report year (e.g. 2024).
  return Math.min(...years);
}

function parsePageSpec(specRaw) {
  const spec = String(specRaw || "").trim();
  if (!spec) return null;

  if (/^full$/i.test(spec)) return { type: "full" };

  const m = /(\d+)\s*[-\u2013\u2014]\s*(\d+)/.exec(spec);
  if (m) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
      throw new Error(`Invalid page range: "${spec}"`);
    }
    return { type: "range", start: Math.min(start, end), end: Math.max(start, end) };
  }

  const n = Number(spec);
  if (Number.isFinite(n) && n > 0) return { type: "range", start: n, end: n };

  throw new Error(`Unrecognized page spec: "${spec}"`);
}

function parseCsv(text) {
  // Minimal RFC4180-ish CSV parser for our inputs.
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\r") continue;

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  // trailing row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => String(h || "").replace(/^\uFEFF/, "").trim());
  const records = [];
  for (const r of rows.slice(1)) {
    const rec = {};
    for (let i = 0; i < headers.length; i++) rec[headers[i]] = (r[i] ?? "").trim();
    records.push(rec);
  }
  return records;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function psSingleQuote(s) {
  return `'${String(s).replaceAll("'", "''")}'`;
}

async function downloadWithPowerShell(url, destPath) {
  await ensureDir(path.dirname(destPath));
  const tmp = `${destPath}.tmp`;

  const cmd = [
    "$ProgressPreference='SilentlyContinue';",
    `Invoke-WebRequest -Uri ${psSingleQuote(url)} -Headers @{ 'User-Agent' = 'Mozilla/5.0 (compatible; SustainabilitySignalsBot/1.0)' } -MaximumRedirection 5 -OutFile ${psSingleQuote(tmp)};`,
  ].join(" ");

  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", cmd], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Invoke-WebRequest failed (${code}) for ${url}`));
    });
  });

  await fs.rename(tmp, destPath);
}

async function downloadToFile(url, destPath) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        // Some hosts (notably large corporate sites/CDNs) block requests without a UA.
        "User-Agent": "Mozilla/5.0 (compatible; SustainabilitySignalsBot/1.0)",
        Accept: "application/pdf,*/*",
      },
    });
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
    if (!res.body) throw new Error(`Missing body: ${url}`);

    await ensureDir(path.dirname(destPath));
    const tmp = `${destPath}.tmp`;

    const nodeStream = Readable.fromWeb(res.body);
    await pipeline(nodeStream, fssync.createWriteStream(tmp));
    await fs.rename(tmp, destPath);
  } catch (e) {
    // Node/undici doesn't always validate the same CA chain as Windows. Fall back to PS.
    console.warn(`fetch failed, falling back to Invoke-WebRequest: ${url}`);
    await downloadWithPowerShell(url, destPath);
  }
}

async function extractPdf(rawPdfPath, pageSpec, outPdfPath) {
  const bytes = await fs.readFile(rawPdfPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = doc.getPageCount();

  if (pageSpec.type !== "range") throw new Error(`Unsupported pageSpec: ${pageSpec.type}`);

  const start = Math.max(1, Math.min(pageSpec.start, total));
  const end = Math.max(1, Math.min(pageSpec.end, total));
  const a = Math.min(start, end);
  const b = Math.max(start, end);

  const outDoc = await PDFDocument.create();
  const indexes = [];
  for (let p = a; p <= b; p++) indexes.push(p - 1);

  const pages = await outDoc.copyPages(doc, indexes);
  for (const p of pages) outDoc.addPage(p);

  const outBytes = await outDoc.save();
  await ensureDir(path.dirname(outPdfPath));
  await fs.writeFile(outPdfPath, outBytes);

  return { totalPages: total, extractedPages: pages.length, start: a, end: b };
}

async function wranglerR2Put({ bucket, key, filePath, remote }) {
  const objectPath = `${bucket}/${key}`;

  await new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "cmd.exe" : "npx";
    const locationFlag = remote ? "--remote" : "--local";
    const args = isWin
      ? [
          "/d",
          "/s",
          "/c",
          "npx",
          "--yes",
          "wrangler",
          "r2",
          "object",
          "put",
          objectPath,
          locationFlag,
          "--file",
          filePath,
          "--content-type",
          "application/pdf",
        ]
      : [
          "--yes",
          "wrangler",
          "r2",
          "object",
          "put",
          objectPath,
          locationFlag,
          "--file",
          filePath,
          "--content-type",
          "application/pdf",
        ];

    const child = spawn(cmd, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler r2 put failed (${code}) for ${objectPath}`));
    });
  });
}

function nextReportId(indexRows) {
  let max = 0;
  for (const r of indexRows) {
    const id = String(r?.id || "");
    const m = /^report-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

async function main() {
  const args = parseArgs(process.argv);

  const csvText = await fs.readFile(args.csv, "utf-8");
  const records = parseCsv(csvText);
  const candidates = records.filter((r) => (r["Report link"] || "").trim() && (r["page numbers"] || "").trim());

  if (candidates.length === 0) {
    console.log("No rows found with both 'Report link' and 'page numbers'.");
    return;
  }

  const indexRows = JSON.parse(await fs.readFile(args.index, "utf-8"));
  if (!Array.isArray(indexRows)) throw new Error(`Index is not an array: ${args.index}`);

  const existingKeys = new Set(indexRows.map((r) => String(r?.k || "")));
  let idCounter = nextReportId(indexRows);

  const imported = [];
  const uploadedExisting = [];
  const skipped = [];
  const failed = [];

  for (const r of candidates) {
    const company = r["Name"] || "";
    const country = r["country"] || "";
    const url = r["Report link"] || "";
    const pageSpec = parsePageSpec(r["page numbers"]);
    const gicsSector = pickField(r, ["sector", "Sector", "gics_sector", "GICS Sector"]);
    const gicsIndustryGroup = pickField(r, ["industry", "Industry", "gics_industry_group", "GICS Industry Group"]);

    if (!gicsSector || !GICS_SECTORS.has(gicsSector)) {
      throw new Error(
        `Missing/invalid GICS sector for "${company}". Expected one of: ${[...GICS_SECTORS].join(", ")}`
      );
    }
    if (!gicsIndustryGroup || !GICS_INDUSTRY_GROUPS.has(gicsIndustryGroup)) {
      throw new Error(
        `Missing/invalid GICS industry group for "${company}". Expected one of: ${[...GICS_INDUSTRY_GROUPS].join(", ")}`
      );
    }

    const year = args.yearOverride ?? inferYearFromUrl(url);
    const slug = slugifyCompany(company);

    const rawPath = path.join("reports_artifacts", "raw", `${slug}_${year}.pdf`);
    let outFilename;
    let key;

    try {
      if (args.dryRun) {
        outFilename = pageSpec?.type === "range" ? `sustainability-pp${pageSpec.start}-${pageSpec.end}.pdf` : "sustainability-pp1-N.pdf";
        key = `reports/${year}/${slug}/${outFilename}`;
        console.log(`[dry-run] ${company}: ${key} <- ${url}`);
        continue;
      }

      if (!fssync.existsSync(rawPath)) {
        console.log(`Downloading: ${company}`);
        await downloadToFile(url, rawPath);
      } else {
        console.log(`Using cached download: ${company}`);
      }

      // Filename/key + PDF preparation
      let info = { start: null, end: null, extractedPages: null };
      let finalOutPath = null;

      if (pageSpec?.type === "range") {
        outFilename = `sustainability-pp${pageSpec.start}-${pageSpec.end}.pdf`;
        key = `reports/${year}/${slug}/${outFilename}`;
        finalOutPath = path.join("reports_artifacts", "r2", key);

        info = await extractPdf(rawPath, pageSpec, finalOutPath);
      } else {
        // "Full" reports: don't attempt to parse/slice PDFs. Some vendors produce PDFs
        // that pdf-lib can't parse reliably, but we can still host the bytes.
        outFilename = "sustainability-full.pdf";
        key = `reports/${year}/${slug}/${outFilename}`;
        finalOutPath = path.join("reports_artifacts", "r2", key);

        if (!fssync.existsSync(finalOutPath)) {
          await ensureDir(path.dirname(finalOutPath));
          await fs.copyFile(rawPath, finalOutPath);
        }
      }

      if (existingKeys.has(key)) {
        if (!args.uploadIndexed) {
          console.log(`Skipping (already indexed): ${company} -> ${key}`);
          skipped.push({ company, key, reason: "already-indexed" });
          continue;
        }
      }

      if (args.upload) {
        console.log(`Uploading to R2: ${company} -> ${key}`);
        await wranglerR2Put({ bucket: args.bucket, key, filePath: finalOutPath, remote: args.remote });
      } else {
        console.log(`Prepared (no upload): ${company} -> ${key}`);
      }

      if (existingKeys.has(key)) {
        // Re-uploaded an already indexed key.
        uploadedExisting.push({ company, key });
        continue;
      }

      const newRow = {
        id: `report-${idCounter++}`,
        c: company,
        ct: country || "Unknown",
        s: gicsSector,
        i: gicsIndustryGroup,
        y: Number(year) || DEFAULT_YEAR_FALLBACK,
        k: key,
      };

      indexRows.push(newRow);
      existingKeys.add(key);
      const pagesLabel =
        info?.start && info?.end ? `${info.start}-${info.end}` : pageSpec?.type === "range" ? `${pageSpec.start}-${pageSpec.end}` : "Full";
      imported.push({ company, key, pages: pagesLabel, extractedPages: info.extractedPages });
    } catch (e) {
      console.error(`Failed: ${company}: ${e?.message || e}`);
      failed.push({ company, url, error: String(e?.message || e) });
    }
  }

  if (!args.dryRun && imported.length > 0) {
    await fs.writeFile(args.index, JSON.stringify(indexRows, null, 2) + "\n", "utf-8");
    console.log(`Updated index: ${args.index} (+${imported.length})`);
  }

  console.log("");
  console.log("Summary");
  console.log(`- candidates: ${candidates.length}`);
  console.log(`- imported:   ${imported.length}`);
  console.log(`- uploaded:   ${uploadedExisting.length} (already indexed)`);
  console.log(`- skipped:    ${skipped.length}`);
  console.log(`- failed:     ${failed.length}`);

  if (failed.length > 0) {
    console.log("");
    console.log("Failed items:");
    for (const f of failed) console.log(`- ${f.company}: ${f.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
