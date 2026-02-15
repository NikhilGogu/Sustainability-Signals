#!/usr/bin/env python3
"""
Reclassify published year for reports in src/data/reportsIndex.json.

Example:
  python scripts/reclassify_reports_year.py --from-year 2025 --to-year 2024
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="src/data/reportsIndex.json")
    ap.add_argument("--from-year", type=int, required=True)
    ap.add_argument("--to-year", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    index_path = Path(args.index)
    rows = json.loads(index_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise SystemExit(f"Index must be a list: {index_path}")

    changed = 0
    for r in rows:
        if not isinstance(r, dict):
            raise SystemExit("Index rows must be objects")
        if r.get("y") == args.from_year:
            r["y"] = args.to_year
            changed += 1

    if args.dry_run:
        print(f"[dry-run] Would change {changed} rows in {index_path}")  # noqa: T201
        return 0

    index_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated: {index_path} (changed {changed} rows)")  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

