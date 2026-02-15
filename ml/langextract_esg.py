"""Extract structured ESG entities from sustainability report pages using LangExtract.

This script runs **after** `extract_report_pages.py` and consumes its
`pages.jsonl` output.  It uses LangExtract with a Cloudflare Workers AI
model (or any other registered provider) to pull structured ESG entities
– emissions figures, targets, policies, risks, metrics – from the raw
page text, with precise source grounding back to the text.

Usage
-----
    python ml/langextract_esg.py \
        --in  ml/data/pages.jsonl \
        --out ml/data/esg_extractions.jsonl \
        --model @cf/meta/llama-3.3-70b-instruct-fp8-fast \
        --max-workers 4 \
        --limit 0

Environment variables
---------------------
    CLOUDFLARE_ACCOUNT_ID   – Cloudflare account ID
    CLOUDFLARE_API_TOKEN    – Cloudflare API token
    (or LANGEXTRACT_API_KEY for Gemini / other providers)
"""

from __future__ import annotations

import argparse
import json
import textwrap
from pathlib import Path
from typing import Any, Dict, List

import dotenv

# ── Make sure our local Cloudflare provider is importable ────────────────
import sys

_ml_dir = Path(__file__).resolve().parent
if str(_ml_dir) not in sys.path:
    sys.path.insert(0, str(_ml_dir))

# Register our Cloudflare Workers AI provider with langextract
from langextract_cloudflare import CloudflareWorkersAIProvider  # noqa: F401

import langextract as lx

# ── Prompt & few-shot examples ───────────────────────────────────────────

PROMPT_DESCRIPTION = textwrap.dedent("""\
    Extract structured ESG (Environmental, Social, Governance) entities
    from sustainability report text.  For every entity found, assign it
    to exactly one of the following extraction classes:

        • ghg_emissions       – GHG / CO₂ / carbon emissions data
                                 (scope 1, 2, 3 figures, totals, intensity)
        • climate_target      – reduction targets, net-zero commitments,
                                 SBTi pledges, Paris-aligned goals
        • energy              – energy consumption, renewable energy %,
                                 MWh figures, energy efficiency
        • water               – water usage, withdrawal, recycling data
        • waste               – waste generation, recycling, hazardous waste
        • biodiversity        – ecological impacts, land use, deforestation
        • social_metric       – employee diversity, health & safety, training,
                                 community investment, human rights
        • governance_policy   – board oversight, ethics policies, anti-
                                 corruption, data privacy, risk management
        • financial_esg       – ESG-linked financial figures, green revenue,
                                 sustainable investment amounts
        • regulatory          – CSRD, TCFD, GRI, SASB, EU Taxonomy references

    Rules:
    1. Use **exact verbatim text** from the source for `extraction_text`.
       Do NOT paraphrase.
    2. List entities in the order they appear in the text.
    3. Each entity must have meaningful `attributes` providing context
       (e.g. scope, year, unit, baseline, status).
    4. If the text contains no ESG-relevant entities, return an empty list.
    5. Prefer specific numeric data over vague qualitative statements.
""")

# High-quality few-shot examples built from real sustainability report text.
EXAMPLES: List[lx.data.ExampleData] = [
    lx.data.ExampleData(
        text=textwrap.dedent("""\
            Scope 1 and 2 emissions: We will reduce our corporate emissions
            in line with a net-zero climate scenario by achieving a 100%
            reduction in absolute scope 1 and 2 GHG emissions by FY28 from
            a FY20 base year. Over FY24, we maintained scope 1 emissions at
            zero. Total carbon footprint: Scope 1 14,011 tCO2e, Scope 2
            market-based 4,732 tCO2e, Scope 3 1,673,903 tCO2e. Carbon
            intensity 3.43 tCO2e/revenue US$'m. Energy use: Renewable
            14,560 MWh, Non-renewable 62,129 MWh. Employee diversity: 42%
            women in management roles. Our Board approved an updated Data
            Privacy Policy in FY24.
        """),
        extractions=[
            lx.data.Extraction(
                extraction_class="climate_target",
                extraction_text="100% reduction in absolute scope 1 and 2 GHG emissions by FY28",
                attributes={
                    "scope": "scope 1+2",
                    "reduction_pct": "100%",
                    "target_year": "FY28",
                    "base_year": "FY20",
                    "framework": "SBTi / Paris-aligned",
                },
            ),
            lx.data.Extraction(
                extraction_class="ghg_emissions",
                extraction_text="scope 1 emissions at zero",
                attributes={
                    "scope": "scope 1",
                    "value": "0",
                    "unit": "tCO2e",
                    "period": "FY24",
                },
            ),
            lx.data.Extraction(
                extraction_class="ghg_emissions",
                extraction_text="Scope 1 14,011 tCO2e",
                attributes={
                    "scope": "scope 1",
                    "value": "14011",
                    "unit": "tCO2e",
                    "period": "FY24",
                },
            ),
            lx.data.Extraction(
                extraction_class="ghg_emissions",
                extraction_text="Scope 2 market-based 4,732 tCO2e",
                attributes={
                    "scope": "scope 2 market-based",
                    "value": "4732",
                    "unit": "tCO2e",
                    "period": "FY24",
                },
            ),
            lx.data.Extraction(
                extraction_class="ghg_emissions",
                extraction_text="Scope 3 1,673,903 tCO2e",
                attributes={
                    "scope": "scope 3",
                    "value": "1673903",
                    "unit": "tCO2e",
                    "period": "FY24",
                },
            ),
            lx.data.Extraction(
                extraction_class="ghg_emissions",
                extraction_text="Carbon intensity 3.43 tCO2e/revenue US$'m",
                attributes={
                    "metric": "carbon intensity",
                    "value": "3.43",
                    "unit": "tCO2e/US$m revenue",
                },
            ),
            lx.data.Extraction(
                extraction_class="energy",
                extraction_text="Renewable 14,560 MWh, Non-renewable 62,129 MWh",
                attributes={
                    "renewable_mwh": "14560",
                    "non_renewable_mwh": "62129",
                    "total_mwh": "76689",
                },
            ),
            lx.data.Extraction(
                extraction_class="social_metric",
                extraction_text="42% women in management roles",
                attributes={
                    "metric": "gender diversity",
                    "value": "42%",
                    "scope": "management",
                },
            ),
            lx.data.Extraction(
                extraction_class="governance_policy",
                extraction_text="Board approved an updated Data Privacy Policy in FY24",
                attributes={
                    "policy": "Data Privacy Policy",
                    "status": "approved / updated",
                    "year": "FY24",
                },
            ),
        ],
    ),
    lx.data.ExampleData(
        text=textwrap.dedent("""\
            Our sustainability report was prepared in accordance with the
            GRI Standards 2021 and we applied the TCFD recommendations.
            Water withdrawal totalled 1.2 million m³, a 5% reduction from
            the prior year. Hazardous waste generated was 340 tonnes.
            We invested €12 million in community development programmes.
        """),
        extractions=[
            lx.data.Extraction(
                extraction_class="regulatory",
                extraction_text="prepared in accordance with the GRI Standards 2021",
                attributes={
                    "framework": "GRI Standards 2021",
                    "type": "reporting standard",
                },
            ),
            lx.data.Extraction(
                extraction_class="regulatory",
                extraction_text="applied the TCFD recommendations",
                attributes={
                    "framework": "TCFD",
                    "type": "disclosure framework",
                },
            ),
            lx.data.Extraction(
                extraction_class="water",
                extraction_text="Water withdrawal totalled 1.2 million m³",
                attributes={
                    "metric": "water withdrawal",
                    "value": "1200000",
                    "unit": "m³",
                    "change": "-5% YoY",
                },
            ),
            lx.data.Extraction(
                extraction_class="waste",
                extraction_text="Hazardous waste generated was 340 tonnes",
                attributes={
                    "metric": "hazardous waste",
                    "value": "340",
                    "unit": "tonnes",
                },
            ),
            lx.data.Extraction(
                extraction_class="financial_esg",
                extraction_text="invested €12 million in community development programmes",
                attributes={
                    "metric": "community investment",
                    "value": "12000000",
                    "currency": "EUR",
                },
            ),
        ],
    ),
]


# ── ESG-issue ↔ pillar mapping (matches existing pipeline) ──────────────

ISSUE_TO_PILLAR: Dict[str, str] = {
    "ghg_emissions": "E",
    "climate_target": "E",
    "energy": "E",
    "water": "E",
    "waste": "E",
    "biodiversity": "E",
    "social_metric": "S",
    "governance_policy": "G",
    "financial_esg": "G",
    "regulatory": "G",
}


# ── Helpers ──────────────────────────────────────────────────────────────

def _read_jsonl(path: Path):
    """Yield dicts from a JSONL file."""
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


def _group_pages_by_report(rows, limit: int = 0):
    """Group page rows by report key, concatenating text.

    Returns a list of dicts with a single ``text`` field containing all
    pages plus metadata carried over from the first page.
    """
    from collections import OrderedDict

    reports: Dict[str, Dict[str, Any]] = OrderedDict()
    count = 0
    for row in rows:
        k = row.get("k", "")
        if k not in reports:
            if limit and count >= limit:
                break
            reports[k] = {
                "k": k,
                "report_id": row.get("report_id"),
                "company": row.get("company"),
                "country": row.get("country"),
                "sector": row.get("sector"),
                "industry_group": row.get("industry_group"),
                "year": row.get("year"),
                "pages": [],
            }
            count += 1
        reports[k]["pages"].append(row)

    out = []
    for k, meta in reports.items():
        # Build a single document from all pages, with page markers
        parts = []
        for p in meta["pages"]:
            page_num = p.get("page", "?")
            text = (p.get("text") or "").strip()
            if text:
                parts.append(f"--- Page {page_num} ---\n{text}")
        meta["full_text"] = "\n\n".join(parts)
        meta["page_count"] = len(meta["pages"])
        del meta["pages"]
        out.append(meta)
    return out


def _extractions_to_rows(
    result,
    meta: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Convert a langextract AnnotatedDocument result to flat dicts."""
    rows: List[Dict[str, Any]] = []
    if not result:
        return rows

    # result is an AnnotatedDocument
    for ext in getattr(result, "extractions", []) or []:
        row = {
            "k": meta.get("k"),
            "report_id": meta.get("report_id"),
            "company": meta.get("company"),
            "country": meta.get("country"),
            "sector": meta.get("sector"),
            "industry_group": meta.get("industry_group"),
            "year": meta.get("year"),
            "extraction_class": getattr(ext, "extraction_class", None),
            "extraction_text": getattr(ext, "extraction_text", None),
            "attributes": getattr(ext, "attributes", None) or {},
            "pillar": ISSUE_TO_PILLAR.get(
                getattr(ext, "extraction_class", "") or "", ""
            ),
        }
        rows.append(row)
    return rows


# ── Main ─────────────────────────────────────────────────────────────────

def main() -> int:
    dotenv.load_dotenv(override=True)

    ap = argparse.ArgumentParser(
        description="Extract ESG entities from report pages using LangExtract.",
    )
    ap.add_argument(
        "--in", dest="in_path", type=str,
        default="ml/data/pages.jsonl",
        help="Input pages JSONL (from extract_report_pages.py)",
    )
    ap.add_argument(
        "--out", type=str,
        default="ml/data/esg_extractions.jsonl",
        help="Output extractions JSONL",
    )
    ap.add_argument(
        "--model", type=str,
        default="@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        help="Model ID – use @cf/... for Cloudflare, gemini-... for Gemini, etc.",
    )
    ap.add_argument(
        "--max-workers", type=int, default=2,
        help="Parallel workers for extraction (keep low for CF API rate limits)",
    )
    ap.add_argument(
        "--extraction-passes", type=int, default=1,
        help="Number of extraction passes (1 is sufficient with good prompting)",
    )
    ap.add_argument(
        "--max-char-buffer", type=int, default=6000,
        help="Max characters per extraction chunk (matches server-side chunking)",
    )
    ap.add_argument(
        "--limit", type=int, default=0,
        help="Max reports to process (0 = all)",
    )
    ap.add_argument(
        "--visualize", action="store_true",
        help="Generate an HTML visualization after extraction",
    )
    args = ap.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not in_path.exists():
        print(f"[langextract-esg] ERROR: input not found: {in_path}")
        return 1

    # ── Group pages into per-report documents ────────────────────────────
    print(f"[langextract-esg] reading {in_path} ...")
    report_docs = _group_pages_by_report(_read_jsonl(in_path), limit=args.limit)
    print(f"[langextract-esg] found {len(report_docs)} reports")

    if not report_docs:
        print("[langextract-esg] nothing to process")
        return 0

    # ── Run extraction per report ────────────────────────────────────────
    total_entities = 0
    all_annotated = []

    with out_path.open("w", encoding="utf-8") as out_f:
        for i, meta in enumerate(report_docs, start=1):
            text = meta["full_text"]
            company = meta.get("company") or meta.get("k")
            print(
                f"[langextract-esg] [{i}/{len(report_docs)}] "
                f"{company} ({meta.get('year')}) – "
                f"{len(text):,} chars, {meta['page_count']} pages"
            )

            try:
                result = lx.extract(
                    text_or_documents=text,
                    prompt_description=PROMPT_DESCRIPTION,
                    examples=EXAMPLES,
                    model_id=args.model,
                    extraction_passes=args.extraction_passes,
                    max_workers=args.max_workers,
                    max_char_buffer=args.max_char_buffer,
                    fence_output=True,
                    use_schema_constraints=False,
                )
            except Exception as exc:
                print(f"  ⚠ extraction failed: {exc}")
                continue

            rows = _extractions_to_rows(result, meta)
            # Deduplicate by (class, text)
            seen = set()
            deduped = []
            for row in rows:
                key = (row["extraction_class"], (row["extraction_text"] or "").lower().strip())
                if key not in seen:
                    seen.add(key)
                    deduped.append(row)
            rows = deduped

            for row in rows:
                out_f.write(json.dumps(row, ensure_ascii=False) + "\n")
            total_entities += len(rows)
            all_annotated.append(result)

            print(f"  ✓ extracted {len(rows)} entities")

    print(
        f"\n[langextract-esg] done – "
        f"{total_entities} entities from {len(report_docs)} reports → {out_path}"
    )

    # ── Optional visualisation ───────────────────────────────────────────
    if args.visualize and all_annotated:
        vis_jsonl = out_path.with_suffix(".vis.jsonl")
        lx.io.save_annotated_documents(all_annotated, output_name=vis_jsonl.name, output_dir=str(vis_jsonl.parent))
        html = lx.visualize(str(vis_jsonl))
        vis_html = out_path.with_suffix(".html")
        with open(vis_html, "w", encoding="utf-8") as fh:
            if hasattr(html, "data"):
                fh.write(html.data)
            else:
                fh.write(html)
        print(f"[langextract-esg] visualization → {vis_html}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
