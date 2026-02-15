from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterator, Optional

import fitz  # PyMuPDF


def _normalize_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _load_reports_index(index_path: Optional[Path]) -> Dict[str, Dict[str, Any]]:
    if not index_path:
        return {}
    rows = json.loads(index_path.read_text(encoding="utf-8"))
    out: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        k = row.get("k")
        if k:
            out[str(k)] = row
    return out


def _iter_local_pdfs_from_index(index: Dict[str, Dict[str, Any]], r2_root: Path) -> Iterator[Dict[str, Any]]:
    for k, row in index.items():
        local_path = (r2_root / k).resolve()
        if local_path.exists() and local_path.is_file():
            yield {
                "k": k,
                "local_path": str(local_path),
                "index_row": row,
            }


def _extract_pages(pdf_path: Path) -> Iterator[Dict[str, Any]]:
    doc = fitz.open(pdf_path)
    try:
        for page_i in range(doc.page_count):
            page = doc.load_page(page_i)
            text = page.get_text("text") or ""
            text = _normalize_text(text)
            yield {"page": page_i + 1, "text": text}
    finally:
        doc.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract per-page text from local R2 PDFs into JSONL.")
    ap.add_argument("--index", type=str, default="src/data/reportsIndex.json", help="Path to reportsIndex.json")
    ap.add_argument("--r2-root", type=str, default="reports_artifacts/r2", help="Local path to R2 mirror root")
    ap.add_argument("--out", type=str, default="ml/data/pages.jsonl", help="Output JSONL path")
    ap.add_argument("--limit", type=int, default=0, help="Max number of PDFs to process (0 = no limit)")
    args = ap.parse_args()

    index_path = Path(args.index) if args.index else None
    r2_root = Path(args.r2_root)
    out_path = Path(args.out)

    index = _load_reports_index(index_path) if index_path and index_path.exists() else {}
    pdf_rows = list(_iter_local_pdfs_from_index(index, r2_root)) if index else []

    if not pdf_rows:
        # Fallback: scan local PDFs under r2-root/reports/**.pdf
        scan_root = r2_root / "reports"
        pdf_paths = sorted(scan_root.rglob("*.pdf")) if scan_root.exists() else []
        for p in pdf_paths:
            rel = p.relative_to(r2_root).as_posix()
            pdf_rows.append({"k": rel, "local_path": str(p.resolve()), "index_row": None})

    if args.limit and args.limit > 0:
        pdf_rows = pdf_rows[: args.limit]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with out_path.open("w", encoding="utf-8") as out_f:
        for i, pdf in enumerate(pdf_rows, start=1):
            k = pdf["k"]
            pdf_path = Path(pdf["local_path"])
            index_row = pdf.get("index_row") or {}

        # Parse `reports/<year>/<slug>/<filename>.pdf` if present.
        year = None
        slug = None
        parts = Path(k).parts
        if len(parts) >= 4 and parts[0] == "reports":
            try:
                year = int(parts[1])
            except Exception:
                year = None
            slug = parts[2]

            for page_row in _extract_pages(pdf_path):
                out_f.write(
                    json.dumps(
                        {
                            "k": k,
                            "local_path": str(pdf_path),
                            "year": year or index_row.get("y"),
                            "slug": slug,
                            "report_id": index_row.get("id"),
                            "company": index_row.get("c"),
                            "country": index_row.get("ct"),
                            "sector": index_row.get("s"),
                            "industry_group": index_row.get("i"),
                            "page": page_row["page"],
                            "text": page_row["text"],
                            "text_chars": len(page_row["text"]),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                written += 1

            if i % 10 == 0:
                print(f"[extract] processed_pdfs={i}/{len(pdf_rows)}")

    print(f"[extract] wrote_pages={written} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
