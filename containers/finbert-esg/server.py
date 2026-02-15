"""
FinBERT-ESG-9-Categories Inference Server
==========================================
Containerized HTTP inference server for the real model. Intended to run
anywhere you can run Docker (local dev, Azure Container Apps, etc.).

Endpoints:
  POST /classify   - classify one or more texts
  GET  /health     - health check / readiness probe
"""

import os
import json
import time
import logging

import torch
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# --- Configuration ────────────────────────────────────────────────────────────
MODEL_NAME = "yiyanghkust/finbert-esg-9-categories"
MAX_BATCH_SIZE = 32
MAX_SEQ_LENGTH = 512
PORT = int(os.environ.get("PORT", 8080))
API_KEY = (os.environ.get("FINBERT_API_KEY") or "").strip()

# --- Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("finbert-esg")

# --- Load model at startup ────────────────────────────────────────────────────
log.info("Loading model: %s", MODEL_NAME)
t0 = time.time()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.to(device)
model.eval()

# Build label map from model config
id2label = model.config.id2label
label_list = [id2label[i] for i in range(len(id2label))]

log.info("Model loaded in %.1fs on %s — %d labels: %s", time.time() - t0, device, len(label_list), label_list)

# --- Flask App ────────────────────────────────────────────────────────────────
app = Flask(__name__)


@torch.inference_mode()
def predict(texts: list[str]) -> list[list[dict]]:
    """Run inference on a list of texts. Returns [[{label, score}, ...], ...]."""
    # Truncate long texts to ~1200 chars (BERT 512 tokens ≈ 1500 chars)
    truncated = [t[:1200] if len(t) > 1200 else t for t in texts]

    enc = tokenizer(
        truncated,
        padding=True,
        truncation=True,
        max_length=MAX_SEQ_LENGTH,
        return_tensors="pt",
    )
    enc = {k: v.to(device) for k, v in enc.items()}

    logits = model(**enc).logits
    probs = torch.nn.functional.softmax(logits, dim=-1).cpu().numpy()

    results = []
    for row in probs:
        scores = [
            {"label": label_list[i], "score": round(float(row[i]), 6)}
            for i in range(len(label_list))
        ]
        # Sort by score descending
        scores.sort(key=lambda x: x["score"], reverse=True)
        results.append(scores)

    return results


@app.route("/health", methods=["GET"])
def health():
    """Health / readiness check."""
    return jsonify({
        "ok": True,
        "model": MODEL_NAME,
        "device": str(device),
        "labels": label_list,
    })


@app.route("/classify", methods=["POST"])
def classify():
    """
    Classify one or more texts.

    Request body:
      { "inputs": "single text" }
      or
      { "inputs": ["text1", "text2", ...] }

    Response:
      [[{label, score}, ...], ...]   — one array of scores per input text
    """
    if API_KEY:
        provided = (request.headers.get("x-api-key") or "").strip()
        if not provided or provided != API_KEY:
            return jsonify({"error": "Unauthorized"}), 401

    body = request.get_json(silent=True)
    if not body or "inputs" not in body:
        return jsonify({"error": "Missing 'inputs' in request body"}), 400

    inputs = body["inputs"]
    if isinstance(inputs, str):
        inputs = [inputs]

    if not isinstance(inputs, list) or len(inputs) == 0:
        return jsonify({"error": "'inputs' must be a non-empty string or array of strings"}), 400

    if len(inputs) > MAX_BATCH_SIZE:
        return jsonify({"error": f"Batch size {len(inputs)} exceeds max {MAX_BATCH_SIZE}"}), 400

    # Filter out empty strings
    valid_inputs = []
    valid_indices = []
    for i, text in enumerate(inputs):
        if isinstance(text, str) and text.strip():
            valid_inputs.append(text.strip())
            valid_indices.append(i)

    if not valid_inputs:
        return jsonify({"error": "All inputs were empty"}), 400

    t0 = time.time()
    predictions = predict(valid_inputs)
    duration_ms = round((time.time() - t0) * 1000, 1)

    # Reconstruct full results array (empty results for empty inputs)
    full_results = [[] for _ in range(len(inputs))]
    for idx, pred in zip(valid_indices, predictions):
        full_results[idx] = pred

    log.info("Classified %d texts in %.1fms", len(valid_inputs), duration_ms)

    return jsonify(full_results)


if __name__ == "__main__":
    log.info("Starting FinBERT-ESG inference server on port %d", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=False)
