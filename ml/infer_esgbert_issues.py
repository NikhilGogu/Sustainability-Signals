from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from jsonl import read_jsonl

# ── FinBERT-ESG-9-Categories → Pillar mapping ─────────────────────────────
# Built-in mapping for yiyanghkust/finbert-esg-9-categories.
# Falls back to issue_to_pillar.json for other models (e.g. nbroad/ESG-BERT).
FINBERT_9_TO_PILLAR: Dict[str, str] = {
    # Environmental
    "Climate Change": "E",
    "Natural Capital": "E",
    "Pollution & Waste": "E",
    # Social
    "Human Capital": "S",
    "Product Liability": "S",
    "Community Relations": "S",
    # Governance
    "Corporate Governance": "G",
    "Business Ethics & Values": "G",
    # Non-ESG
    "Non-ESG": None,
}


def _load_issue_to_pillar(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


@torch.inference_mode()
def _predict_batch(model, tokenizer, texts: List[str], device: torch.device) -> Tuple[np.ndarray, np.ndarray]:
    enc = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    out = model(**enc)
    logits = out.logits.detach().float().cpu().numpy()
    # softmax
    e = np.exp(logits - logits.max(axis=-1, keepdims=True))
    probs = e / e.sum(axis=-1, keepdims=True)
    pred_ids = probs.argmax(axis=-1)
    pred_scores = probs.max(axis=-1)
    return pred_ids, pred_scores


def main() -> int:
    ap = argparse.ArgumentParser(description="Run FinBERT-ESG-9-Categories (or ESG-BERT) classification on chunks JSONL.")
    ap.add_argument("--in", dest="in_path", type=str, default="ml/data/chunks.jsonl", help="Input chunks JSONL")
    ap.add_argument("--out", type=str, default="ml/data/issue_preds.jsonl", help="Output predictions JSONL")
    ap.add_argument("--aggregate-out", type=str, default="", help="Optional output aggregate JSON path")
    ap.add_argument("--model", type=str, default="yiyanghkust/finbert-esg-9-categories", help="HF model name")
    ap.add_argument("--issue-to-pillar", type=str, default="ml/issue_to_pillar.json", help="Issue->pillar mapping JSON")
    ap.add_argument("--batch-size", type=int, default=16, help="Batch size")
    ap.add_argument("--limit", type=int, default=0, help="Max chunks to process (0 = no limit)")
    args = ap.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Use built-in FinBERT-9 mapping if using the default model, else fallback to external JSON
    if "finbert-esg-9" in args.model.lower() or "finbert-esg" in args.model.lower():
        issue_to_pillar = FINBERT_9_TO_PILLAR
        print(f"[infer] using built-in FinBERT-9 pillar mapping ({len(issue_to_pillar)} categories)")
    else:
        issue_to_pillar = _load_issue_to_pillar(Path(args.issue_to_pillar))
        print(f"[infer] loaded external pillar mapping from {args.issue_to_pillar} ({len(issue_to_pillar)} entries)")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    model = AutoModelForSequenceClassification.from_pretrained(args.model)
    model.to(device)
    model.eval()

    id2label = {int(k): v for k, v in model.config.id2label.items()} if isinstance(model.config.id2label, dict) else {}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    agg_issue: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    agg_pillar: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    batch: List[Dict[str, Any]] = []
    processed = 0
    rows_iter = read_jsonl(in_path)
    with out_path.open("w", encoding="utf-8") as out_f:
        for row in rows_iter:
            batch.append(row)
            if args.limit and args.limit > 0 and (processed + len(batch)) >= args.limit:
                # Trim the final batch if we hit the limit.
                want = max(0, args.limit - processed)
                batch = batch[:want]

            if len(batch) < args.batch_size and not (args.limit and args.limit > 0 and processed + len(batch) >= args.limit):
                continue

            if not batch:
                break

            texts = [str(r.get("text") or "") for r in batch]
            pred_ids, pred_scores = _predict_batch(model, tokenizer, texts, device=device)
            for r, pid, pscore in zip(batch, pred_ids.tolist(), pred_scores.tolist()):
                label = id2label.get(int(pid), str(pid))
                pillar = issue_to_pillar.get(label)
                out = dict(r)
                out.update(
                    {
                        "pred_issue_id": int(pid),
                        "pred_issue": label,
                        "pred_score": float(pscore),
                        "pred_pillar": pillar,
                    }
                )
                out_f.write(json.dumps(out, ensure_ascii=False) + "\n")
                processed += 1
                k = str(r.get("k") or "")
                if k:
                    agg_issue[k][label] += float(pscore)
                    if pillar:
                        agg_pillar[k][pillar] += float(pscore)

            batch = []
            if processed and processed % 200 == 0:
                print(f"[infer] processed_chunks={processed}...")

            if args.limit and args.limit > 0 and processed >= args.limit:
                break

        # flush any remainder (if we exited early without processing)
        if batch and not (args.limit and args.limit > 0 and processed >= args.limit):
            texts = [str(r.get("text") or "") for r in batch]
            pred_ids, pred_scores = _predict_batch(model, tokenizer, texts, device=device)
            for r, pid, pscore in zip(batch, pred_ids.tolist(), pred_scores.tolist()):
                label = id2label.get(int(pid), str(pid))
                pillar = issue_to_pillar.get(label)
                out = dict(r)
                out.update(
                    {
                        "pred_issue_id": int(pid),
                        "pred_issue": label,
                        "pred_score": float(pscore),
                        "pred_pillar": pillar,
                    }
                )
                out_f.write(json.dumps(out, ensure_ascii=False) + "\n")
                processed += 1
                k = str(r.get("k") or "")
                if k:
                    agg_issue[k][label] += float(pscore)
                    if pillar:
                        agg_pillar[k][pillar] += float(pscore)

    print(f"[infer] wrote_preds={processed} out={out_path}")

    if args.aggregate_out:
        agg_path = Path(args.aggregate_out)
        agg_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "by_report_issue_score": {k: dict(v) for k, v in agg_issue.items()},
            "by_report_pillar_score": {k: dict(v) for k, v in agg_pillar.items()},
        }
        agg_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[infer] wrote_agg out={agg_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
