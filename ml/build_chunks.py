from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List

from transformers import AutoTokenizer

from jsonl import read_jsonl


def _split_paragraphs(text: str) -> List[str]:
    if not text:
        return []
    parts = re.split(r"\n\s*\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _chunk_token_ids(
    token_ids: List[int],
    max_tokens: int,
    overlap: int,
) -> Iterator[List[int]]:
    if max_tokens <= 0:
        yield token_ids
        return
    stride = max(1, max_tokens - max(0, overlap))
    i = 0
    while i < len(token_ids):
        yield token_ids[i : i + max_tokens]
        if i + max_tokens >= len(token_ids):
            break
        i += stride


def build_chunks(
    pages: Iterable[Dict[str, Any]],
    tokenizer,
    max_tokens: int,
    overlap: int,
    min_tokens: int,
    min_chars: int,
) -> Iterator[Dict[str, Any]]:
    for row in pages:
        text = str(row.get("text") or "").strip()
        if not text:
            continue

        report_key = row.get("k")
        page_num = row.get("page")

        chunk_in_page = 0
        for para in _split_paragraphs(text):
            if len(para) < min_chars:
                continue
            ids = tokenizer.encode(para, add_special_tokens=False)
            if len(ids) < min_tokens:
                continue
            for window in _chunk_token_ids(ids, max_tokens=max_tokens, overlap=overlap):
                if len(window) < min_tokens:
                    continue
                chunk_text = tokenizer.decode(window, skip_special_tokens=True, clean_up_tokenization_spaces=True).strip()
                if len(chunk_text) < min_chars:
                    continue
                chunk_in_page += 1
                out = {
                    "k": report_key,
                    "report_id": row.get("report_id"),
                    "company": row.get("company"),
                    "country": row.get("country"),
                    "sector": row.get("sector"),
                    "industry_group": row.get("industry_group"),
                    "year": row.get("year"),
                    "page": page_num,
                    "chunk_in_page": chunk_in_page,
                    "text": chunk_text,
                    "token_count": len(window),
                }
                yield out


def main() -> int:
    ap = argparse.ArgumentParser(description="Chunk per-page JSONL text into BERT-sized text chunks.")
    ap.add_argument("--in", dest="in_path", type=str, default="ml/data/pages.jsonl", help="Input pages JSONL")
    ap.add_argument("--out", type=str, default="ml/data/chunks.jsonl", help="Output chunks JSONL")
    ap.add_argument("--model", type=str, default="nbroad/ESG-BERT", help="Tokenizer/model name for tokenization")
    ap.add_argument("--max-tokens", type=int, default=384, help="Max tokens per chunk (excluding special tokens)")
    ap.add_argument("--overlap", type=int, default=64, help="Token overlap between windows for long paragraphs")
    ap.add_argument("--min-tokens", type=int, default=24, help="Skip chunks with fewer tokens than this")
    ap.add_argument("--min-chars", type=int, default=80, help="Skip chunks shorter than this many chars")
    args = ap.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    # We do our own chunking; avoid noisy warnings from the tokenizer.
    tokenizer.model_max_length = 10**9

    pages = read_jsonl(in_path)
    written = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for chunk in build_chunks(
            pages,
            tokenizer=tokenizer,
            max_tokens=args.max_tokens,
            overlap=args.overlap,
            min_tokens=args.min_tokens,
            min_chars=args.min_chars,
        ):
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")
            written += 1
            if written and written % 500 == 0:
                print(f"[chunks] wrote_chunks={written}...")

    print(f"[chunks] wrote_chunks={written} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
