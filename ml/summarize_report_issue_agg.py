from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _load_index(index_path: Path) -> Dict[str, Dict[str, Any]]:
    if not index_path.exists():
        return {}
    rows = json.loads(index_path.read_text(encoding="utf-8"))
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        k = r.get("k")
        if k:
            out[str(k)] = r
    return out


def _top_items(d: Dict[str, float], n: int) -> List[Tuple[str, float]]:
    return sorted(d.items(), key=lambda kv: kv[1], reverse=True)[:n]


def main() -> int:
    ap = argparse.ArgumentParser(description="Summarize per-report issue/pillar aggregates into a compact JSONL.")
    ap.add_argument("--agg", type=str, default="ml/data/report_issue_agg.json", help="Aggregate JSON from infer_esgbert_issues.py")
    ap.add_argument("--index", type=str, default="src/data/reportsIndex.json", help="reportsIndex.json for metadata")
    ap.add_argument("--out", type=str, default="ml/data/report_summary.jsonl", help="Output JSONL")
    ap.add_argument("--top-issues", type=int, default=5, help="Number of top issues to include per report")
    args = ap.parse_args()

    agg_path = Path(args.agg)
    payload = json.loads(agg_path.read_text(encoding="utf-8"))
    by_issue: Dict[str, Dict[str, float]] = payload.get("by_report_issue_score") or {}
    by_pillar: Dict[str, Dict[str, float]] = payload.get("by_report_pillar_score") or {}

    index = _load_index(Path(args.index))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with out_path.open("w", encoding="utf-8") as f:
        for k, issues in by_issue.items():
            meta = index.get(k) or {}
            pillars = by_pillar.get(k) or {}
            total_pillar = sum(float(v) for v in pillars.values()) or 0.0
            pillar_share = {p: (float(v) / total_pillar) for p, v in pillars.items()} if total_pillar else {}
            top_issues = [{"issue": lab, "score": float(score)} for lab, score in _top_items(issues, args.top_issues)]

            row = {
                "k": k,
                "report_id": meta.get("id"),
                "company": meta.get("c"),
                "year": meta.get("y"),
                "country": meta.get("ct"),
                "sector": meta.get("s"),
                "industry_group": meta.get("i"),
                "pillar_share": pillar_share,
                "top_issues": top_issues,
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1

    print(f"[summary] wrote_reports={written} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

