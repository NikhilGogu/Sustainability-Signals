from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from jsonl import read_jsonl


PILLAR_LABELS = ["E", "S", "G"]
PILLAR2ID = {k: i for i, k in enumerate(PILLAR_LABELS)}


class PillarDataset(Dataset):
    def __init__(self, rows: List[Dict[str, Any]], tokenizer, max_length: int = 512):
        self.rows = rows
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        r = self.rows[idx]
        text = str(r.get("text") or "")
        label = r.get("pillar_id")
        enc = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
        )
        enc["labels"] = int(label)
        return enc


def _split_by_report(rows: List[Dict[str, Any]], seed: int, eval_ratio: float) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    by_report: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        k = str(r.get("k") or "")
        by_report.setdefault(k, []).append(r)

    report_keys = [k for k in by_report.keys() if k]
    rng = random.Random(seed)
    rng.shuffle(report_keys)

    n_eval = max(1, int(math.ceil(len(report_keys) * eval_ratio))) if report_keys else 0
    eval_keys = set(report_keys[:n_eval])

    train_rows: List[Dict[str, Any]] = []
    eval_rows: List[Dict[str, Any]] = []
    for k, rs in by_report.items():
        (eval_rows if k in eval_keys else train_rows).extend(rs)

    return train_rows, eval_rows


def _compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    labels = labels.astype(np.int64)

    acc = float((preds == labels).mean()) if len(labels) else 0.0

    f1s = []
    for lab in range(len(PILLAR_LABELS)):
        tp = int(((preds == lab) & (labels == lab)).sum())
        fp = int(((preds == lab) & (labels != lab)).sum())
        fn = int(((preds != lab) & (labels == lab)).sum())
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0
        f1s.append(f1)

    return {"accuracy": acc, "f1_macro": float(np.mean(f1s))}


def main() -> int:
    ap = argparse.ArgumentParser(description="Fine-tune a 3-class E/S/G pillar classifier starting from ESG-BERT.")
    ap.add_argument("--in", dest="in_path", type=str, default="ml/data/issue_preds.jsonl", help="Input JSONL (must contain pred_pillar)")
    ap.add_argument("--out", dest="out_dir", type=str, default="ml/models/esgbert-pillar", help="Output model directory")
    ap.add_argument("--base-model", type=str, default="nbroad/ESG-BERT", help="HF model to start from")
    ap.add_argument("--eval-ratio", type=float, default=0.2, help="Eval split ratio by report")
    ap.add_argument("--seed", type=int, default=42, help="Random seed")
    ap.add_argument("--epochs", type=float, default=1.0, help="Training epochs")
    ap.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    ap.add_argument("--batch-size", type=int, default=8, help="Per-device train batch size")
    ap.add_argument("--freeze-encoder", action="store_true", help="Freeze the BERT encoder and train only the classifier head")
    ap.add_argument("--limit", type=int, default=0, help="Max rows to use (0 = no limit)")
    args = ap.parse_args()

    in_path = Path(args.in_path)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = list(read_jsonl(in_path))
    rows = [r for r in rows if (r.get("pred_pillar") in PILLAR2ID)]
    if args.limit and args.limit > 0:
        rows = rows[: args.limit]

    if not rows:
        raise SystemExit("No rows with pred_pillar found. Run ml/infer_esgbert_issues.py first.")

    # Add numeric label ids
    for r in rows:
        r["pillar_id"] = PILLAR2ID[str(r["pred_pillar"])]

    train_rows, eval_rows = _split_by_report(rows, seed=args.seed, eval_ratio=args.eval_ratio)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        num_labels=len(PILLAR_LABELS),
        id2label={i: lab for i, lab in enumerate(PILLAR_LABELS)},
        label2id={lab: i for i, lab in enumerate(PILLAR_LABELS)},
        ignore_mismatched_sizes=True,
    )

    if args.freeze_encoder:
        for name, param in model.named_parameters():
            if not name.startswith("classifier."):
                param.requires_grad = False

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    train_ds = PillarDataset(train_rows, tokenizer=tokenizer)
    eval_ds = PillarDataset(eval_rows, tokenizer=tokenizer) if eval_rows else None

    train_args = TrainingArguments(
        output_dir=str(out_dir),
        do_train=True,
        do_eval=bool(eval_ds),
        eval_strategy="epoch" if eval_ds else "no",
        save_strategy="epoch",
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=max(1, args.batch_size),
        report_to="none",
        seed=args.seed,
        data_seed=args.seed,
        remove_unused_columns=True,
        logging_steps=50,
    )

    trainer = Trainer(
        model=model,
        args=train_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=_compute_metrics if eval_ds else None,
    )

    trainer.train()

    # Save final model + a tiny metadata file.
    trainer.save_model(str(out_dir))
    (out_dir / "pillar_labels.json").write_text(json.dumps(PILLAR_LABELS, indent=2), encoding="utf-8")
    print(f"[train] saved_model={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
