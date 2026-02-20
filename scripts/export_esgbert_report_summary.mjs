#!/usr/bin/env node
/**
 * Export ESG-BERT aggregates (ml/data/report_issue_agg.json) into a compact,
 * browser-friendly lookup JSON for the site.
 *
 * Output format:
 * {
 *   "version": 1,
 *   "generatedAt": "...",
 *   "count": 123,
 *   "byReportId": {
 *     "report-123": {
 *        "reportKey": "reports/2024/acme/sustainability.pdf",
 *        "pillar_share": { "E": 0.42, "S": 0.18, "G": 0.40 },
 *        "top_issues": [{ "issue": "GHG_Emissions", "pillar": "E", "score": 12.3 }]
 *     }
 *   }
 * }
 *
 * Usage:
 *   node scripts/export_esgbert_report_summary.mjs
 *   node scripts/export_esgbert_report_summary.mjs --top-issues 8 --out public/data/esgbert_report_summary.v1.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_AGG = "ml/data/report_issue_agg.json";
const DEFAULT_INDEX = "src/data/reportsIndex.json";
const DEFAULT_ISSUE_TO_PILLAR = "ml/issue_to_pillar.json";
const DEFAULT_OUT = "public/data/esgbert_report_summary.v1.json";

function parseArgs(argv) {
  const out = {
    agg: DEFAULT_AGG,
    index: DEFAULT_INDEX,
    issueToPillar: DEFAULT_ISSUE_TO_PILLAR,
    out: DEFAULT_OUT,
    topIssues: 7,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--agg" && argv[i + 1]) out.agg = argv[++i];
    else if (a === "--index" && argv[i + 1]) out.index = argv[++i];
    else if (a === "--issue-to-pillar" && argv[i + 1]) out.issueToPillar = argv[++i];
    else if (a === "--out" && argv[i + 1]) out.out = argv[++i];
    else if (a === "--top-issues" && argv[i + 1]) out.topIssues = Math.max(1, Number(argv[++i]) || 7);
    else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

function safeNum(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv);

  const agg = await readJson(args.agg);
  const indexRows = await readJson(args.index);
  const issueToPillar = await readJson(args.issueToPillar);

  const keyToId = new Map();
  for (const r of Array.isArray(indexRows) ? indexRows : []) {
    if (r && typeof r === "object" && typeof r.k === "string" && typeof r.id === "string") {
      keyToId.set(r.k, r.id);
    }
  }

  const byIssue = agg?.by_report_issue_score && typeof agg.by_report_issue_score === "object" ? agg.by_report_issue_score : {};
  const byPillar = agg?.by_report_pillar_score && typeof agg.by_report_pillar_score === "object" ? agg.by_report_pillar_score : {};

  const byReportId = {};

  for (const [reportKey, issueScoresRaw] of Object.entries(byIssue)) {
    const reportId = keyToId.get(reportKey);
    if (!reportId) continue;
    const issueScores = issueScoresRaw && typeof issueScoresRaw === "object" ? issueScoresRaw : {};

    // Recompute pillar_share from issue scores + issueToPillar mapping.
    // This ensures pillar shares always reflect the current issue_to_pillar.json,
    // even if by_report_pillar_score was aggregated with an older mapping.
    const pillarAcc = { E: 0, S: 0, G: 0 };
    for (const [issue, score] of Object.entries(issueScores)) {
      const p = issueToPillar?.[issue];
      if (p === "E" || p === "S" || p === "G") {
        pillarAcc[p] += safeNum(score);
      }
    }
    const total = pillarAcc.E + pillarAcc.S + pillarAcc.G;
    const pillar_share = total > 0 ? { E: pillarAcc.E / total, S: pillarAcc.S / total, G: pillarAcc.G / total } : { E: 0, S: 0, G: 0 };

    const top_issues = Object.entries(issueScores)
      .map(([issue, score]) => ({ issue: String(issue), score: safeNum(score), pillar: issueToPillar?.[issue] || null }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, args.topIssues);

    byReportId[reportId] = { reportKey, pillar_share, top_issues };
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: Object.keys(byReportId).length,
    byReportId,
  };

  await fs.mkdir(path.dirname(args.out), { recursive: true });
  await fs.writeFile(args.out, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`[esgbert] wrote=${payload.count} out=${args.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

