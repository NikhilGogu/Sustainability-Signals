# Implementation Plan: FinBERT-ESG-9 Microservices

## Overview

The platform uses a **Microservices Architecture** to integrate the real FinBERT-ESG-9-Categories model.
Instead of calling the external HuggingFace Inference API, we run the model **self-hosted in a Cloudflare Container** (Worker A), which is called by the main application (Worker B / Pages Functions) via a high-performance **Service Binding**.

This architecture bypasses the need for API keys and ensures data privacy/compliance by keeping all processing within your Cloudflare zone.

---

## Architecture

### 1. The Container Service (`containers/finbert-esg`)
- **Type**: Cloudflare Worker + Container (Durable Object)
- **Model**: `yiyanghkust/finbert-esg-9-categories` (baked into Docker image)
- **Stack**: Python 3.11, Flask, PyTorch, Transformers
- **Exposes**: Service Binding (internal API)
- **Scaling**: Auto-sleeps after 5 mins inactivity; Max 3 concurrent instances

### 2. The Main Application (`functions/score`)
- **Type**: Cloudflare Pages Functions
- **Role**: Validates requests, converts PDFs, and orchestrates the pipeline
- **Integration**: Calls the Container Service via `env.FINBERT_CONTAINER` binding

### Data Flow
```
Client Request (POST /score/entity-extract)
  ↓
Pages Function (entity-extract.js)
  ↓
Chunk Text
  ↓
Service Binding Call: env.FINBERT_CONTAINER.fetch(...)
  ↓
Container Worker (worker.js) → Durable Object (FinBERTContainer)
  ↓
Flask Server (port 8080)
  ↓
Inference (PyTorch) → [[{label, score}, ...]]
  ↓
Return JSON
```

---

## Files Structure

### Container Service (`containers/finbert-esg/`)
| File | Purpose |
|------|---------|
| `Dockerfile` | Builds the inference environment & pre-downloads model weights |
| `server.py` | Flask server handling `POST /classify` (batching up to 32) |
| `requirements.txt` | Python dependencies (torch, transformers, flask) |
| `worker.js` | Worker entrypoint; routes requests to the Container DO |
| `wrangler.toml` | Worker config (name: `finbert-esg-container`) |

### Main App
| File | Changes |
|------|---------|
| `wrangler.toml` | Added `[[services]]` binding to `finbert-esg-container` |
| `functions/score/entity-extract.js` | Uses `env.FINBERT_CONTAINER` service binding |
| `functions/_lib/finbert-router.js` | Logic to call the container service |

---

## Deployment Guide (CLI)

Since this uses Cloudflare Containers, **Docker Desktop is required** to build the image.

### Step 1: Deploy the Container Service
This must be done first so the Service Binding in the main app has a target.

```bash
# Available at: containers/finbert-esg/
cd containers/finbert-esg

# Deploy (builds Docker image, pushes to registry, deploys Worker)
wrangler deploy
```
*Note: The first deploy will take a few minutes to download the model and build the layer.*

### Step 2: Deploy the Main Application
Once the container service is live:

```bash
# Return to root
cd ../..

# Build the frontend
npx vite build

# Deploy Pages
npx wrangler pages deploy dist
```

### Verification
After deployment, the `FinBERT-ESG-9 Routing` step in the Methodology page will reflect the containerized architecture.
