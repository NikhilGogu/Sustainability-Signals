# ML Toolkit (ESG-BERT)

This folder is a starting point for turning your sustainability PDFs into model-ready text, running `nbroad/ESG-BERT` over them, and optionally fine-tuning a small classifier for your own downstream tasks.

## Setup (Windows / PowerShell)

Create a venv that can re-use your system site packages (torch, pymupdf, etc.):

```powershell
cd d:\Sustainability-Signals
python -m venv ml\.venv --system-site-packages
ml\.venv\Scripts\python -m pip install -r ml\requirements.txt
```

## 1) Extract Page Text From Local PDFs

This reads PDFs from `reports_artifacts/r2/` using the UI index (`src/data/reportsIndex.json`) and writes one JSONL row per page:

```powershell
ml\.venv\Scripts\python ml\extract_report_pages.py `
  --index src\data\reportsIndex.json `
  --r2-root reports_artifacts\r2 `
  --out ml\data\pages.jsonl
```

## 2) Chunk Pages Into Model Inputs

This turns page text into smaller chunks suitable for BERT-sized models:

```powershell
ml\.venv\Scripts\python ml\build_chunks.py `
  --in ml\data\pages.jsonl `
  --out ml\data\chunks.jsonl `
  --model nbroad/ESG-BERT
```

## 3) Run ESG-BERT Issue Classification

Runs the 26-class ESG issue classifier and writes predictions per chunk, plus a report-level aggregate JSON:

```powershell
ml\.venv\Scripts\python ml\infer_esgbert_issues.py `
  --in ml\data\chunks.jsonl `
  --out ml\data\issue_preds.jsonl `
  --aggregate-out ml\data\report_issue_agg.json `
  --model nbroad/ESG-BERT `
  --issue-to-pillar ml\issue_to_pillar.json
```

## 4) (Optional) Fine-Tune A 3-Class E/S/G Pillar Classifier

This is a "starter" fine-tune that learns to predict E/S/G pillars using the `issue_to_pillar` mapping (pseudo-labels derived from the 26-class model).

```powershell
ml\.venv\Scripts\python ml\train_pillar_classifier.py `
  --in ml\data\issue_preds.jsonl `
  --out ml\models\esgbert-pillar `
  --base-model nbroad/ESG-BERT `
  --freeze-encoder
```

Notes:
- This is not yet a true "ESG rating" model. It’s a stepping stone: once you decide what the rating target is (and have labels), we can train a report-level regressor/classifier.
- The local repo currently only has a small subset of PDFs in `reports_artifacts/`. The scripts will only process PDFs present on disk.
## 5) LangExtract – Structured ESG Entity Extraction

Uses [google/langextract](https://github.com/google/langextract) with a **Cloudflare Workers AI** model to extract structured ESG entities (emissions, targets, policies, metrics) from the page text produced in step 1.

### Prerequisites

Set environment variables (or create a `.env` file in the repo root):

```
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

### Run

```powershell
python ml\langextract_esg.py `
  --in ml\data\pages.jsonl `
  --out ml\data\esg_extractions.jsonl `
  --model "@cf/meta/llama-3.3-70b-instruct-fp8-fast" `
  --max-workers 4 `
  --extraction-passes 2
```

Options:
- `--model` – any langextract-supported model ID. Use `@cf/...` for Cloudflare, `gemini-2.5-flash` for Gemini, `gemma2:2b` for Ollama.
- `--extraction-passes` – more passes = higher recall (default 2).
- `--max-char-buffer` – chunk size in characters (default 3000).
- `--limit N` – process only the first N reports (for testing).
- `--visualize` – generate an interactive HTML visualisation of extractions.

### Output

`esg_extractions.jsonl` – one JSONL row per extracted entity:

```json
{
  "k": "reports/2024/prosus/sustainability-pp47-75.pdf",
  "company": "Prosus",
  "year": 2024,
  "extraction_class": "ghg_emissions",
  "extraction_text": "Scope 1 14,011 tCO2e",
  "attributes": {"scope": "scope 1", "value": "14011", "unit": "tCO2e"},
  "pillar": "E"
}
```

### Custom Provider

The script uses a bundled Cloudflare Workers AI provider at `ml/langextract_cloudflare/`. It calls the OpenAI-compatible `/v1/chat/completions` endpoint. You can also use any built-in langextract provider (Gemini, OpenAI, Ollama) by changing `--model`.
