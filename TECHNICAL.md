# Sustainability Signals: Technical Notes (Behind The Hood)

This doc is the "how it actually works" reference for the current codebase.

For a deep dive into the Disclosure Quality engine internals (feature detection, formulas, evidence extraction, scoring, migration, refinement), see `DQ_MECHANISM.md`.

## Stack

- Frontend: React + TypeScript built with Vite (`package.json`, `vite.config.ts`, `src/`)
- Hosting: Cloudflare Pages (static assets) + Pages Functions (`functions/`)
- Storage: Cloudflare R2 (PDFs, cached markdown, cached scores) via `REPORTS_BUCKET` (`wrangler.toml`)
- AI: Cloudflare Workers AI via `AI` binding (`wrangler.toml`)
- (Optional) Search: Cloudflare Vectorize via `VECTORIZE_INDEX` (`wrangler.toml`)

## Runtime Topology

- Static site: built into `dist/` (Vite) and deployed to Cloudflare Pages (`npm run deploy`)
- API endpoints: implemented as Pages Functions under `functions/`
  - `functions/r2/_middleware.js` serves `/r2/*` out of R2, with `Range` support
  - `functions/chat.js` serves `/chat` for report-grounded Q&A
  - `functions/score/disclosure-quality.js` serves `/score/disclosure-quality` (GET cached, POST compute)
  - `functions/score/disclosure-quality-batch.js` serves `/score/disclosure-quality-batch` (bulk cache fetch)

## Cloudflare Bindings And Env

Configured in `wrangler.toml` for local dev and CLI deploy.

- Required bindings
  - `REPORTS_BUCKET` (R2): PDFs + derived artifacts
  - `AI` (Workers AI): chat + PDF-to-markdown conversion + quote cleanup
- Optional binding
  - `VECTORIZE_INDEX` (Vectorize): semantic retrieval and background indexing

Supported env vars (Pages Functions):

- Chat (`functions/chat.js`)
  - `AI_MODEL` (default: `@cf/mistralai/mistral-small-3.1-24b-instruct`)
  - `AI_CONTEXT_WINDOW` (default: inferred from model; used to avoid context-window errors)
  - `AI_MAX_TOKENS` (default: `800`)
  - `AI_SAFETY_TOKENS` (default: `128`)
  - `AI_LORA` (optional)
  - `AI_LORA_RAW` (optional; defaults to `true` when `AI_LORA` is set)
  - `AI_EMBEDDING_MODEL` (default: `@cf/baai/bge-small-en-v1.5`)
  - `AI_EMBEDDING_POOLING` (`cls` or `mean`, default: `cls`)
- Disclosure Quality scoring (`functions/score/disclosure-quality.js`)
  - No required env vars beyond `REPORTS_BUCKET` and (for compute) `AI`
- FinBERT routing (`functions/_lib/finbert-router.js`)
  - `FINBERT_URL` (optional; base URL of hosted FinBERT inference server)
  - `FINBERT_API_KEY` (optional; if set, sent as `x-api-key` header)

## Data Model (Reports)

The browser ships an index of available reports in `src/data/reportsIndex.json`.

- Each row contains:
  - `id`: e.g. `report-20`
  - `c`: company name
  - `ct`: country
  - `s`/`i`: GICS sector / industry group
  - `y`: year
  - `k`: R2 key (must start with `reports/`)

At runtime the UI maps rows to `SustainabilityReport` in `src/data/reportsData.ts`:

- `reportUrl` becomes `/r2/${k}` (same-origin proxy to R2)

## R2 Object Key Conventions

This repo assumes a few stable prefixes in the R2 bucket:

- PDFs: `reports/<year>/<issuer>/<file>.pdf`
- Cached PDF-to-markdown output:
  - `markdown/reports/.../<file>.md`
  - `markdown/reports/.../<file>.json` (metadata like token counts)
- Disclosure Quality scores:
  - `scores/disclosure_quality/v<version>/<reportId>.json`
- Vectorize indexing marker (only when `VECTORIZE_INDEX` is enabled):
  - `vectorize/indexed/<reportId>.json`

## Endpoint Details

### `GET|HEAD /r2/<key>` (PDF bytes from R2)

Implemented in `functions/r2/_middleware.js`.

- Hard-fenced to `key.startsWith('reports/')` to avoid exposing unrelated bucket keys.
- Supports `Range: bytes=<start>-<end>` for fast PDF rendering.
- Sets long-lived caching headers:
  - `Cache-Control: public, max-age=31536000, immutable`

### `POST /chat` (Grounded Q&A)

Implemented in `functions/chat.js`. Called by the PDF viewer UI in `src/components/reports/PDFViewerModal.tsx`.

Request body (shape used by the UI):

```json
{
  "messages": [{ "role": "user|assistant", "content": "..." }],
  "context": "Page 1:\\n...\\n\\nPage 12:\\n...\\n",
  "meta": {
    "reportId": "report-123",
    "reportKey": "reports/2024/acme/sustainability.pdf",
    "company": "ACME",
    "publishedYear": 2024,
    "currentPage": 12,
    "numPages": 240
  }
}
```

Response body:

```json
{ "response": "assistant text", "model": "@cf/..." }
```

How it works:

- The client extracts text from the PDF using PDF.js (`react-pdf`) for page 1 plus a small window around the current page, then sends that as `context`. (`src/components/reports/PDFViewerModal.tsx`)
  - There is a hard cap of `120_000` characters to keep payloads bounded.
- If `VECTORIZE_INDEX` is bound:
  - The handler embeds the last user question and queries Vectorize for relevant chunks (namespace = `reportId`).
  - It also opportunistically upserts embeddings for the just-extracted viewer context (page-labeled chunks).
- If `REPORTS_BUCKET` and `VECTORIZE_INDEX` are both bound and the report is not yet indexed:
  - A background job converts the PDF from R2 to markdown via `AI.toMarkdown()`, caches that markdown back to R2, chunk-embeds it, and upserts to Vectorize.
  - This job is scheduled using `context.waitUntil(...)` so `/chat` stays responsive.

Important behavior:

- If there is no viewer context and no retrieved Vectorize context, `/chat` returns a hint instead of hallucinating.
- The system prompt explicitly instructs the model to only use provided report text and not invent facts or page references.

### `GET /score/disclosure-quality` (Cached score fetch)

Implemented in `functions/score/disclosure-quality.js`.

- Query params:
  - `reportId=report-123` (required)
  - `version=1` (optional; defaults to `1`)
  - `summary=1` (optional; returns a summary subset)
  - `refine=1` (optional; refines evidence quotes via Workers AI and re-caches the JSON)

If the score is missing in R2, returns `404` with `{ "status": "missing", ... }`.

### `POST /score/disclosure-quality` (Compute and cache score)

Implemented in `functions/score/disclosure-quality.js`.

- Request body (used by `scripts/cf_score_disclosure_quality.mjs` and the UI):
  - `meta.reportId` and `meta.reportKey` are required.
  - `options`:
    - `version` (default `1`)
    - `force` (if true, recompute even if cached)
    - `store` (default true; controls whether to cache result back to R2)
  - Optional: `text` (if provided, scoring uses it as markdown/text input instead of doing PDF -> markdown)

Compute pipeline:

1. Load cached score if present (unless `force=true`).
2. Load cached markdown from R2; if missing, fetch the PDF from R2 and run `AI.toMarkdown()` (images disabled), then cache markdown back to R2.
3. Run a regex-based feature detector to compute:
  - `score` (0-100) and `band` (`high|medium|low`)
  - subscores: `completeness`, `consistency`, `assurance`, `transparency`
  - evidence: extracted quotes with page refs when possible
4. Refine evidence quote text via Workers AI (data-cleaning prompt), while preserving numbers and facts.
5. Cache the result JSON back to R2 (unless `store=false`).

### `POST /score/disclosure-quality-batch` (Bulk cached score fetch)

Implemented in `functions/score/disclosure-quality-batch.js`. Used by `src/pages/Reports.tsx` when the Disclosure Quality column is toggled on.

Request body:

```json
{ "reportIds": ["report-1","report-2"], "version": 1, "summaryOnly": true }
```

Response body:

```json
{ "version": 1, "count": 2, "summaryOnly": true, "results": { "report-1": { ... } } }
```

## Frontend Implementation Notes

- Routing is client-side via React Router (`src/App.tsx`). Cloudflare Pages handles SPA fallback by default (no top-level `404.html`), so deep links resolve to `/`.
- PDF viewing uses `react-pdf` + PDF.js worker (`src/components/reports/PDFViewerModal.tsx`).
  - Default mode uses range/streaming; on failure it retries once with `disableRange`/`disableStream` to work around problematic PDFs.
- Disclosure Quality UI:
  - The reports table lazily fetches cached summaries in batches (`/score/disclosure-quality-batch`). (`src/pages/Reports.tsx`)
  - The PDF viewer can fetch a full score and display evidence highlights; it can also request refinement via `refine=1`. (`src/components/reports/PDFViewerModal.tsx`)

## Ops Scripts (Local)

These scripts call your deployed Pages Functions to do heavy work on Cloudflare instead of on your laptop:

- Pre-index PDFs into Vectorize via `/chat` background ingestion:
  - `node scripts/cf_preindex_reports.mjs --chat-url https://<site>/chat --concurrency 2` (`scripts/cf_preindex_reports.mjs`)
- Batch compute Disclosure Quality via `/score/disclosure-quality`:
  - `node scripts/cf_score_disclosure_quality.mjs --score-url https://<site>/score/disclosure-quality --concurrency 2 --out-ndjson reports_artifacts/manifests/disclosure-quality.ndjson` (`scripts/cf_score_disclosure_quality.mjs`)

Other utilities in `scripts/` are mostly data-maintenance helpers (GICS conversion, report reclassification, etc.).

Note: `package.json` currently references scripts that are not present in `scripts/`:

- `scripts/upload-r2-wrangler.py`
- `scripts/generate-reports-index.py`

If those are intended, they should be restored; otherwise `package.json` should be updated to remove/replace them.

## Deploy And Dev

- Install: `npm install`
- Frontend only: `npm run dev` (Vite on port `5174`)
- Frontend + Functions: `npm run dev:functions` (starts Vite + Wrangler Pages dev on port `8788`)
- Build: `npm run build`
- Deploy: `npm run deploy` (builds then `wrangler pages deploy dist ...`)

## Security Headers

Cloudflare Pages headers live in `public/_headers`.

- `_headers` sets clickjacking/CTO/referrer/permissions headers and a CSP.

## Optional ML Toolkit

The `ml/` folder is a local-only toolkit for extracting text from PDFs on disk and running ESG-BERT classification. It is not used by the deployed app. See `ml/README.md`.
