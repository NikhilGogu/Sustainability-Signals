# Sustainability Signals

Sustainability report library with in-app PDF viewing, AI chat, and Disclosure Quality scoring (with evidence highlights).

## Architecture

- PDFs (sustainability-only extracts) live in Cloudflare R2.
- PDFs are served same-origin via Cloudflare Pages Functions at `/r2/reports/...` (supports `Range` for fast PDF rendering).
- AI chat runs in a Pages Function at `/chat` using Cloudflare Workers AI.

## Local Development

```bash
npm install

# Frontend only
npm run dev

# Frontend + Pages Functions (R2 + AI bindings)
npm run dev:functions
```

## Docker (Local)

```bash
# Frontend-only (Vite) on http://localhost:5174
docker compose up
```

Full-stack (Vite + Pages Functions via Wrangler) requires a Cloudflare API token:

```bash
CLOUDFLARE_API_TOKEN=... docker compose up
# http://localhost:8788
```

PowerShell equivalent:

```powershell
$env:CLOUDFLARE_API_TOKEN = "..."
docker compose up
```

Optional: run the FinBERT inference server locally and wire it into Pages dev:

```bash
# Starts the FinBERT container too (first build can take a while).
CLOUDFLARE_API_TOKEN=... FINBERT_URL=http://finbert:8080 docker compose --profile finbert up --build
```

PowerShell equivalent:

```powershell
$env:CLOUDFLARE_API_TOKEN = "..."
$env:FINBERT_URL = "http://finbert:8080"
docker compose --profile finbert up --build
```

## Deploy (CLI)

```bash
npm run deploy
```

## Cloudflare Setup

- R2 bucket: `sustainability-signals`
- Bindings (Pages dashboard or via `wrangler.toml`):
  - `REPORTS_BUCKET` (R2) -> `sustainability-signals`
  - `AI` (Workers AI binding)
- Optional (Vectorize semantic search across PDFs):
  - Vectorize index: `sustainability-signals-index`
  - Binding: `VECTORIZE_INDEX`
- Optional Worker env var:
  - `AI_MODEL` (default: `@cf/meta/llama-3-8b-instruct`)
  - `AI_EMBEDDING_MODEL` (default: `@cf/baai/bge-small-en-v1.5`)
  - `AI_EMBEDDING_POOLING` (`mean` or `cls`, default: `cls`)
  - `AI_LORA` (optional finetune id/name when using a `*-lora` model)
  - `AI_LORA_RAW` (`true`/`false`, default: `true` when `AI_LORA` is set)

## FinBERT Service (Azure Container Apps)

This repo includes a Dockerized inference server for the real `yiyanghkust/finbert-esg-9-categories` model under `containers/finbert-esg/`.

Run it anywhere (local Docker, Azure Container Apps, etc.) and point Pages Functions at it:

- `FINBERT_URL`: base URL of the hosted inference server (e.g. `https://<app>.azurecontainerapps.io`)
- `FINBERT_API_KEY` (optional): if set, Pages Functions send `x-api-key`, and the server requires it

### Deploy To Azure Container Apps (CLI)

Prereqs: Azure CLI + Docker.

See `containers/finbert-esg/DEPLOY_AZURE.md` for the up-to-date deployment steps (EU region example: `germanywestcentral`).

Then configure `FINBERT_URL` (and `FINBERT_API_KEY` if used) in your Cloudflare Pages project environment variables.

## Reports Index

The UI reads `src/data/reportsIndex.json` (online-only reports that exist in R2). Issuer URLs and offline file paths are not shipped to the browser.

Classification: `s` = GICS Sector, `i` = GICS Industry Group. Legacy/source labels are preserved as `ss`/`si`.

To sync the UI index with the latest successful R2 uploads:

```bash
npm run generate:reports-index
```

## Endpoints

- `GET /r2/reports/...` serves PDF bytes from R2
- `POST /chat` runs Workers AI chat grounded on extracted PDF text
  - If `VECTORIZE_INDEX` is bound, the chat endpoint will also (1) query relevant excerpts from Vectorize and (2) opportunistically index the extracted page text sent from the PDF viewer.
  - Vectorize works on extracted text (chunks/embeddings), not raw PDF bytes. If you need full-report Q&A without manually paging through the PDF, you should pre-index the report text (or extract/index it in a background job).
- `POST /score/disclosure-quality` computes a Disclosure Quality score (complete/consistent/assured) for a report and caches it in R2.
  - Optional: include a `text` field (extracted report text) to score without server-side PDF -> Markdown conversion.

In the UI:
- Reports table has a `Disclosure Quality` toggle to surface cached Disclosure Quality scores.
- PDF viewer has a `Quality` panel (next to `Ask AI`) with a score breakdown and evidence highlights.

To trigger Cloudflare-side full-report indexing via CLI (PDF -> Markdown -> Vectorize), run:

```bash
npm run cf:preindex -- --chat-url https://<your-pages-domain>/chat --concurrency 2
```

To batch-compute Disclosure Quality scores via CLI, run:

```bash
npm run cf:score:disclosure -- --score-url https://<your-pages-domain>/score/disclosure-quality --concurrency 2 --out-ndjson reports_artifacts/manifests/disclosure-quality.ndjson
```

Tip: run `npm run cf:preindex` first to cache `toMarkdown` output, otherwise scoring may need to convert PDFs on-demand.
