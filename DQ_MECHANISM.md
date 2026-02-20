# Disclosure Quality (DQ) Mechanism - Detailed Design

This document describes how Disclosure Quality scoring works in this codebase today, based on `functions/score/disclosure-quality.js` (method kind `regex-v4.1`).

## 1) Scope

The DQ mechanism computes a score from sustainability report content and returns:

- Overall score (`0-100`) and band (`high`, `medium`, `low`)
- Four subscores:
  - `completeness`
  - `consistency`
  - `assurance`
  - `transparency`
- Boolean features (detected disclosure signals)
- Evidence snippets and evidence quotes (with optional page/heading)
- Improvement recommendations
- Quantitative profile and method metadata

The endpoint supports cached retrieval (`GET`) and compute-and-cache (`POST`).

## 2) Endpoints and Caching

## `GET /score/disclosure-quality`

Purpose:
- Return cached score from R2
- Optional summary-only view
- Optional evidence refinement
- Optional migration of older method versions

Query parameters:
- `reportId` (required, format `report-<number>`)
- `version` (optional, default `1`, clamped `1..10`)
- `summary=1` (optional)
- `refine=1` (optional)

R2 key:
- `scores/disclosure_quality/v<version>/<reportId>.json`

Behavior:
- `404` with `{ status: "missing" }` if cache not found
- Returns full JSON unless `summary=1`
- If cached result has an older `method.kind`, it recomputes from cached markdown and rewrites cache
- If `refine=1`, it runs AI quote cleanup unless already refined

## `POST /score/disclosure-quality`

Purpose:
- Compute score (or return cached unless `force=true`)
- Optionally store result

Request shape:
- `meta.reportId` (required)
- `meta.reportKey` (required, must start with `reports/`)
- `meta.company`, `meta.publishedYear` (optional metadata)
- `options.version` (`1..10`, default `1`)
- `options.force` (default `false`)
- `options.store` (default `true`)
- `text` (optional pre-extracted content; skips PDF->Markdown conversion)

Pipeline:
1. Read cached score unless `force=true`
2. Load markdown:
   - Use `text` if provided
   - Else load cached markdown from R2 (`markdown/<reportKey-no-pdf>.md`)
   - Else fetch PDF from R2 and call `AI.toMarkdown()`, then cache markdown and metadata
3. Compute DQ result via deterministic regex engine
4. Optionally refine evidence quotes with AI
5. Store score JSON in R2 (unless `store=false`)

Related cached objects:
- Markdown: `markdown/reports/.../<file>.md`
- Markdown meta: `markdown/reports/.../<file>.json`
- Score: `scores/disclosure_quality/v<version>/<reportId>.json`

## `POST /score/disclosure-quality-batch`

Purpose:
- Bulk fetch cached DQ scores (mostly summary objects)

Input:
- `reportIds[]` (deduped, capped at 200)
- `version` (default `1`)
- `summaryOnly` (default `true`)

Used by reports table for lazy DQ column hydration.

## 3) Text Preparation and Evidence Blocking

The scoring core runs on normalized report text, then builds evidence blocks.

Main preprocessing:
- Normalize line endings and whitespace
- Remove conversion noise:
  - markdown table separators, broken links/images
  - decorative unicode symbols, zero-width chars, soft hyphens
- Preserve paragraph boundaries where possible

Sampling for very large documents:
- If content exceeds `800,000` chars:
  - keep head (`420,000` chars)
  - keep tail (remaining budget)
  - insert marker `[...snipped...]`

Page segmentation:
- Recognizes:
  - markdown headings like `### Page N`
  - viewer markers like `Page N:`
- Produces page-aware blocks when possible

Boilerplate removal:
- Detect recurring header/footer lines across pages
- Heuristic:
  - at least `max(3, ceil(25% of pages))` repeats
  - looks like document boilerplate (titles, high uppercase ratio, dense digits, etc.)
- Removes those lines from evidence extraction

Evidence blocks:
- Paragraph blocks and list-item blocks
- Heading context is preserved in block metadata
- Code-fence content is skipped
- Wrapped lines are joined and de-hyphenated

## 4) Feature Detection Engine

Core helper:
- `detectFeature(key, regex, opts)`

For each feature it computes:
- Boolean found/not-found
- Evidence quotes (`maxQuotes`, usually 3)
- Depth:
  - total occurrences
  - distinct pages where pattern appears

Quote extraction behavior:
- Finds regex matches in blocks
- Builds snippet from current block plus neighboring block context when safe
- For very large blocks, extracts sentence-window snippets
- Clips long snippets paragraph-aware

Quote ranking (`quality` score) favors:
- Percentages
- Large numbers
- Units (`tco2e`, `mwh`, `kwh`, `gj`, `tonnes`, `kg`)
- Year mentions
- Target language
- Scope mentions
- Table-like rows
- Presence of page reference
- Longer substantive snippets

Only top-ranked quotes are kept.

## 5) Feature Families

The engine detects a broad set of regex features. Main groups:

- Frameworks and standards:
  - `ESRS`, `CSRD`, `GRI`, `SASB`, `TCFD`, `ISSB`, `IFRS S1/S2`, `EU Taxonomy`, `TNFD`, `CDP`, `SDGs`, Paris references
- Materiality and scope:
  - `double_materiality`, `materiality_assessment`, `materiality_matrix`, `IRO`, `value_chain`, `supply_chain`
- Governance and controls:
  - board oversight, audit committee, internal control, risk management, ESG-linked remuneration, whistleblower, anti-corruption, data privacy, sustainability committee
- Climate and emissions:
  - scope 1/2/3, GHG protocol, base year, scope2 method, emissions intensity, emissions numbers, scope 3 categories
- Targets and transition:
  - net zero, SBTi, transition plan, quantitative targets, interim targets, progress vs targets, climate scenario, carbon pricing
- Environmental topics:
  - energy, water, waste, renewable energy, biodiversity, circular economy, pollution
- Social topics:
  - workforce, safety, diversity, human rights, training, stakeholder engagement, community investment, living wage, just transition, health/wellbeing, employee turnover
- Assurance:
  - limited/reasonable assurance, assurance standards (`ISAE`, `AA1000`), assurance scope, named provider, negative assurance
- Disclosure-quality signals:
  - methodology, boundaries, limitations, restatement, forward-looking, reporting period, data tables, data quality, financial connectivity, ESRS datapoints, sector-specific disclosures, GRI content index

## 6) Quantitative Profile Signals

Additional numeric diagnostics are computed from corpus text:

- `percentageCount`: count of `%` expressions
- `tableRows`: count of markdown-like table rows
- `kpiNumbers`: count of large/typed numeric KPI patterns
- `distinctYears`: number of years with >=4 mentions (from `2018..2026`)
- `numericDensity`: numeric token density per 1000 chars

These feed mostly into consistency scoring and output metadata.

## 7) Subscore Formulas

## Completeness (`0..100`)

Measures breadth and depth of covered topics.

Components:
- Frameworks: up to `18` (framework count + depth bonus)
- Materiality: up to `10`
- Governance package: up to `8`
- Climate and emissions package: up to `22`
- Targets and climate strategy: up to `10`
- Environment beyond climate: up to `8`
- Social package + value chain: up to `12`
- EU taxonomy depth: up to `4`
- Sector-specific: up to `2`

Then clamped to `100`.

## Consistency (`0..100`)

Measures methodological rigor, comparability, and data quality.

Components:
- Methodology + boundary + data quality: up to `20`
- GHG protocol + base year: up to `10`
- Reporting period clarity: up to `5`
- Comparative years: up to `18`
- Quantitative density (percentages/tables/kpi numbers): up to `15`
- Limitations/restatements: up to `10`
- Control environment (internal control/risk/audit): up to `8`
- Units present: up to `5`
- Data tables depth: up to `4`
- Quantitative targets: up to `5`

Then clamped to `100`.

## Assurance (`0..100`)

Base level:
- No assurance and explicit negative: `0`
- Generic assurance mention: `38`
- Limited assurance: `60`
- Reasonable assurance: `82`
- Both reasonable and limited: `90`

Bonuses:
- Assurance standard (`ISAE` or `AA1000`): `+6`
- Named provider: `+5`
- Scope clarity: `+4`
- Breadth (assurance on >=5 pages): `+3`

Clamped to `100`.

## Transparency (`0..100`)

Measures openness, forward-looking clarity, and process transparency.

Components:
- Forward-looking + transition plan: up to `15`
- Limitations + restatement: up to `15`
- Named assurance provider: up to `8`
- Methodology + data quality: up to `10`
- Stakeholder engagement: up to `8`
- Scope 3 category detail: up to `7`
- Reporting period: up to `4`
- Boundary clarity: up to `5`
- Quant targets + progress: up to `8`
- Financial connectivity: up to `5`
- IRO/materiality process detail: up to `5`
- ESRS datapoint references: up to `5`
- GRI content index: up to `3`

Clamped to `100`.

## 8) Overall Score and Banding

Weighted score:

```text
score = round(
  0.35 * completeness +
  0.25 * consistency +
  0.20 * assurance +
  0.20 * transparency
)
```

Band thresholds:
- `high`: score `>= 75`
- `medium`: `50..74`
- `low`: `< 50`

## 9) Recommendations

The engine generates rule-based suggestions from missing signals, then returns top 6.

Examples:
- Add Scope 3 (and category breakdown)
- Add double materiality
- Add/upgrade external assurance
- Add quantitative targets and progress tracking
- Publish transition plan
- Disclose methodology, boundary, base year, forward-looking outlook
- Align with additional frameworks when framework count is low

## 10) Evidence Refinement with AI

After deterministic extraction, the system can clean evidence quotes using `@cf/meta/llama-3.1-8b-instruct`.

Refinement constraints in prompt:
- Keep all numbers/facts unchanged
- Remove markdown/PDF artifacts
- Keep concise and readable
- Output strict JSON only

Runtime limits:
- Up to 20 feature keys
- Up to 3 quotes per key
- Each input quote truncated to 600 chars
- `temperature = 0.1`, `max_tokens = 4000`

Failure mode:
- Non-blocking; if refinement fails, raw regex evidence is retained.

Result metadata:
- `method.evidenceRefinedByAI = <count>`

## 11) Versioning and Migration

Current method kind:
- `regex-v4.1`

Cached results include `method.kind`. When older kinds are encountered during GET/POST cached paths:
- If markdown cache exists, score is recomputed with current method
- Existing markdown token metadata is preserved when available
- `method.migratedFrom` is set
- Cache is rewritten

This allows silent upgrade of older cached scores without changing API contract.

## 12) Output Contract (Important Fields)

Top-level fields:
- `version`, `generatedAt`
- `report` (`id`, `key`, `company`, `year`)
- `score`, `band`
- `subscores`
- `features`, `featureCount`, `featureTotal`, `featureDepth`
- `evidence`, `evidenceQuotes`
- `recommendations`
- `quantitativeProfile`
- `method`

`method` includes:
- `kind` (`regex-v4.1`)
- weights
- corpus statistics (`corpusChars`, `corpusSampled`, `pagesDetected`, `blocks`)
- optional `markdownTokens`, `textProvided`, `evidenceRefinedByAI`, `migratedFrom`

## 13) Practical Limitations

- Regex-based detection can miss semantic paraphrases and can trigger on incidental matches.
- Quality depends on markdown conversion quality and OCR legibility.
- Sampling on very large documents may miss mid-document signals.
- Evidence page mapping relies on page markers in converted text.
- This is a disclosure-quality engine, not a financial materiality or impact model.

## 14) Source of Truth

- `functions/score/disclosure-quality.js`
- `functions/score/disclosure-quality-batch.js`
- `TECHNICAL.md` (endpoint overview)

## 15) Admin Panel — DQ Management UI

The Admin panel (`/admin`) exposes the full DQ pipeline to operators directly from the browser. See `TECHNICAL.md §Admin Panel` for the component breakdown.

### Batch Scoring Flow

1. Admin loads the Reports tab (all index + uploaded reports merged via `mergeReports`).
2. Filters/selects the reports to score; configures version, concurrency, limit, `skipCached`, `forceRecompute`.
3. Hits **Run DQ Batch** — `AdminBatchPanel` drives a `runPool` with the configured concurrency, POSTing to `/score/disclosure-quality` for each queued report.
4. `dqById` state is updated live with `status`, `summary`, and any `error` per report.
5. After the run, the **Analytics** tab shows aggregated stats (coverage, band distribution, subscores, export).
6. For deep inspection, the **Diagnostics** tab allows selecting any scored report and viewing its full score, subscore bars, regex depth table, evidence provenance with structured quotes, and recommendations.
7. The **Depth Analysis** tab shows corpus-wide patterns (sector benchmarks, year trends, country buckets, feature heatmap, Pearson correlation matrix, top/bottom performers), computed fully client-side from the in-memory `dqById` state.

### Aggregation Builders (client-side, `admin-utils.ts`)

| Function | Output |
|---|---|
| `buildSectorBenchmarks` | Per-GICS-sector avg/median/min/max score + avg subscores |
| `buildYearTrends` | Per-year avg/median/band counts + year-over-year delta |
| `buildFeatureCoverage` | Per-feature hit rate, avg occurrences, avg pages across detail-loaded reports |
| `buildPerformers` | Top N and bottom N reports by score |
| `buildCountryBuckets` | Per-country avg/median score + count |
| `buildSubscoreCorrelations` | Pearson r for all C×K, C×A, C×T, K×A, K×T, A×T pairs |
| `stddev` | Population standard deviation helper |
