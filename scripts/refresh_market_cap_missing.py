#!/usr/bin/env python3
"""
Refresh Market Cap EU_missing.csv against the current reports index database.

Behavior:
  1) Recompute "missing" from Market Cap EU.csv vs src/data/reportsIndex.json
  2) Preserve any extra/annotation columns from the current Market Cap EU_missing.csv
     by carrying them over into the refreshed output (matched by normalized Name + Symbol base).
  3) Overwrite Market Cap EU_missing.csv (default) with the refreshed list.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Dict, List, Tuple

# Reuse the matching heuristics from compare_market_cap_eu.py
from compare_market_cap_eu import clean_tokens, load_existing_companies, row_exists, strip_suffix


def symbol_base(symbol: str) -> str:
    s = (symbol or "").strip()
    if not s:
        return ""
    # Common: BBVA.MC, RMS.PA, VOW3.DE
    for sep in (".", ":", "/", " "):
        if sep in s:
            s = s.split(sep, 1)[0]
            break
    # Common: RDS-A
    if "-" in s:
        s = s.split("-", 1)[0]
    return s.strip().upper()


def norm_name(name: str) -> str:
    toks = clean_tokens(name or "")
    toks = strip_suffix(toks)
    return " ".join(toks)


def row_key(row: Dict[str, str]) -> Tuple[str, str]:
    return (norm_name(row.get("Name", "") or ""), symbol_base(row.get("Symbol", "") or ""))


def read_csv(path: Path) -> Tuple[List[str], List[Dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    return fieldnames, rows


def write_csv(path: Path, fieldnames: List[str], rows: List[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--market-cap-csv", default="Market Cap EU.csv")
    ap.add_argument("--missing-csv", default="Market Cap EU_missing.csv")
    ap.add_argument("--db-json", default="src/data/reportsIndex.json")
    ap.add_argument("--out-csv", default="Market Cap EU_missing.csv")
    args = ap.parse_args()

    market_cap_path = Path(args.market_cap_csv)
    missing_path = Path(args.missing_csv)
    db_path = Path(args.db_json)
    out_path = Path(args.out_csv)

    existing_norm, existing_compact, token_index = load_existing_companies(db_path)

    base_fields, market_rows = read_csv(market_cap_path)

    anno_fields: List[str] = []
    anno_rows: List[Dict[str, str]] = []
    if missing_path.exists():
        anno_fields, anno_rows = read_csv(missing_path)

    # Annotation columns are any columns not present in the base Market Cap EU.csv
    extra_cols = [c for c in anno_fields if c and c not in base_fields]

    # Build annotation map keyed by normalized (Name, Symbol base)
    annotations: Dict[Tuple[str, str], Dict[str, str]] = {}
    for r in anno_rows:
        k = row_key(r)
        if k == ("", ""):
            continue
        if k not in annotations:
            annotations[k] = {col: (r.get(col, "") or "") for col in extra_cols}

    refreshed: List[Dict[str, str]] = []
    for r in market_rows:
        if row_exists(r, existing_norm, existing_compact, token_index):
            continue

        out_row = dict(r)
        k = row_key(r)
        anno = annotations.get(k)
        if anno:
            out_row.update(anno)
        else:
            for col in extra_cols:
                out_row.setdefault(col, "")

        refreshed.append(out_row)

    out_fields = list(base_fields)
    for col in extra_cols:
        if col not in out_fields:
            out_fields.append(col)

    write_csv(out_path, out_fields, refreshed)

    # Basic stats
    before = len(anno_rows) if anno_rows else 0
    after = len(refreshed)
    removed = before - after if before else 0
    print(f"Wrote: {out_path}")  # noqa: T201
    print(f"Missing rows: {after} (previous missing file had {before}; removed {removed})")  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

